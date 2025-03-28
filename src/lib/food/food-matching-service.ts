import { Food, FoodMatchResult, ConfidenceLevel } from '@/types/food';
//src\lib\food\food-matching-service.ts
/**
 * 食品マッチングサービスのインターフェース
 */
export interface FoodMatchingService {
    /**
     * 食品名から最適な食品データをマッチング
     * @param name 食品名
     * @param options マッチングオプション
     * @returns マッチング結果
     */
    matchFood(
        name: string,
        options?: MatchingOptions
    ): Promise<FoodMatchResult | null>;

    /**
     * 複数の食品名を一括でマッチング
     * @param names 食品名リスト
     * @param options マッチングオプション
     * @returns マッチング結果のマップ (入力名 -> マッチング結果)
     */
    matchFoods(
        names: string[],
        options?: MatchingOptions
    ): Promise<Map<string, FoodMatchResult | null>>;

    /**
     * 確信度に基づいて視覚的表示情報を取得
     * @param confidence 確信度スコア
     * @returns 視覚的表示情報
     */
    getConfidenceDisplay(confidence: number): ConfidenceDisplay;

    /**
     * 確信度レベルを取得
     * @param confidence 確信度スコア
     * @returns 確信度レベルまたはnull（閾値未満の場合）
     */
    getConfidenceLevel(confidence: number): ConfidenceLevel | null;
}

/**
 * マッチングオプション
 */
export interface MatchingOptions {
    /** 最低類似度閾値 (0.0-1.0) */
    minSimilarity?: number;

    /** 結果の最大数 */
    limit?: number;

    /** カテゴリ制限 */
    category?: string;

    /** 厳密モード (完全一致のみ) */
    strictMode?: boolean;
}

/**
 * 確信度の視覚表示情報
 */
export interface ConfidenceDisplay {
    /** 確信度レベル */
    level: ConfidenceLevel | null;

    /** 表示色 (CSSクラス) */
    colorClass: string;

    /** アイコン名 */
    icon: string;

    /** 表示メッセージ */
    message: string;
}

/**
 * 確信度レベルの閾値定義
 */
export const CONFIDENCE_THRESHOLDS = {
    HIGH: 0.85,    // 高確信度 (85%以上)
    MEDIUM: 0.7,   // 中確信度 (70%以上85%未満)
    LOW: 0.5,      // 低確信度 (50%以上70%未満)
    VERY_LOW: 0.35 // 非常に低い確信度 (35%以上50%未満)
}; 