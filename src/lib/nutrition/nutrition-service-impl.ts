import { Food, FoodQuantity, MealFoodItem, FoodMatchResult } from '@/types/food';
import { NutritionCalculationResult, NutritionData, NutrientData } from '@/types/nutrition';
import { FoodRepository } from '@/lib/food/food-repository';
import { NutritionService } from './nutrition-service';
import { QuantityParser } from './quantity-parser';
//src\lib\nutrition\nutrition-service-impl.ts
/**
 * NutrientData型からNutritionData型への変換ヘルパー
 * null/undefinedチェックを強化
 */
export function mapNutrientToNutritionData(nutrientData: NutrientData): NutritionData {
    return {
        calories: nutrientData.energy ?? 0,
        protein: nutrientData.protein ?? 0,
        iron: nutrientData.minerals?.iron ?? 0,
        folic_acid: nutrientData.vitamins?.folicAcid ?? 0,
        calcium: nutrientData.minerals?.calcium ?? 0,
        vitamin_d: nutrientData.vitamins?.vitaminD ?? 0,
        confidence_score: nutrientData.confidence_score ?? 0.8,
        extended_nutrients: {
            fat: nutrientData.fat ?? 0,
            carbohydrate: nutrientData.carbohydrate ?? 0,
            dietary_fiber: nutrientData.dietaryFiber ?? 0,
            sugars: nutrientData.sugars ?? 0,
            salt: nutrientData.salt ?? 0,
            minerals: {
                sodium: nutrientData.minerals?.sodium ?? 0,
                potassium: nutrientData.minerals?.potassium ?? 0,
                magnesium: nutrientData.minerals?.magnesium ?? 0,
                phosphorus: nutrientData.minerals?.phosphorus ?? 0,
                zinc: nutrientData.minerals?.zinc ?? 0
            },
            vitamins: {
                vitamin_a: nutrientData.vitamins?.vitaminA ?? 0,
                vitamin_b1: nutrientData.vitamins?.vitaminB1 ?? 0,
                vitamin_b2: nutrientData.vitamins?.vitaminB2 ?? 0,
                vitamin_b6: nutrientData.vitamins?.vitaminB6 ?? 0,
                vitamin_b12: nutrientData.vitamins?.vitaminB12 ?? 0,
                vitamin_c: nutrientData.vitamins?.vitaminC ?? 0,
                vitamin_e: nutrientData.vitamins?.vitaminE ?? 0,
                vitamin_k: nutrientData.vitamins?.vitaminK ?? 0
            }
        }
    };
}

/**
 * NutritionData型からNutrientData型への変換ヘルパー
 * null/undefinedチェックを強化
 */
export function mapNutritionToNutrientData(nutritionData: NutritionData): NutrientData {
    const result = {
        ...nutritionData,
        energy: nutritionData.calories,
        fat: nutritionData.extended_nutrients?.fat ?? 0,
        carbohydrate: nutritionData.extended_nutrients?.carbohydrate ?? 0,
        dietaryFiber: nutritionData.extended_nutrients?.dietary_fiber ?? 0,
        sugars: nutritionData.extended_nutrients?.sugars ?? 0,
        salt: nutritionData.extended_nutrients?.salt ?? 0,
        minerals: {
            sodium: nutritionData.extended_nutrients?.minerals?.sodium ?? 0,
            calcium: nutritionData.calcium,
            iron: nutritionData.iron,
            potassium: nutritionData.extended_nutrients?.minerals?.potassium ?? 0,
            magnesium: nutritionData.extended_nutrients?.minerals?.magnesium ?? 0,
            phosphorus: nutritionData.extended_nutrients?.minerals?.phosphorus ?? 0,
            zinc: nutritionData.extended_nutrients?.minerals?.zinc ?? 0
        },
        vitamins: {
            vitaminA: nutritionData.extended_nutrients?.vitamins?.vitamin_a ?? 0,
            vitaminD: nutritionData.vitamin_d,
            vitaminE: nutritionData.extended_nutrients?.vitamins?.vitamin_e ?? 0,
            vitaminK: nutritionData.extended_nutrients?.vitamins?.vitamin_k ?? 0,
            vitaminB1: nutritionData.extended_nutrients?.vitamins?.vitamin_b1 ?? 0,
            vitaminB2: nutritionData.extended_nutrients?.vitamins?.vitamin_b2 ?? 0,
            vitaminB6: nutritionData.extended_nutrients?.vitamins?.vitamin_b6 ?? 0,
            vitaminB12: nutritionData.extended_nutrients?.vitamins?.vitamin_b12 ?? 0,
            vitaminC: nutritionData.extended_nutrients?.vitamins?.vitamin_c ?? 0,
            folicAcid: nutritionData.folic_acid
        }
    } as NutrientData;

    return result;
}

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
        const totalNutrients: NutritionData = this.initializeNutrientData();
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

        // 下位互換性のための変換（NutrientData型との互換性を確保）
        const compatibilityNutrients = mapNutritionToNutrientData(totalNutrients);

        return {
            nutrients: compatibilityNutrients,
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
    ): Promise<{ nutrition: NutritionData; confidence: number }> {
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
            const sourceNutrition: NutritionData = {
                calories: food.calories || 0,
                protein: food.protein || 0,
                iron: food.iron || 0,
                folic_acid: food.folic_acid || 0,
                calcium: food.calcium || 0,
                vitamin_d: food.vitamin_d || 0,
                confidence_score: food.confidence || 0.8,
                extended_nutrients: {
                    // 追加の栄養素があれば拡張フィールドに追加
                    // fat, carbohydrateなどがあれば追加
                }
            };

            this.scaleNutrients(scaledNutrition, sourceNutrition, ratio);
        }

        // 食品栄養データの信頼度と量変換の信頼度を掛け合わせる
        const foodConfidence = food.confidence || 0.8; // デフォルト値
        const overallConfidence = foodConfidence * quantityConfidence;

        // 信頼度を結果に設定
        scaledNutrition.confidence_score = overallConfidence;

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
    evaluateNutritionBalance(nutrition: NutritionData): number {
        // 主要栄養素の理想的な比率 (例: タンパク質:脂質:炭水化物 = 2:1:3)
        const idealRatio = {
            protein: 2,
            fat: 1,
            carbohydrate: 3
        };

        const totalIdealRatio = idealRatio.protein + idealRatio.fat + idealRatio.carbohydrate;

        // 実際の栄養素比率の計算
        // 拡張栄養素から脂質と炭水化物を取得、ない場合はデフォルト値を使用
        const fat = nutrition.extended_nutrients && typeof nutrition.extended_nutrients.fat === 'number'
            ? nutrition.extended_nutrients.fat
            : 0;

        const carbohydrate = nutrition.extended_nutrients && typeof nutrition.extended_nutrients.carbohydrate === 'number'
            ? nutrition.extended_nutrients.carbohydrate
            : 0;

        const totalMacroNutrients = nutrition.protein + fat + carbohydrate;

        if (totalMacroNutrients === 0) {
            return 0; // 栄養素がゼロの場合はスコアも0
        }

        const actualRatio = {
            protein: nutrition.protein / totalMacroNutrients * totalIdealRatio,
            fat: fat / totalMacroNutrients * totalIdealRatio,
            carbohydrate: carbohydrate / totalMacroNutrients * totalIdealRatio
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
    identifyDeficientNutrients(nutrition: NutritionData, targetValues: Partial<NutritionData>): string[] {
        const deficientNutrients: string[] = [];

        // 基本栄養素をチェック
        const basicNutrients = ['calories', 'protein', 'iron', 'folic_acid', 'calcium', 'vitamin_d'];
        for (const nutrient of basicNutrients) {
            const key = nutrient as keyof NutritionData;
            const target = targetValues[key];
            if (typeof target === 'number' && typeof nutrition[key] === 'number') {
                if (nutrition[key] < target * 0.8) {
                    deficientNutrients.push(nutrient);
                }
            }
        }

        // 拡張栄養素をチェック（もし存在する場合）
        if (nutrition.extended_nutrients && targetValues.extended_nutrients) {
            // トップレベルの拡張栄養素
            for (const [nutrient, value] of Object.entries(nutrition.extended_nutrients)) {
                if (typeof value === 'number') {
                    const target = (targetValues.extended_nutrients as any)[nutrient];
                    if (typeof target === 'number' && value < target * 0.8) {
                        deficientNutrients.push(nutrient);
                    }
                }
            }

            // ネストされたカテゴリ（例：minerals, vitamins）
            for (const [category, nutrients] of Object.entries(nutrition.extended_nutrients)) {
                if (typeof nutrients === 'object' && nutrients !== null &&
                    targetValues.extended_nutrients[category] &&
                    typeof targetValues.extended_nutrients[category] === 'object') {

                    for (const [key, value] of Object.entries(nutrients as object)) {
                        if (typeof value === 'number') {
                            const targetCategory = targetValues.extended_nutrients[category] as Record<string, number>;
                            const target = targetCategory[key];
                            if (typeof target === 'number' && value < target * 0.8) {
                                deficientNutrients.push(`${category}.${key}`);
                            }
                        }
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
    private calculateCompleteness(nutrition: NutritionData): number {
        // 重要な栄養素リスト
        const keyNutrients = [
            'calories', 'protein', 'iron', 'folic_acid', 'calcium', 'vitamin_d'
        ];

        // 拡張栄養素
        const extendedNutrients = [
            'extended_nutrients.dietary_fiber',
            'extended_nutrients.fat',
            'extended_nutrients.carbohydrate',
            'extended_nutrients.vitamins.vitamin_a',
            'extended_nutrients.vitamins.vitamin_c',
            'extended_nutrients.minerals.sodium'
        ];

        // 有効な栄養素をカウント
        let validCount = 0;
        let totalCheck = keyNutrients.length;

        // 基本栄養素のチェック
        for (const nutrient of keyNutrients) {
            const value = nutrition[nutrient as keyof NutritionData];
            if (typeof value === 'number' && value > 0) {
                validCount++;
            }
        }

        // 拡張栄養素のチェック（もし存在する場合）
        if (nutrition.extended_nutrients) {
            totalCheck += extendedNutrients.length;

            for (const path of extendedNutrients) {
                const parts = path.split('.');
                let current: any = nutrition;

                // ドット表記でネストされたオブジェクトにアクセス
                for (const part of parts) {
                    if (current && typeof current === 'object' && part in current) {
                        current = current[part];
                    } else {
                        current = undefined;
                        break;
                    }
                }

                if (typeof current === 'number' && current > 0) {
                    validCount++;
                }
            }
        }

        return totalCheck > 0 ? validCount / totalCheck : 0;
    }

    /**
     * 栄養素データを初期化する
     * @private
     */
    private initializeNutrientData(): NutritionData {
        return {
            calories: 0,
            protein: 0,
            iron: 0,
            folic_acid: 0,
            calcium: 0,
            vitamin_d: 0,
            confidence_score: 0,
            extended_nutrients: {
                dietary_fiber: 0,
                fat: 0,
                carbohydrate: 0,
                sugars: 0,
                salt: 0,
                minerals: {
                    sodium: 0,
                    potassium: 0,
                    magnesium: 0,
                    phosphorus: 0,
                    zinc: 0
                },
                vitamins: {
                    vitamin_a: 0,
                    vitamin_b1: 0,
                    vitamin_b2: 0,
                    vitamin_b6: 0,
                    vitamin_b12: 0,
                    vitamin_c: 0,
                    vitamin_e: 0,
                    vitamin_k: 0
                }
            }
        };
    }

    /**
     * 栄養素データを累積する
     * @param target 対象の栄養素データ
     * @param source 加算元の栄養素データ
     * @private
     */
    private accumulateNutrients(target: NutritionData, source: NutritionData): void {
        // 基本栄養素の累積
        target.calories += source.calories || 0;
        target.protein += source.protein || 0;
        target.iron += source.iron || 0;
        target.folic_acid += source.folic_acid || 0;
        target.calcium += source.calcium || 0;
        target.vitamin_d += source.vitamin_d || 0;

        // 拡張栄養素の累積
        if (source.extended_nutrients) {
            if (!target.extended_nutrients) {
                target.extended_nutrients = {};
            }

            // トップレベルの栄養素
            for (const [key, value] of Object.entries(source.extended_nutrients)) {
                if (typeof value === 'number') {
                    (target.extended_nutrients as any)[key] = ((target.extended_nutrients as any)[key] || 0) + value;
                } else if (typeof value === 'object' && value !== null) {
                    // ネストされたカテゴリ（minerals, vitaminsなど）
                    if (!(target.extended_nutrients as any)[key]) {
                        (target.extended_nutrients as any)[key] = {};
                    }

                    for (const [subKey, subValue] of Object.entries(value)) {
                        if (typeof subValue === 'number') {
                            (target.extended_nutrients as any)[key][subKey] =
                                ((target.extended_nutrients as any)[key][subKey] || 0) + subValue;
                        }
                    }
                }
            }
        }
    }

    /**
     * 栄養素データをスケーリングする
     * @param target 対象の栄養素データ
     * @param source 元の栄養素データ
     * @param ratio スケーリング比率
     * @private
     */
    private scaleNutrients(target: NutritionData, source: NutritionData, ratio: number): void {
        // 基本栄養素のスケーリング
        target.calories += (source.calories || 0) * ratio;
        target.protein += (source.protein || 0) * ratio;
        target.iron += (source.iron || 0) * ratio;
        target.folic_acid += (source.folic_acid || 0) * ratio;
        target.calcium += (source.calcium || 0) * ratio;
        target.vitamin_d += (source.vitamin_d || 0) * ratio;

        // 拡張栄養素のスケーリング
        if (source.extended_nutrients) {
            if (!target.extended_nutrients) {
                target.extended_nutrients = {};
            }

            // トップレベルの栄養素
            for (const [key, value] of Object.entries(source.extended_nutrients)) {
                if (typeof value === 'number') {
                    (target.extended_nutrients as any)[key] = ((target.extended_nutrients as any)[key] || 0) + value * ratio;
                } else if (typeof value === 'object' && value !== null) {
                    // ネストされたカテゴリ（minerals, vitaminsなど）
                    if (!(target.extended_nutrients as any)[key]) {
                        (target.extended_nutrients as any)[key] = {};
                    }

                    for (const [subKey, subValue] of Object.entries(value)) {
                        if (typeof subValue === 'number') {
                            (target.extended_nutrients as any)[key][subKey] =
                                ((target.extended_nutrients as any)[key][subKey] || 0) + subValue * ratio;
                        }
                    }
                }
            }
        }
    }
} 