import { BasicNutritionData, NutritionData, FoodItem, MealType, FoodCategory } from './nutrition';

/**
 * 食事データの基本インターフェース
 */
export interface Meal {
    id: string;
    user_id: string;
    meal_type: string;
    meal_date: string;
    photo_url: string | null;
    food_description: { items: FoodItem[] };
    nutrition_data: NutritionData;
    servings: number;
    created_at: string;
    updated_at: string | null;
}

/**
 * 食事作成時のデータ
 */
export interface MealCreateData {
    meal_type: string;
    meal_date?: string;
    photo_url?: string;
    foods: FoodItem[];
    nutrition: NutritionData;
    servings?: number;
}

/**
 * 食事と栄養素データを含む拡張インターフェース
 */
export interface MealWithNutrients extends Meal {
    nutrients: {
        id: string;
        meal_id: string;
        calories: number;
        protein: number;
        iron: number;
        folic_acid: number;
        calcium: number;
        vitamin_d: number;
        confidence_score: number;
        created_at: string;
    };
}

/**
 * 日付ごとの食事集計
 */
export interface DailyMealSummary {
    date: string;
    meals: Meal[];
    total_nutrition: BasicNutritionData;
}
