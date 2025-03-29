import { Food, FoodQuantity, MealFoodItem } from '@/types/food';
import { NutritionCalculationResult, NutritionData } from '@/types/nutrition';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';
import { FoodAnalysisResult } from '@/types/ai';
//src\lib\nutrition\nutrition-service.ts
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
    ): Promise<{ nutrition: NutritionData; confidence: number }>;

    /**
     * 栄養バランスを評価する
     * @param nutrition 栄養素データ
     * @returns バランススコア（0-100）
     */
    evaluateNutritionBalance(nutrition: NutritionData): number;

    /**
     * 不足している栄養素を特定する
     * @param nutrition 栄養素データ
     * @param targetValues 目標値
     * @returns 不足している栄養素のリスト
     */
    identifyDeficientNutrients(nutrition: NutritionData, targetValues: Partial<NutritionData>): string[];

    /**
     * AIレスポンスパーサーからの解析結果を処理し、栄養計算と結果強化を行う
     * @param parsedFoods AIによって解析された食品リスト (名前、量、確信度などを含む)
     * @returns 食品のマッチング、栄養計算、メタデータを含む最終的な分析結果
     */
    processParsedFoods(parsedFoods: FoodInputParseResult[]): Promise<FoodAnalysisResult>;
} 