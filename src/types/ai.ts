// src/types/ai.ts
import { FoodInputParseResult } from '@/lib/food/food-input-parser'; // Assuming this path is correct
import { ErrorCode, AnyErrorCode } from '@/lib/error'; // ErrorCode と AnyErrorCode をインポート
import { Food, FoodQuantity, FoodMatchResult } from '@/types/food'; // Food, FoodQuantity, FoodMatchResult をインポート
import { StandardizedMealNutrition, NutritionData } from '@/types/nutrition'; // StandardizedMealNutrition と NutritionData をインポート
import type { AnyErrorCode as AnyErrorCodeCodes } from '@/lib/error/codes/error-codes'; // Assuming AnyErrorCode is here

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
        parsedData?: unknown;
        [key: string]: unknown;
    };
}

/**
 * 食品分析結果の型 (APIレスポンスやサービス内部で利用)
 * NutritionService の processParsedFoods メソッドの戻り値としても使用される
 */
export interface FoodAnalysisResult {
    foods: Array<{
        /** オリジナルの入力食品名 */
        name: string;
        /** 解析された量の文字列 (例: "100g", "1個") または null */
        quantity: string | null;
        /** マッチングされた食品データベースのID (見つからない場合は undefined) */
        matchedFoodId?: string;
        /** マッチングの信頼度 (0.0 - 1.0) */
        matchConfidence?: number;
        /** @deprecated Use matchConfidence instead */
        confidence?: number; // 古いプロパティ、matchConfidence に移行
    }>;
    /** 計算された栄養データ (標準化形式) */
    nutrition: StandardizedMealNutrition;
    /** 信頼性情報 */
    reliability: {
        confidence: number;
        balanceScore?: number;
        completeness?: number;
    };
    /** 食品マッチング結果の詳細 */
    matchResults: FoodMatchResult[]; // FoodMatchResult 配列に変更
    /** AIが推定した栄養データ (標準化形式、オプショナル) */
    aiEstimatedNutrition?: StandardizedMealNutrition;

    /** @deprecated Use reliability and nutrition directly */
    // 古い nutrition 構造 (削除)
    // nutrition: {
    //     calories: number;
    //     protein: number;
    //     iron: number;
    //     folic_acid: number;
    //     calcium: number;
    //     vitamin_d?: number; // オプションに変更
    //     confidence_score: number;
    // };

    /** @deprecated Use matchResults and reliability directly */
    // 古い meta 構造 (関連情報はトップレベルに移動)
    // meta?: {
    //     notFoundFoods?: string[];
    //     warning?: string;
    //     source?: string;
    //     searchDetail?: string;
    //     calculationTime?: string;
    //     matchedFoods?: Array<{
    //         original: string;
    //         matched: string;
    //         similarity: number;
    //     }>;
    //     possibleMatches?: Array<{
    //         original: string;
    //         suggestion: string;
    //         similarity: number;
    //     }>;
    //     errors?: string[];
    //     [key: string]: unknown;
    // };
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
    detailedAdvice?: string | undefined;
    recommendedFoods?: Array<{
        name: string;
        description: string;
    }> | undefined;
    /** デバッグ情報（オプショナル） */
    debug?: unknown;
    /** エラー情報（オプショナル） */
    error?: { message: string; code?: AnyErrorCodeCodes; details?: unknown } | undefined;
}

/**
 * IAIService.analyzeMealImage / analyzeMealText の標準的な戻り値型
 */
export interface MealAnalysisResult {
    /** 解析された食品リスト */
    foods: FoodInputParseResult[];
    /** 全体の信頼度スコア（オプショナル） */
    confidence?: number | undefined;
    /** AIによる栄養素推定値（オプショナル）*/
    estimatedNutrition?: { [key: string]: number | string } | undefined;
    /** エラー情報（オプショナル） */
    error?: { message: string; code?: string | undefined; details?: unknown } | undefined;
    /** デバッグ情報（オプショナル） */
    debug?: unknown;
}

/**
 * IAIService.parseRecipeFromUrl の標準的な戻り値型
 */
export interface RecipeAnalysisResult {
    /** レシピタイトル（オプショナル） */
    title?: string | undefined;
    /** 何人分か（オプショナル） */
    servings?: string | undefined;
    /** 解析された材料リスト */
    ingredients: FoodInputParseResult[];
    /** エラー情報（オプショナル） */
    error?: { message: string; code?: string | undefined; details?: unknown } | undefined;
    /** デバッグ情報（オプショナル） */
    debug?: unknown;
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