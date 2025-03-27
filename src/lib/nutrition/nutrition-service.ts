import { Food, FoodQuantity, MealFoodItem } from '@/types/food';
import { NutritionCalculationResult, NutrientData } from '@/types/nutrition';

/**
 * 栄養計算サービスのインターフェース
 * 食品から栄養素を計算し、栄養バランスを評価する機能を提供
 */
export interface NutritionService {
    /**
     * 食品リストから栄養素を計算する
     * @param foodItems 食品アイテムのリスト
     * @returns 計算された栄養素データ
     */
    calculateNutrition(foodItems: MealFoodItem[]): Promise<NutritionCalculationResult>;

    /**
     * 食品名と量のリストから栄養素を計算する
     * @param foodNameQuantities 食品名と量のリスト
     * @returns 計算された栄養素データ
     */
    calculateNutritionFromNameQuantities(
        foodNameQuantities: Array<{ name: string; quantity?: string }>
    ): Promise<NutritionCalculationResult>;

    /**
     * 単一の食品の栄養素を計算する
     * @param food 食品データ
     * @param quantity 量
     * @returns 計算された栄養素データと信頼度
     */
    calculateSingleFoodNutrition(
        food: Food,
        quantity: FoodQuantity
    ): Promise<{ nutrition: NutrientData; confidence: number }>;

    /**
     * 栄養バランスを評価する
     * @param nutrition 栄養素データ
     * @returns バランススコア（0-100）
     */
    evaluateNutritionBalance(nutrition: NutrientData): number;

    /**
     * 不足している栄養素を特定する
     * @param nutrition 栄養素データ
     * @param targetValues 目標値
     * @returns 不足している栄養素のリスト
     */
    identifyDeficientNutrients(nutrition: NutrientData, targetValues: Partial<NutrientData>): string[];
} 