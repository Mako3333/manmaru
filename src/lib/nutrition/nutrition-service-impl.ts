import { Food, FoodQuantity, MealFoodItem, FoodMatchResult } from '@/types/food';
import { NutritionCalculationResult, NutrientData } from '@/types/nutrition';
import { FoodRepository } from '@/lib/food/food-repository';
import { NutritionService } from './nutrition-service';
import { QuantityParser } from './quantity-parser';

/**
 * 栄養計算サービスの実装クラス
 */
export class NutritionServiceImpl implements NutritionService {
    /**
     * コンストラクタ
     * @param foodRepository 食品リポジトリ
     */
    constructor(private readonly foodRepository: FoodRepository) { }

    /**
     * 食品リストから栄養素を計算する
     * @param foodItems 食品アイテムのリスト
     * @returns 計算された栄養素データ
     */
    async calculateNutrition(foodItems: MealFoodItem[]): Promise<NutritionCalculationResult> {
        // 信頼度の合計と栄養素の累積を初期化
        let totalConfidence = 0;
        const totalNutrients: NutrientData = this.initializeNutrientData();
        const matchResults: FoodMatchResult[] = [];

        // 各食品に対して栄養素を計算し累積する
        for (const item of foodItems) {
            // 食品を取得
            const food = item.food;

            // 単一食品の栄養素を計算
            const { nutrition, confidence } = await this.calculateSingleFoodNutrition(
                food,
                item.quantity
            );

            // 栄養素を累積
            this.accumulateNutrients(totalNutrients, nutrition);

            // 信頼度を加重平均のために加算
            totalConfidence += confidence;

            // マッチング結果を記録
            matchResults.push({
                inputName: item.originalInput || food.name,
                matchedFood: food,
                food: food,
                similarity: confidence,
                confidence,
                originalInput: item.originalInput || food.name
            });
        }

        // 信頼度の平均を計算
        const averageConfidence = foodItems.length > 0 ? totalConfidence / foodItems.length : 0;

        // 栄養バランススコアの計算
        const balanceScore = this.evaluateNutritionBalance(totalNutrients);

        return {
            nutrients: totalNutrients,
            reliability: {
                confidence: averageConfidence,
                balanceScore,
                completeness: this.calculateCompleteness(totalNutrients)
            },
            matchResults
        };
    }

    /**
     * 食品名と量のリストから栄養素を計算する
     * @param foodNameQuantities 食品名と量のリスト
     * @returns 計算された栄養素データ
     */
    async calculateNutritionFromNameQuantities(
        foodNameQuantities: Array<{ name: string; quantity?: string }>
    ): Promise<NutritionCalculationResult> {
        // MealFoodItem 形式に変換
        const foodItems: MealFoodItem[] = [];

        for (const item of foodNameQuantities) {
            // 名前から食品を検索
            const foodMatches = await this.foodRepository.searchFoodsByFuzzyMatch(item.name);

            if (foodMatches.length > 0) {
                // 最もマッチする食品を使用
                const bestMatch = foodMatches[0].food;

                // 量を解析
                const parsedQuantity = QuantityParser.parseQuantity(
                    item.quantity,
                    bestMatch.name,
                    bestMatch.category
                );

                // MealFoodItem を作成
                foodItems.push({
                    foodId: bestMatch.id,
                    food: bestMatch,
                    quantity: parsedQuantity.quantity,
                    confidence: parsedQuantity.confidence,
                    originalInput: item.name
                });
            }
        }

        // 食品リストの栄養素を計算
        return this.calculateNutrition(foodItems);
    }

    /**
     * 単一の食品の栄養素を計算する
     * @param food 食品データ
     * @param quantity 量
     * @returns 計算された栄養素データと信頼度
     */
    async calculateSingleFoodNutrition(
        food: Food,
        quantity: FoodQuantity
    ): Promise<{ nutrition: NutrientData; confidence: number }> {
        // 量をグラムに変換
        const { grams, confidence: quantityConfidence } = QuantityParser.convertToGrams(
            quantity,
            food.name,
            food.category
        );

        // 栄養素データの初期化
        const scaledNutrition = this.initializeNutrientData();

        // 食品の栄養素データを変換
        if (food) {
            // 栄養素をスケーリング
            const ratio = grams / 100; // 100gあたりの栄養素を指定グラムに換算

            // 各栄養素をスケーリング
            const sourceNutrition = {
                energy: food.calories,
                protein: food.protein,
                fat: 0, // デフォルト値
                carbohydrate: 0, // デフォルト値
                minerals: {
                    calcium: food.calcium,
                    iron: food.iron
                },
                vitamins: {
                    vitaminD: food.vitamin_d,
                    folicAcid: food.folic_acid
                }
            };

            this.scaleNutrients(scaledNutrition, sourceNutrition, ratio);
        }

        // 食品栄養データの信頼度と量変換の信頼度を掛け合わせる
        const foodConfidence = food.confidence || 0.8; // デフォルト値
        const overallConfidence = foodConfidence * quantityConfidence;

        return {
            nutrition: scaledNutrition,
            confidence: overallConfidence
        };
    }

    /**
     * 栄養バランスを評価する
     * @param nutrition 栄養素データ
     * @returns バランススコア（0-100）
     */
    evaluateNutritionBalance(nutrition: NutrientData): number {
        // 主要栄養素の理想的な比率 (例: タンパク質:脂質:炭水化物 = 2:1:3)
        const idealRatio = {
            protein: 2,
            fat: 1,
            carbohydrate: 3
        };

        const totalIdealRatio = idealRatio.protein + idealRatio.fat + idealRatio.carbohydrate;

        // 実際の栄養素比率の計算
        const totalMacroNutrients = nutrition.protein + nutrition.fat + nutrition.carbohydrate;

        if (totalMacroNutrients === 0) {
            return 0; // 栄養素がゼロの場合はスコアも0
        }

        const actualRatio = {
            protein: nutrition.protein / totalMacroNutrients * totalIdealRatio,
            fat: nutrition.fat / totalMacroNutrients * totalIdealRatio,
            carbohydrate: nutrition.carbohydrate / totalMacroNutrients * totalIdealRatio
        };

        // 理想比率と実際の比率の差異を計算
        const proteinDiff = Math.abs(idealRatio.protein - actualRatio.protein) / idealRatio.protein;
        const fatDiff = Math.abs(idealRatio.fat - actualRatio.fat) / idealRatio.fat;
        const carbDiff = Math.abs(idealRatio.carbohydrate - actualRatio.carbohydrate) / idealRatio.carbohydrate;

        // 差異の平均を計算し、スコアに変換（差異が少ないほどスコアが高い）
        const avgDiff = (proteinDiff + fatDiff + carbDiff) / 3;
        const balanceScore = Math.max(0, Math.min(100, Math.round(100 * (1 - avgDiff))));

        return balanceScore;
    }

    /**
     * 不足している栄養素を特定する
     * @param nutrition 栄養素データ
     * @param targetValues 目標値
     * @returns 不足している栄養素のリスト
     */
    identifyDeficientNutrients(nutrition: NutrientData, targetValues: Partial<NutrientData>): string[] {
        const deficientNutrients: string[] = [];

        // 各栄養素を目標値と比較
        for (const [nutrient, target] of Object.entries(targetValues)) {
            if (nutrient in nutrition) {
                // 現在の栄養素値
                const currentValue = nutrition[nutrient as keyof NutrientData];

                // nullや undefined でない場合
                if (currentValue !== null && currentValue !== undefined && target !== null && target !== undefined) {
                    // 目標値の80%未満なら不足していると判断
                    if (currentValue < target * 0.8) {
                        deficientNutrients.push(nutrient);
                    }
                }
            }
        }

        return deficientNutrients;
    }

    /**
     * 栄養素データの完全性を計算する（どれだけ多くの栄養素データが有効か）
     * @private
     */
    private calculateCompleteness(nutrition: NutrientData): number {
        // 重要な栄養素リスト
        const keyNutrients = [
            'energy', 'protein', 'fat', 'carbohydrate',
            'dietaryFiber', 'vitamins.vitaminA', 'vitamins.vitaminD',
            'vitamins.vitaminB1', 'vitamins.vitaminC', 'minerals.calcium',
            'minerals.iron'
        ];

        // 有効な栄養素をカウント
        let validCount = 0;

        for (const nutrient of keyNutrients) {
            // ネストされた栄養素（例：vitamins.vitaminA）の処理
            if (nutrient.includes('.')) {
                const [category, specific] = nutrient.split('.');
                if (
                    nutrition[category as keyof NutrientData] &&
                    typeof nutrition[category as keyof NutrientData] === 'object' &&
                    (nutrition[category as keyof NutrientData] as any)[specific] > 0
                ) {
                    validCount++;
                }
            }
            // 通常の栄養素
            else if (
                nutrition[nutrient as keyof NutrientData] !== undefined &&
                nutrition[nutrient as keyof NutrientData] !== null &&
                (nutrition[nutrient as keyof NutrientData] as number) > 0
            ) {
                validCount++;
            }
        }

        // 完全性のスコアを計算 (0-1)
        return validCount / keyNutrients.length;
    }

    /**
     * 栄養素データを初期化する
     * @private
     */
    private initializeNutrientData(): NutrientData {
        return {
            energy: 0,
            protein: 0,
            fat: 0,
            carbohydrate: 0,
            dietaryFiber: 0,
            sugars: 0,
            salt: 0,
            minerals: {
                sodium: 0,
                calcium: 0,
                iron: 0,
                potassium: 0,
                magnesium: 0,
                phosphorus: 0,
                zinc: 0
            },
            vitamins: {
                vitaminA: 0,
                vitaminD: 0,
                vitaminE: 0,
                vitaminK: 0,
                vitaminB1: 0,
                vitaminB2: 0,
                vitaminB6: 0,
                vitaminB12: 0,
                vitaminC: 0,
                folicAcid: 0
            }
        };
    }

    /**
     * 栄養素を蓄積する
     * @param target 対象の栄養素データ
     * @param source 追加する栄養素データ
     * @private
     */
    private accumulateNutrients(target: NutrientData, source: NutrientData): void {
        // 基本栄養素の加算
        for (const [key, value] of Object.entries(source)) {
            // ネストされたオブジェクトの場合は再帰的に処理
            if (typeof value === 'object' && value !== null) {
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    if (typeof nestedValue === 'number') {
                        (target[key as keyof NutrientData] as any)[nestedKey] += nestedValue;
                    }
                }
            }
            // 数値の場合は単純に加算
            else if (typeof value === 'number') {
                (target[key as keyof NutrientData] as number) += value;
            }
        }
    }

    /**
     * 栄養素を指定の比率でスケーリングする
     * @param target 対象の栄養素データ
     * @param source 元の栄養素データ
     * @param ratio スケーリング比率
     * @private
     */
    private scaleNutrients(target: NutrientData, source: any, ratio: number): void {
        // 基本栄養素のスケーリング
        for (const [key, value] of Object.entries(source)) {
            // ネストされたオブジェクトの場合は再帰的に処理
            if (typeof value === 'object' && value !== null) {
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    if (typeof nestedValue === 'number') {
                        (target[key as keyof NutrientData] as any)[nestedKey] = nestedValue * ratio;
                    }
                }
            }
            // 数値の場合は単純にスケーリング
            else if (typeof value === 'number') {
                (target[key as keyof NutrientData] as number) = value * ratio;
            }
        }
    }
} 