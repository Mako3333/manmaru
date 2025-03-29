import { ErrorCode, AnyErrorCode } from '@/lib/error';
import type { ApiResponse, ApiState, SuccessResponse, ErrorResponse } from './api';

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

// 栄養素の信頼性情報インターフェース
export interface NutritionReliability {
    confidence: number;
    balanceScore?: number;
    completeness: number;
}

// 栄養素データインターフェース
export interface NutritionData {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d: number;
    extended_nutrients?: {
        fat: number;
        carbohydrate: number;
        [key: string]: number;
    };
}

// 食品認識結果インターフェース
export interface RecognizedFood {
    name: string;
    quantity: string;
    confidence: number;
}

// 栄養計算結果インターフェース
export interface NutritionResult {
    nutrition: NutritionData;
    reliability: NutritionReliability;
    matchResults?: any[];
    perServing?: NutritionData;
}

// 食事解析結果インターフェース
export interface MealAnalysisResult {
    foods: RecognizedFood[];
    nutritionResult: NutritionResult;
    processingTimeMs?: number;
}

// レシピ解析結果インターフェース
export interface RecipeAnalysisResult {
    recipe: {
        title: string;
        servings: number;
        ingredients: RecognizedFood[];
    };
    nutritionResult: NutritionResult;
}

// 栄養アドバイスインターフェース
export interface NutritionAdvice {
    advice: {
        summary: string;
        details: {
            nutrient: string;
            status: string;
            recommendation: string;
            importance: string;
        }[];
        weekInfo: {
            week: number;
            keyNutrients: string[];
            developmentStage: string;
        };
    };
    timestamp: string;
}

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