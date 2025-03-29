import { Food, FoodMatchResult } from '@/types/food';
import { NutritionData, NutritionCalculationResult } from '@/types/nutrition';
import { MealType } from '@/types/nutrition';

/**
 * 食品テキスト解析 API
 */
export namespace FoodParseApi {
    export interface Request {
        text: string;  // 解析するテキスト
    }

    export interface Response {
        foods: Array<{
            name: string;       // 食品名
            quantity?: string;  // 量（テキスト形式）
            confidence?: number; // 信頼度
        }>;
        nutritionResult: NutritionCalculationResult;
        processingTimeMs?: number;
    }
}

/**
 * 画像解析 API
 */
export namespace ImageAnalyzeApi {
    export interface Request {
        image: string;       // Base64エンコードされた画像データ
        meal_type: MealType; // 食事タイプ
    }

    export interface Response {
        foods: Array<{
            name: string;       // 食品名
            quantity?: string;  // 量（テキスト形式）
            confidence?: number; // 信頼度
        }>;
        nutritionResult: NutritionCalculationResult;
        processingTimeMs?: number;
    }
}

/**
 * レシピ解析 API
 */
export namespace RecipeParseApi {
    export interface Request {
        url: string;  // 解析するレシピURL
    }

    export interface Response {
        recipe: {
            title: string;                     // レシピタイトル
            url: string;                      // 元のURL
            imageUrl?: string;               // レシピ画像URL
            servings?: number;               // 何人前か
            ingredientGroups: Array<{        // 材料グループ
                name?: string;                 // グループ名
                ingredients: Array<{           // 材料リスト
                    name: string;                // 材料名
                    quantity: string;            // 量
                    note?: string;               // 備考
                }>
            }>;
            steps?: string[];                // 調理手順
            source?: string;                 // レシピソース（サイト名）
            parsedDateTime: string;          // 解析日時
        };
        nutritionResult: NutritionCalculationResult;
        processingTimeMs?: number;
    }
}

/**
 * 共通の食品マッチング結果レスポンス
 */
export interface FoodMatchResponse {
    matchedFoods: FoodMatchResult[];
    notFoundFoods: string[];
}

/**
 * 栄養計算 API
 */
export namespace NutritionCalculationApi {
    export interface Request {
        foodItems: Array<{
            name: string;      // 食品名
            quantity: string;  // 量（テキスト形式）
        }>;
    }

    export interface Response {
        nutrition: NutritionData;
        matchResults: FoodMatchResult[];
        reliability: {
            confidence: number;      // 全体の確信度 (0.0-1.0)
            balanceScore: number;    // 栄養バランススコア (0-100)
            completeness: number;    // データの完全性 (0.0-1.0)
        };
    }
} 