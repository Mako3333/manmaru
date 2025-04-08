import { Food, FoodMatchResult, ConfidenceLevel } from '@/types/food';
import {
    FoodMatchingService,
    MatchingOptions,
    ConfidenceDisplay,
    CONFIDENCE_THRESHOLDS
} from './food-matching-service';
import { FoodRepository } from './food-repository';
import { FoodRepositoryFactory, FoodRepositoryType } from './food-repository-factory';
import { AppError, ErrorCode } from '@/lib/error';

/**
 * 食品マッチングサービスの実装
 */
export class FoodMatchingServiceImpl implements FoodMatchingService {
    private readonly foodRepository: FoodRepository;
    private readonly defaultConfidenceThreshold: number;

    /**
     * コンストラクタ
     * @param repositoryType 使用する食品リポジトリのタイプ
     * @param confidenceThreshold デフォルトの信頼度閾値
     */
    constructor(repositoryType: FoodRepositoryType = FoodRepositoryType.BASIC, confidenceThreshold: number = 0.5) {
        this.foodRepository = FoodRepositoryFactory.getRepository(repositoryType);
        this.defaultConfidenceThreshold = confidenceThreshold;
    }

    /**
     * 食品名から最適な食品データをマッチング
     */
    async matchFood(name: string, options?: MatchingOptions): Promise<FoodMatchResult | null> {
        try {
            const minSimilarity = options?.minSimilarity || this.defaultConfidenceThreshold;

            // 部分一致検索を実行
            const matchResults = await this.foodRepository.searchFoodsByFuzzyMatch(name, options?.limit || 1);

            if (!matchResults || matchResults.length === 0) {
                return null;
            }

            const bestMatch = matchResults[0];
            if (!bestMatch || !bestMatch.food) {
                return null;
            }

            // 信頼度が低すぎる場合はnullを返す
            if (bestMatch.similarity < minSimilarity) {
                console.warn(`低確信度マッチング: "${name}" -> "${bestMatch.food.name}" (${Math.round(bestMatch.similarity * 100)}%)`);

                // 最低閾値未満の場合は null を返す（呼び出し側で処理）
                if (bestMatch.similarity < CONFIDENCE_THRESHOLDS.VERY_LOW) {
                    return null;
                }
            }

            // 互換性プロパティを追加
            return {
                food: bestMatch.food,
                similarity: bestMatch.similarity,
                originalInput: name,
                // 互換性のためのプロパティ
                matchedFood: bestMatch.food,
                confidence: bestMatch.similarity,
                inputName: name
            };

        } catch (error) {
            console.error(`食品マッチング中にエラーが発生しました (${name}):`, error);
            return null;
        }
    }

    /**
     * 複数の食品名を一括でマッチング
     */
    async matchFoods(names: string[], options?: MatchingOptions): Promise<Map<string, FoodMatchResult | null>> {
        const results = new Map<string, FoodMatchResult | null>();

        // 一括検索の場合、パフォーマンス向上のため並列処理も検討
        for (const name of names) {
            results.set(name, await this.matchFood(name, options));
        }

        return results;
    }

    /**
     * 名前と量のペアを持つ入力配列からマッチングを行う (拡張メソッド)
     * 栄養計算サービスなどで使用される
     */
    async matchNameQuantityPairs(
        nameQuantityPairs: Array<{ name: string; quantity?: string }>
    ): Promise<{ matchResults: FoodMatchResult[]; notFoundFoods: string[] }> {
        const matchResults: FoodMatchResult[] = [];
        const notFoundFoods: string[] = [];

        // 名前のみの配列に変換
        const names = nameQuantityPairs.map(pair => pair.name);

        // 一括マッチング実行
        const matchMap = await this.matchFoods(names);

        // 結果の処理
        for (const pair of nameQuantityPairs) {
            const match = matchMap.get(pair.name);

            if (match) {
                // マッチング成功
                matchResults.push(match);
            } else {
                // マッチング失敗
                notFoundFoods.push(pair.name);
            }
        }

        return { matchResults, notFoundFoods };
    }

    /**
     * 確信度レベルを取得
     */
    getConfidenceLevel(confidence: number): ConfidenceLevel | null {
        if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
            return ConfidenceLevel.HIGH;
        } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
            return ConfidenceLevel.MEDIUM;
        } else if (confidence >= CONFIDENCE_THRESHOLDS.LOW) {
            return ConfidenceLevel.LOW;
        } else if (confidence >= CONFIDENCE_THRESHOLDS.VERY_LOW) {
            return ConfidenceLevel.VERY_LOW;
        }
        return null;
    }

    /**
     * 確信度に基づいて視覚的表示情報を取得
     */
    getConfidenceDisplay(confidence: number): ConfidenceDisplay {
        const level = this.getConfidenceLevel(confidence);

        let colorClass = 'text-gray-400';
        let icon = 'question-circle';
        let message = '確信度なし';

        switch (level) {
            case ConfidenceLevel.HIGH:
                colorClass = 'text-green-600';
                icon = 'check-circle';
                message = '高確信度マッチング';
                break;
            case ConfidenceLevel.MEDIUM:
                colorClass = 'text-blue-500';
                icon = 'info-circle';
                message = '中確信度マッチング';
                break;
            case ConfidenceLevel.LOW:
                colorClass = 'text-yellow-500';
                icon = 'exclamation-circle';
                message = '低確信度マッチング';
                break;
            case ConfidenceLevel.VERY_LOW:
                colorClass = 'text-red-500';
                icon = 'times-circle';
                message = '非常に低い確信度';
                break;
        }

        return { level, colorClass, icon, message };
    }
} 