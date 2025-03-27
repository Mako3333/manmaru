import { Food, FoodMatchResult, ConfidenceLevel } from '@/types/food';
import {
    FoodMatchingService,
    MatchingOptions,
    ConfidenceDisplay,
    CONFIDENCE_THRESHOLDS
} from './food-matching-service';
import { FoodRepository } from './food-repository';
import { FoodRepositoryFactory, FoodRepositoryType } from './food-repository-factory';

/**
 * 食品マッチングサービスの実装
 */
export class FoodMatchingServiceImpl implements FoodMatchingService {
    private foodRepository: FoodRepository;

    /**
     * コンストラクタ
     * @param repositoryType 使用する食品リポジトリのタイプ
     */
    constructor(repositoryType: FoodRepositoryType = FoodRepositoryType.BASIC) {
        this.foodRepository = FoodRepositoryFactory.getRepository(repositoryType);
    }

    /**
     * 食品名から最適な食品データをマッチング
     */
    async matchFood(
        name: string,
        options?: MatchingOptions
    ): Promise<FoodMatchResult | null> {
        if (!name || name.trim() === '') return null;

        const normalizedName = name.trim();

        // オプションのデフォルト値
        const minSimilarity = options?.minSimilarity ?? 0.35;
        const strictMode = options?.strictMode ?? false;

        // 1. 厳密モードまたは完全一致を優先
        if (strictMode) {
            const exactMatch = await this.foodRepository.getFoodByExactName(normalizedName);
            if (exactMatch) {
                return {
                    food: exactMatch,
                    matchedFood: exactMatch,
                    similarity: 1.0,
                    confidence: 1.0,
                    originalInput: normalizedName,
                    inputName: normalizedName
                };
            }
            return null;
        }

        // 2. 通常の完全一致チェック
        const exactMatch = await this.foodRepository.getFoodByExactName(normalizedName);
        if (exactMatch) {
            return {
                food: exactMatch,
                matchedFood: exactMatch,
                similarity: 1.0,
                confidence: 1.0,
                originalInput: normalizedName,
                inputName: normalizedName
            };
        }

        // 3. カテゴリ制限がある場合、部分一致検索で事前フィルタリング
        let candidateFoods: Food[] = [];
        if (options?.category) {
            const categoryFoods = await this.foodRepository.searchFoodsByCategory(options.category);
            // カテゴリ内で部分一致するものを検索
            candidateFoods = categoryFoods.filter(food =>
                food.name.includes(normalizedName) ||
                normalizedName.includes(food.name) ||
                food.aliases.some(alias =>
                    alias.includes(normalizedName) || normalizedName.includes(alias)
                )
            );
        }

        // 4. ファジー検索でマッチング
        const limit = options?.limit ?? 1;
        const fuzzyResults = await this.foodRepository.searchFoodsByFuzzyMatch(
            normalizedName,
            candidateFoods.length > 0 ? Math.max(limit, candidateFoods.length) : limit
        );

        // 5. カテゴリフィルタリングと結果の結合
        let results = fuzzyResults;
        if (candidateFoods.length > 0) {
            // カテゴリでフィルタリングされた結果を優先
            const categoryMatchIds = new Set(candidateFoods.map(food => food.id));
            const categoryMatches = fuzzyResults.filter(result =>
                categoryMatchIds.has(result.food.id)
            );

            if (categoryMatches.length > 0) {
                results = categoryMatches;
            }
        }

        // 6. 結果の評価と返却
        if (results.length > 0 && results[0].similarity >= minSimilarity) {
            // confidence = similarity として設定（互換性のため）
            const result = results[0];
            return {
                ...result,
                matchedFood: result.food,
                confidence: result.similarity,
                inputName: normalizedName
            };
        }

        return null;
    }

    /**
     * 複数の食品名を一括でマッチング
     */
    async matchFoods(
        names: string[],
        options?: MatchingOptions
    ): Promise<Map<string, FoodMatchResult | null>> {
        const results = new Map<string, FoodMatchResult | null>();

        // 各食品名について並行処理
        const matchPromises = names.map(async (name) => {
            const result = await this.matchFood(name, options);
            return { name, result };
        });

        // 全ての処理を待機
        const matchResults = await Promise.all(matchPromises);

        // 結果をマップに格納
        for (const { name, result } of matchResults) {
            results.set(name, result);
        }

        return results;
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
        } else {
            return null; // 最低閾値未満
        }
    }

    /**
     * 確信度に基づいて視覚的表示情報を取得
     */
    getConfidenceDisplay(confidence: number): ConfidenceDisplay {
        const level = this.getConfidenceLevel(confidence);

        switch (level) {
            case ConfidenceLevel.HIGH:
                return {
                    level,
                    colorClass: 'text-green-600',
                    icon: 'check-circle',
                    message: '高確信度'
                };

            case ConfidenceLevel.MEDIUM:
                return {
                    level,
                    colorClass: 'text-blue-600',
                    icon: 'info-circle',
                    message: '中確信度'
                };

            case ConfidenceLevel.LOW:
                return {
                    level,
                    colorClass: 'text-yellow-600',
                    icon: 'exclamation-triangle',
                    message: '低確信度 - 確認をお勧めします'
                };

            case ConfidenceLevel.VERY_LOW:
                return {
                    level,
                    colorClass: 'text-orange-600',
                    icon: 'exclamation-circle',
                    message: '非常に低い確信度 - 手動確認が必要です'
                };

            default:
                return {
                    level: null,
                    colorClass: 'text-red-600',
                    icon: 'times-circle',
                    message: 'マッチング不可 - 手動入力が必要です'
                };
        }
    }
} 