// src/types/ai.ts
import { FoodInputParseResult } from '@/lib/food/food-input-parser'; // Assuming this path is correct

/**
 * AIによる食品解析結果の基本的な構造 (パーサーが返す形式)
 */
export interface AIParseResult {
    /** 解析された食品リスト */
    foods: FoodInputParseResult[];
    /** 全体の信頼度スコア */
    confidence: number;
    /** 解析中に発生したエラーメッセージ */
    error?: string;
    /** デバッグ情報（オプション） */
    debug?: {
        rawResponse?: string;
        jsonText?: string;
        parsedData?: any;
        [key: string]: unknown;
    };
}

/**
 * 食品分析結果の型 (APIレスポンスやサービス内部で利用)
 */
export interface FoodAnalysisResult {
    foods: Array<{
        name: string;
        quantity: string;
        confidence: number;
    }>;
    nutrition: {
        calories: number;
        protein: number;
        iron: number;
        folic_acid: number;
        calcium: number;
        vitamin_d?: number; // オプションに変更
        confidence_score: number;
    };
    meta?: {
        notFoundFoods?: string[];
        warning?: string;
        source?: string;
        searchDetail?: string;
        calculationTime?: string;
        matchedFoods?: Array<{
            original: string;
            matched: string;
            similarity: number;
        }>;
        possibleMatches?: Array<{
            original: string;
            suggestion: string;
            similarity: number;
        }>;
        errors?: string[];
        [key: string]: unknown;
    };
}

/**
 * AIからのレスポンスを解析するための内部型定義 (FoodAnalysisResult に統合検討)
 * @deprecated Consider merging into FoodAnalysisResult or refining usage.
 */
export interface FoodAnalysisInput {
    foods?: Array<{
        name: string;
        quantity?: string;
        confidence?: number;
    }>;
    enhancedFoods?: Array<{
        name: string;
        quantity?: string;
        confidence?: number;
    }>;
    nutrition?: {
        calories: number;
        protein: number;
        iron: number;
        folic_acid: number;
        calcium: number;
        vitamin_d?: number;
        confidence_score: number;
    };
    meta?: {
        [key: string]: unknown;
    };
}


/**
 * 栄養アドバイス結果の型
 */
export interface NutritionAdviceResult {
    summary: string;
    detailedAdvice?: string;
    recommendedFoods?: Array<{
        name: string;
        benefits: string;
    }>;
}

/**
 * 食品入力の型 (テキスト入力用)
 */
export interface FoodInput {
    name: string;
    quantity?: string;
}

/**
 * AI処理結果 (V2 インターフェースで使用)
 * @deprecated This might be superseded by specific service return types. Review needed.
 */
export interface AIProcessResult {
    /** 解析結果 */
    parseResult: AIParseResult;
    /** 生のAI応答 */
    rawResponse: string;
    /** 処理時間（ミリ秒） */
    processingTimeMs: number;
    /** エラーメッセージ */
    error?: string;
}

/**
 * 新しいAIサービスのインターフェース (V2)
 * @deprecated Review if this interface is still the target design.
 */
export interface AIServiceV2 {
    /**
     * 食事画像から食品を解析
     * @param imageData 画像データ
     * @returns 解析結果
     */
    analyzeMealImage(imageData: unknown): Promise<AIProcessResult>;

    /**
     * テキスト入力から食品を解析
     * @param text テキスト入力
     * @returns 解析結果
     */
    analyzeMealText(text: string): Promise<AIProcessResult>;

    /**
     * レシピテキストから食品を解析
     * @param recipeText レシピテキスト
     * @returns 解析結果
     */
    analyzeRecipeText(recipeText: string): Promise<AIProcessResult>;
} 