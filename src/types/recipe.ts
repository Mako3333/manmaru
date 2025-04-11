// レシピ関連の型定義
import { StandardizedMealNutrition } from './nutrition'; // StandardizedMealNutrition をインポート

// クリップしたレシピの型
export interface ClippedRecipe {
    id: string;
    user_id: string;
    title: string;
    image_url?: string | undefined;
    source_url: string;
    source_platform?: string | undefined;
    content_id?: string | undefined;
    recipe_type?: string | undefined;
    ingredients: RecipeIngredient[];
    nutrition_per_serving: StandardizedMealNutrition;
    caution_foods?: string[] | undefined;
    caution_level?: 'low' | 'medium' | 'high' | undefined;
    is_favorite: boolean;
    servings: number;
    clipped_at: string;
    last_used_at?: string | undefined;
    created_at: string;
    updated_at: string;
    is_social_media?: boolean | undefined;
    use_placeholder?: boolean | undefined;
}

// レシピの材料
export interface RecipeIngredient {
    name: string;
    quantity?: string;
    unit?: string;
}

// 栄養データ (削除 - StandardizedMealNutrition を使用)
// export interface NutritionData { ... }

// 妊婦向け注意食材の型
export interface CautionFood {
    id: string;
    food_name: string;
    category: string;
    caution_level: 'low' | 'medium' | 'high';
    reason: string;
    alternative_suggestion?: string;
    created_at: string;
    updated_at: string;
}

// 食事記録とレシピの関連の型
export interface MealRecipeEntry {
    id: string;
    meal_id: string;
    clipped_recipe_id: string;
    portion_size: number;
    created_at: string;
    updated_at: string;
}

// レシピの表示用の簡易型
export interface RecipeCard {
    id: string;
    title: string;
    image_url?: string;
    recipe_type?: string;
    nutrition_focus?: string[];
    is_favorite: boolean;
    caution_level?: 'low' | 'medium' | 'high';
    source_platform?: string;
    content_id?: string;
    use_placeholder?: boolean;
}

// URLクリップ時のリクエストデータ型
export interface RecipeUrlClipRequest {
    url: string;
}

// URLクリップ時のレスポンスデータ型
// src/app/api/v2/recipe/parse のレスポンス形式に合わせる
export interface RecipeUrlClipResponse {
    recipe: {
        title: string;
        servings: string | null;
        servingsNum: number;
        ingredients: RecipeIngredient[];
        sourceUrl: string;
        imageUrl?: string;
    };
    nutritionResult: {
        nutrition: StandardizedMealNutrition;
        perServing?: StandardizedMealNutrition;
        legacyNutrition?: import('@/types/nutrition').NutritionData; // 古い型も念のため保持
        legacyPerServing?: import('@/types/nutrition').NutritionData;
        reliability: {
            confidence: number;
            completeness: number;
        };
        matchResults?: any[]; // 必要であれば NutritionService の FoodMatchResult 型をインポート
    };
    // 以下のプロパティはAPIレスポンスには含まれないが、クリップ処理中にフロントエンドで付与される可能性があるため残す
    image_url?: string | undefined;
    source_platform?: string;
    caution_foods?: string[];
    caution_level?: 'low' | 'medium' | 'high';
    content_id?: string;
    is_social_media?: boolean;
    description?: string;
    use_placeholder?: boolean;
    recipe_type?: string; // handleRecipeTypeChange で設定される
}

// レシピ編集フォームデータ型
export interface RecipeFormData {
    title: string;
    recipe_type: string;
    servings: number;
    ingredients: RecipeIngredient[];
    nutrition_per_serving: StandardizedMealNutrition;
}

// レシピフィルターオプション型
export interface RecipeFilterOptions {
    recipe_type?: string[];
    nutrition_focus?: string[];
    caution_level?: 'low' | 'medium' | 'high';
    is_favorite?: boolean;
    search_query?: string;
}

// 食事記録からのレシピ登録データ型
export interface RecipeToMealData {
    recipe_id: string;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    portion_size: number;
    meal_date: string;
} 