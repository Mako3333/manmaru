import { Food } from '@/types/food';
import { FoodQuantity } from '@/types/food';
import { StandardizedMealNutrition, NutritionCalculationResult } from '@/types/nutrition';
import { FoodMatchResult, MealFoodItem } from '@/types/food';

export interface NutritionService {
    /**
     * MealFoodItem の配列から栄養素を計算する
     */
    calculateNutrition(foodItems: MealFoodItem[]): Promise<NutritionCalculationResult>;

    /**
     * 食品名と量のリストから栄養素を計算する
     * @param foodNameQuantities 食品名と量のリスト
     * @param servingsNum レシピの人数 (オプション、バリデーション用)
     * @returns 計算された栄養素データ
     */
    calculateNutritionFromNameQuantities(
        foodNameQuantities: Array<{ name: string; quantity?: string }>,
        servingsNum?: number
    ): Promise<NutritionCalculationResult>;

    /**
     * 単一の食品の栄養素を計算する
     */
    calculateSingleFoodNutrition(
        food: Food,
        quantity: FoodQuantity,
        category?: string
    ): Promise<{ nutrition: StandardizedMealNutrition; confidence: number }>;

    /**
     * 栄養バランススコアを評価する
     */
    evaluateNutritionBalance(nutrition: StandardizedMealNutrition, targetValues: Record<string, number>): number;

    /**
     * 不足している栄養素を特定する
     */
    identifyDeficientNutrients(nutrition: StandardizedMealNutrition, targetValues: Record<string, number>, threshold?: number): Array<{
        nutrientCode: string;
        fulfillmentRatio: number;
        currentValue: number;
        targetValue: number;
    }>;

    /**
     * 食品名によるあいまい検索を行う (移譲されたメソッド)
     */
    searchFoodsByFuzzyMatch(name: string, limit?: number): Promise<FoodMatchResult[]>;
} 