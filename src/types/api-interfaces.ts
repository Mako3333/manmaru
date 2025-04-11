import { ErrorCode, AnyErrorCode } from '@/lib/error';
import type { ApiResponse, ApiState, SuccessResponse, ErrorResponse } from './api';
import type {
    NutritionData as ImportedNutritionData,
    NutritionReliability,
    // RecognizedFood, // Removed import
    StandardizedMealNutrition,
    NutritionAdvice // Assuming NutritionAdvice is in nutrition.ts or another specific file
} from '@/types/nutrition'; // Adjust path if needed
import type { RecognizedFood } from '@/types/ai'; // Added import
// If MealAnalysisResult and RecipeAnalysisResult are defined elsewhere, import them too
// import type { MealAnalysisResult } from '@/types/meal'; // Example
// import type { RecipeAnalysisResult } from '@/types/recipe'; // Example

export type { ApiResponse, ApiState, SuccessResponse, ErrorResponse };

/**
 * APIエンドポイント情報
 */
export interface ApiEndpoint {
    /** エンドポイントID */
    id: string;
    /** エンドポイントのタイトル */
    title: string;
    /** HTTP メソッド */
    method: string;
    /** エンドポイントURL */
    endpoint: string;
    /** 説明 */
    description: string;
    /** リクエストボディの例 */
    requestExample: string;
    /** レスポンスの例 */
    responseExample: string;
    /** 必須フィールド */
    requiredFields?: string[];
    /** オプションフィールド */
    optionalFields?: string[];
    /** 注意事項 */
    notes?: string[];
    /** 非推奨フラグ */
    deprecated?: boolean;
    /** バージョン情報 */
    version?: string;
}

/**
 * APIリクエスト設定
 */
export interface ApiRequestConfig {
    /** ベースURL */
    baseUrl?: string;
    /** ヘッダー */
    headers?: Record<string, string>;
    /** タイムアウト（ミリ秒） */
    timeout?: number;
    /** 認証トークン */
    authToken?: string;
}

/**
 * ページネーションリクエストパラメータ
 */
export interface PaginationParams {
    /** ページ番号 */
    page: number;
    /** ページサイズ */
    pageSize: number;
}

/**
 * ページネーションメタデータ
 */
export interface PaginationMeta {
    /** 現在のページ */
    currentPage: number;
    /** ページサイズ */
    pageSize: number;
    /** 総ページ数 */
    totalPages: number;
    /** 総アイテム数 */
    totalItems: number;
}

// Restore local definition for NutritionReliability
// export interface NutritionReliability {
//     confidence: number;
//     balanceScore?: number;
//     completeness: number;
// }

// NutritionData is imported, remove local definition
// export interface NutritionData { ... }

// Restore local definition for RecognizedFood
// export interface RecognizedFood {
//     name: string;
//     quantity: string;
//     confidence: number;
// }

// NutritionResult uses imported types and restored local types
export interface NutritionResult {
    nutrition: StandardizedMealNutrition; // Use imported type directly
    reliability: NutritionReliability; // Use restored local type
    matchResults?: unknown[];
}

// MealAnalysisResult uses restored local RecognizedFood and updated NutritionResult
export interface MealAnalysisResult {
    foods: RecognizedFood[]; // Use restored local type
    nutritionResult: NutritionResult;
    processingTimeMs?: number;
}

// RecipeAnalysisResult uses restored local RecognizedFood and updated NutritionResult
export interface RecipeAnalysisResult {
    recipe: {
        title: string;
        servings: number;
        ingredients: RecognizedFood[]; // Use restored local type
    };
    nutritionResult: NutritionResult;
}

// NutritionAdvice is imported, remove local definition
// export interface NutritionAdvice { ... }

// リクエスト用インターフェース
export interface MealAnalysisRequest {
    text?: string;
    image?: string;
    meal_type?: string;
}

export interface FoodParseRequest {
    text: string;
}

export interface RecipeParseRequest {
    url: string;
}

export interface NutritionAdviceRequest {
    date?: string;
    force?: boolean;
    detail?: boolean;
}

export interface StandardApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: AnyErrorCode;
        message: string;
        userMessage?: string;
        details?: unknown;
        suggestions?: string[];
    };
    meta?: {
        processingTimeMs: number;
        warning?: string;
    };
}

