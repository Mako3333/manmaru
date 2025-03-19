// レシピ関連の型定義

// クリップしたレシピの型
export interface ClippedRecipe {
    id: string;
    user_id: string;
    title: string;
    image_url?: string;
    source_url: string;
    source_platform?: string;
    content_id?: string;
    recipe_type?: string;
    ingredients: RecipeIngredient[];
    nutrition_per_serving: NutritionData;
    caution_foods?: string[];
    caution_level?: 'low' | 'medium' | 'high';
    is_favorite: boolean;
    servings: number;
    clipped_at: string;
    last_used_at?: string;
    created_at: string;
    updated_at: string;
    is_social_media?: boolean;
    use_placeholder?: boolean;
}

// レシピの材料
export interface RecipeIngredient {
    name: string;
    quantity?: string;
    unit?: string;
}

// 栄養データ
export interface NutritionData {
    calories?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    iron?: number;
    folic_acid?: number;
    calcium?: number;
    vitamin_d?: number;
    [key: string]: number | undefined; // その他の栄養素
}

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
export interface RecipeUrlClipResponse {
    title: string;
    image_url?: string;
    source_url: string;
    source_platform?: string;
    ingredients: RecipeIngredient[];
    nutrition_per_serving: NutritionData;
    caution_foods?: string[];
    caution_level?: 'low' | 'medium' | 'high';
    content_id?: string;
    is_social_media?: boolean;
    description?: string;
    use_placeholder?: boolean;
}

// レシピ編集フォームデータ型
export interface RecipeFormData {
    title: string;
    recipe_type: string;
    servings: number;
    ingredients: RecipeIngredient[];
    nutrition_per_serving: NutritionData;
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