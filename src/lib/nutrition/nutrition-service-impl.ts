import { Food, FoodQuantity, MealFoodItem, FoodMatchResult } from '@/types/food';
import { NutritionCalculationResult, NutritionData } from '@/types/nutrition';
import { FoodRepository } from '@/lib/food/food-repository';
import { FoodMatchingService } from '@/lib/food/food-matching-service';
import { NutritionService } from './nutrition-service';
import { QuantityParser } from './quantity-parser';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';
import { FoodAnalysisResult } from '@/types/ai';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
//src\lib\nutrition\nutrition-service-impl.ts

/**
 * NutritionData型の標準形式を作成（互換性のためのプロパティも同時に設定）
 */
export function createStandardNutritionData(data: Partial<NutritionData> = {}): NutritionData {
    const result: NutritionData = {
        // 基本栄養素
        calories: data.calories ?? 0,
        protein: data.protein ?? 0,
        iron: data.iron ?? 0,
        folic_acid: data.folic_acid ?? 0,
        calcium: data.calcium ?? 0,
        vitamin_d: data.vitamin_d ?? 0,
        confidence_score: data.confidence_score ?? 0.8,

        // 拡張栄養素
        extended_nutrients: {
            fat: data.extended_nutrients?.fat ?? data.fat ?? 0,
            carbohydrate: data.extended_nutrients?.carbohydrate ?? data.carbohydrate ?? 0,
            dietary_fiber: data.extended_nutrients?.dietary_fiber ?? data.dietaryFiber ?? 0,
            sugars: data.extended_nutrients?.sugars ?? data.sugars ?? 0,
            salt: data.extended_nutrients?.salt ?? data.salt ?? 0,

            // ミネラル
            minerals: {
                sodium: data.extended_nutrients?.minerals?.sodium ?? data.minerals?.sodium ?? 0,
                potassium: data.extended_nutrients?.minerals?.potassium ?? data.minerals?.potassium ?? 0,
                magnesium: data.extended_nutrients?.minerals?.magnesium ?? data.minerals?.magnesium ?? 0,
                phosphorus: data.extended_nutrients?.minerals?.phosphorus ?? data.minerals?.phosphorus ?? 0,
                zinc: data.extended_nutrients?.minerals?.zinc ?? data.minerals?.zinc ?? 0,
            },

            // ビタミン
            vitamins: {
                vitamin_a: data.extended_nutrients?.vitamins?.vitamin_a ?? data.vitamins?.vitaminA ?? 0,
                vitamin_b1: data.extended_nutrients?.vitamins?.vitamin_b1 ?? data.vitamins?.vitaminB1 ?? 0,
                vitamin_b2: data.extended_nutrients?.vitamins?.vitamin_b2 ?? data.vitamins?.vitaminB2 ?? 0,
                vitamin_b6: data.extended_nutrients?.vitamins?.vitamin_b6 ?? data.vitamins?.vitaminB6 ?? 0,
                vitamin_b12: data.extended_nutrients?.vitamins?.vitamin_b12 ?? data.vitamins?.vitaminB12 ?? 0,
                vitamin_c: data.extended_nutrients?.vitamins?.vitamin_c ?? data.vitamins?.vitaminC ?? 0,
                vitamin_e: data.extended_nutrients?.vitamins?.vitamin_e ?? data.vitamins?.vitaminE ?? 0,
                vitamin_k: data.extended_nutrients?.vitamins?.vitamin_k ?? data.vitamins?.vitaminK ?? 0,
            }
        },

        // 互換性のためのプロパティ
        energy: data.calories ?? data.energy ?? 0,
        fat: data.extended_nutrients?.fat ?? data.fat ?? 0,
        carbohydrate: data.extended_nutrients?.carbohydrate ?? data.carbohydrate ?? 0,
        dietaryFiber: data.extended_nutrients?.dietary_fiber ?? data.dietaryFiber ?? 0,
        sugars: data.extended_nutrients?.sugars ?? data.sugars ?? 0,
        salt: data.extended_nutrients?.salt ?? data.salt ?? 0,

        // 互換性のための構造化オブジェクト
        minerals: {
            sodium: data.extended_nutrients?.minerals?.sodium ?? data.minerals?.sodium ?? 0,
            calcium: data.calcium ?? data.minerals?.calcium ?? 0,
            iron: data.iron ?? data.minerals?.iron ?? 0,
            potassium: data.extended_nutrients?.minerals?.potassium ?? data.minerals?.potassium ?? 0,
            magnesium: data.extended_nutrients?.minerals?.magnesium ?? data.minerals?.magnesium ?? 0,
            phosphorus: data.extended_nutrients?.minerals?.phosphorus ?? data.minerals?.phosphorus ?? 0,
            zinc: data.extended_nutrients?.minerals?.zinc ?? data.minerals?.zinc ?? 0,
        },

        vitamins: {
            vitaminA: data.extended_nutrients?.vitamins?.vitamin_a ?? data.vitamins?.vitaminA ?? 0,
            vitaminD: data.vitamin_d ?? data.vitamins?.vitaminD ?? 0,
            vitaminE: data.extended_nutrients?.vitamins?.vitamin_e ?? data.vitamins?.vitaminE ?? 0,
            vitaminK: data.extended_nutrients?.vitamins?.vitamin_k ?? data.vitamins?.vitaminK ?? 0,
            vitaminB1: data.extended_nutrients?.vitamins?.vitamin_b1 ?? data.vitamins?.vitaminB1 ?? 0,
            vitaminB2: data.extended_nutrients?.vitamins?.vitamin_b2 ?? data.vitamins?.vitaminB2 ?? 0,
            vitaminB6: data.extended_nutrients?.vitamins?.vitamin_b6 ?? data.vitamins?.vitaminB6 ?? 0,
            vitaminB12: data.extended_nutrients?.vitamins?.vitamin_b12 ?? data.vitamins?.vitaminB12 ?? 0,
            vitaminC: data.extended_nutrients?.vitamins?.vitamin_c ?? data.vitamins?.vitaminC ?? 0,
            folicAcid: data.folic_acid ?? data.vitamins?.folicAcid ?? 0,
        },

        not_found_foods: data.not_found_foods ?? []
    };

    return result;
}

/**
 * 栄養計算サービスの実装クラス
 */
export class NutritionServiceImpl implements NutritionService {
    private foodRepository: FoodRepository;
    private foodMatchingService: FoodMatchingService;

    constructor(
        foodRepository: FoodRepository,
        foodMatchingService: FoodMatchingService
    ) {
        this.foodRepository = foodRepository;
        this.foodMatchingService = foodMatchingService;
    }

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

        return {
            nutrition: totalNutrients,
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

            if (foodMatches.length > 0 && foodMatches[0] && foodMatches[0].food) {
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
                    const extendedTargets = targetValues.extended_nutrients as Record<string, number | Record<string, number> | undefined>;
                    if (extendedTargets && typeof extendedTargets[nutrient] === 'number') {
                        const target = extendedTargets[nutrient] as number;
                        if (value < target * 0.8) {
                            deficientNutrients.push(nutrient);
                        }
                    }
                }
            }

            // ネストされたカテゴリ（例：minerals, vitamins）
            for (const [category, nutrients] of Object.entries(nutrition.extended_nutrients)) {
                const targetExtended = targetValues.extended_nutrients;
                if (typeof nutrients === 'object' && nutrients !== null &&
                    targetExtended && typeof targetExtended[category] === 'object' && targetExtended[category] !== null) {

                    const targetCategory = targetExtended[category] as Record<string, number | undefined>;
                    for (const [key, value] of Object.entries(nutrients as object)) {
                        if (typeof value === 'number') {
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
                let current: unknown = nutrition;

                // ドット表記でネストされたオブジェクトにアクセス
                for (const part of parts) {
                    if (current && typeof current === 'object' && part in current) {
                        current = (current as Record<string, unknown>)[part];
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
        return createStandardNutritionData();
    }

    /**
     * 栄養素データを累積する
     * @param target 対象の栄養素データ
     * @param source 加算元の栄養素データ
     * @private
     */
    private accumulateNutrients(target: NutritionData, source: NutritionData): void {
        // 基本栄養素の累積
        target.calories += source.calories ?? 0;
        target.protein += source.protein ?? 0;
        target.iron += source.iron ?? 0;
        target.folic_acid += source.folic_acid ?? 0;
        target.calcium += source.calcium ?? 0;
        target.vitamin_d += source.vitamin_d ?? 0;

        // 拡張栄養素の累積
        if (source.extended_nutrients) {
            if (!target.extended_nutrients) {
                target.extended_nutrients = {};
            }
            const targetExtended = target.extended_nutrients as Record<string, number | Record<string, number | undefined> | undefined>;

            // トップレベルの栄養素
            for (const [key, value] of Object.entries(source.extended_nutrients)) {
                if (typeof value === 'number') {
                    targetExtended[key] = (typeof targetExtended[key] === 'number' ? targetExtended[key] as number : 0) + value;
                } else if (typeof value === 'object' && value !== null) {
                    // ネストされたカテゴリ（minerals, vitaminsなど）
                    if (!targetExtended[key] || typeof targetExtended[key] !== 'object') {
                        targetExtended[key] = {};
                    }
                    const targetCategory = targetExtended[key] as Record<string, number | undefined>;

                    for (const [subKey, subValue] of Object.entries(value)) {
                        if (typeof subValue === 'number') {
                            targetCategory[subKey] = (typeof targetCategory[subKey] === 'number' ? targetCategory[subKey] as number : 0) + subValue;
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
        target.calories += (source.calories ?? 0) * ratio;
        target.protein += (source.protein ?? 0) * ratio;
        target.iron += (source.iron ?? 0) * ratio;
        target.folic_acid += (source.folic_acid ?? 0) * ratio;
        target.calcium += (source.calcium ?? 0) * ratio;
        target.vitamin_d += (source.vitamin_d ?? 0) * ratio;

        // 拡張栄養素のスケーリング
        if (source.extended_nutrients) {
            if (!target.extended_nutrients) {
                target.extended_nutrients = {};
            }
            const targetExtended = target.extended_nutrients as Record<string, number | Record<string, number | undefined> | undefined>;

            // トップレベルの栄養素
            for (const [key, value] of Object.entries(source.extended_nutrients)) {
                if (typeof value === 'number') {
                    targetExtended[key] = (typeof targetExtended[key] === 'number' ? targetExtended[key] as number : 0) + value * ratio;
                } else if (typeof value === 'object' && value !== null) {
                    // ネストされたカテゴリ（minerals, vitaminsなど）
                    if (!targetExtended[key] || typeof targetExtended[key] !== 'object') {
                        targetExtended[key] = {};
                    }
                    const targetCategory = targetExtended[key] as Record<string, number | undefined>;

                    for (const [subKey, subValue] of Object.entries(value)) {
                        if (typeof subValue === 'number') {
                            targetCategory[subKey] = (typeof targetCategory[subKey] === 'number' ? targetCategory[subKey] as number : 0) + subValue * ratio;
                        }
                    }
                }
            }
        }
    }

    /**
     * AIによって解析された食品情報から、食品マッチング、量の解析、栄養価計算を行い
     * 最終的な分析結果を生成する
     * @param parsedFoods AIによって解析された食品情報の配列
     * @returns 食品分析結果
     */
    async processParsedFoods(parsedFoods: FoodInputParseResult[]): Promise<FoodAnalysisResult> {
        // 結果格納用の変数を初期化
        const matchedItems: MealFoodItem[] = [];
        const meta = {
            unmatchedFoods: [] as string[],
            lowConfidenceMatches: [] as string[],
            errors: [] as string[]
        };

        // 処理時間の計測開始
        const startTime = Date.now();

        // 食品名の抽出
        const foodNames = parsedFoods.map(food => food.foodName);

        // 食品マッチング
        let matchResults: FoodMatchResult[] = [];
        try {
            // foodMatchingServiceの戻り値の型を確認し、必要に応じて型変換
            const results = await this.foodMatchingService.matchFoods(foodNames);
            // 配列として扱えるようにする
            if (Array.isArray(results)) {
                matchResults = results;
            } else if (results instanceof Map) {
                // Mapの場合は配列に変換
                matchResults = Array.from(foodNames.map((name) => {
                    return results.get(name) || null;
                })).filter((result): result is FoodMatchResult => result !== null);
            }
        } catch (error) {
            throw new AppError({
                code: ErrorCode.Nutrition.FOOD_REPOSITORY_ERROR, // 適切なエラーコードに修正
                message: '食品マッチング処理中にエラーが発生しました',
                userMessage: '食品データベースの検索中に問題が発生しました',
                details: { foodNames },
                originalError: error instanceof Error ? error : undefined
            });
        }

        // マッチング結果の類似度閾値
        const SIMILARITY_THRESHOLD = 0.7;

        // 結果の処理ループ
        for (let i = 0; i < parsedFoods.length; i++) {
            try {
                const parsedFood = parsedFoods[i];
                if (!parsedFood) continue; // parsedFoodがundefinedの場合はスキップ

                // matchResultsのインデックスがparsedFoodsと一致することを確認
                const matchResult = i < matchResults.length ? matchResults[i] : null;

                // マッチング結果の検証
                if (!matchResult || !matchResult.food) {
                    meta.unmatchedFoods.push(parsedFood.foodName);
                    continue;
                }

                // 類似度の確認
                if (matchResult.similarity < SIMILARITY_THRESHOLD) {
                    meta.lowConfidenceMatches.push(parsedFood.foodName);
                    // 低類似度でも処理は続行
                }

                // 量の解析と変換
                // quantityStrプロパティの存在を確認
                const quantityString = 'quantityStr' in parsedFood ?
                    String(parsedFood.quantityStr || '') : '';
                // categoryプロパティの存在を確認
                const category = 'category' in parsedFood ?
                    String(parsedFood.category || '') : '';

                const { quantity: parsedQuantity, confidence: quantityParseConfidence } = QuantityParser.parseQuantity(
                    quantityString,
                    matchResult.food.name,
                    category || matchResult.food.category || ''
                );

                const { grams, confidence: conversionConfidence } = QuantityParser.convertToGrams(
                    parsedQuantity,
                    matchResult.food.name,
                    category || matchResult.food.category || ''
                );

                // 総合的な確信度の計算（類似度、量解析確信度、グラム変換確信度の組み合わせ）
                const combinedConfidence = Math.min(
                    matchResult.similarity,
                    quantityParseConfidence,
                    conversionConfidence
                );

                // MealFoodItemの作成
                // MealFoodItemの型定義に従って必要なプロパティを設定
                const mealFoodItem: MealFoodItem = {
                    foodId: matchResult.food.id,
                    food: matchResult.food,
                    quantity: parsedQuantity,
                    originalInput: parsedFood.foodName,
                    confidence: combinedConfidence
                };

                matchedItems.push(mealFoodItem);
            } catch (error) {
                // 個別の食品処理エラーはスキップして次の食品の処理を続行
                const foodName = parsedFoods[i]?.foodName ?? '不明な食品'; // null合体演算子でundefinedチェック
                const errorMessage = error instanceof Error ? error.message : '不明なエラー';
                meta.errors.push(`${foodName}の処理中にエラー: ${errorMessage}`);
            }
        }

        // 一つもマッチングできなかった場合はエラー
        if (matchedItems.length === 0) {
            throw new AppError({
                code: ErrorCode.Nutrition.FOOD_NOT_FOUND,
                message: '有効な食品が見つかりませんでした',
                userMessage: '入力された食品をデータベースで見つけることができませんでした',
                details: { unmatchedFoods: meta.unmatchedFoods }
            });
        }

        // 栄養計算
        let nutritionResult: NutritionCalculationResult;
        try {
            nutritionResult = await this.calculateNutrition(matchedItems);
        } catch (error) {
            throw new AppError({
                code: ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR,
                message: '栄養価計算中にエラーが発生しました',
                userMessage: '栄養価の計算中に問題が発生しました',
                details: { matchedItems: matchedItems.map(item => item.food.name) },
                originalError: error instanceof Error ? error : undefined
            });
        }

        // 処理時間の計測終了
        const calculationTime = Date.now() - startTime;

        // FoodAnalysisResultの構築
        const result: FoodAnalysisResult = {
            foods: matchedItems.map(item => ({
                name: item.food.name,
                quantity: `${item.quantity.value} ${item.quantity.unit}`,
                confidence: item.confidence
            })),
            nutrition: {
                ...nutritionResult.nutrition,
                confidence_score: nutritionResult.reliability.confidence
            },
            meta: {
                ...meta,
                calculationTime: calculationTime.toString(), // number型をstring型に変換
                totalItemsFound: matchedItems.length,
                totalInputItems: parsedFoods.length
            }
        };

        return result;
    }
} 