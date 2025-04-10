import { Food, FoodQuantity, MealFoodItem, FoodMatchResult } from '@/types/food';
import {
    NutritionCalculationResult,
    NutritionData, // 一時的に残すが、最終的には削除する可能性あり
    StandardizedMealNutrition, // 追加
    Nutrient, // 追加
    FoodItemNutrition, // 追加
    NutrientUnit, // 追加
    NutrientDeficiency
} from '@/types/nutrition';
import {
    convertToStandardizedNutrition, // 追加
    createStandardizedMealNutrition // 追加 (ファクトリ関数)
} from './nutrition-type-utils'; // 型変換ユーティリティをインポート
import { FoodRepository } from '@/lib/food/food-repository';
import { FoodMatchingService } from '@/lib/food/food-matching-service';
import { NutritionService } from './nutrition-service';
import { QuantityParser } from './quantity-parser';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';
import { FoodAnalysisResult } from '@/types/ai';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { getNutrientValueByName } from '@/lib/nutrition/nutrition-display-utils'; // getNutrientValueByName関数をインポート
//src\lib\nutrition\nutrition-service-impl.ts

// Food 型に存在する栄養素キーのみをリストアップ (型を keyof Food に修正)
const NUTRITION_KEYS_IN_FOOD_TYPE: (keyof Food)[] = [
    'calories', 'protein', 'iron', 'folic_acid', 'calcium', 'vitamin_d', 'confidence' // confidence は栄養素ではないが FoodNutrition に含まれる
];

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
        let totalConfidence = 0;
        // initializeStandardizedNutrition を使用
        const totalNutrition: StandardizedMealNutrition = this.initializeStandardizedNutrition();
        const foodItemsForStandardized: StandardizedMealNutrition['foodItems'] = []; // Standardized 用の foodItems 配列
        const matchResults: FoodMatchResult[] = [];

        for (const item of foodItems) {
            const food = item.food;
            const { nutrition: singleFoodNutrition, confidence: singleFoodConfidence } = await this.calculateSingleFoodNutrition(
                food,
                item.quantity
            );

            // 修正された accumulateNutrients を使用
            this.accumulateNutrients(totalNutrition, singleFoodNutrition);

            // TODO: 個々の食品の信頼度と量の信頼度を考慮した総合的な信頼度を計算するロジックを追加・改善
            // 現在は calculateSingleFoodNutrition から返される confidence をそのまま使用
            totalConfidence += singleFoodConfidence;

            // StandardizedMealNutrition の foodItems にも情報を追加
            // 量はグラム換算後の値を設定することが望ましいが、元の単位情報も保持したい場合がある
            // ここでは quantity parser が返す FoodQuantity をそのまま利用する方針とする
            // servingSize は calculateSingleFoodNutrition 内で計算されたグラム量を使用する
            const { grams } = QuantityParser.convertToGrams(item.quantity, food.name, food.category);
            foodItemsForStandardized.push({
                id: food.id,
                name: food.name,
                amount: item.quantity.value, // 元の入力量
                unit: item.quantity.unit, // 元の入力単位
                nutrition: {
                    calories: singleFoodNutrition.totalCalories, // スケーリング後のカロリー
                    nutrients: singleFoodNutrition.totalNutrients, // スケーリング後の栄養素リスト
                    servingSize: {
                        value: grams, // グラム換算後の量
                        unit: 'g'
                    }
                },
                confidence: singleFoodConfidence // この食品アイテムに対する信頼度
            });

            matchResults.push({
                inputName: item.originalInput || food.name,
                matchedFood: food,
                food: food,
                similarity: singleFoodConfidence,
                confidence: singleFoodConfidence,
                originalInput: item.originalInput || food.name
            });
        }

        totalNutrition.foodItems = foodItemsForStandardized; // 計算した foodItems をセット

        const averageConfidence = foodItems.length > 0 ? totalConfidence / foodItems.length : 0;

        // バランススコアと完全性は、このメソッドではなく、最終結果を受け取った側で計算する
        // const balanceScore = this.evaluateNutritionBalance(totalNutrition, { ... });
        // const completeness = this.calculateCompleteness(totalNutrition);

        return {
            nutrition: totalNutrition,
            reliability: {
                confidence: averageConfidence,
                // balanceScore と completeness は削除
                // balanceScore: balanceScore,
                // completeness: completeness
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
     * @throws {AppError(ErrorCode.Nutrition.QUANTITY_CONVERSION_ERROR)} 量の変換に失敗した場合
     * @remarks Food 型から StandardizedMealNutrition への変換ロジックが含まれる。
     *          将来的にはこの変換は FoodRepository 層に移譲することが望ましい。
     */
    async calculateSingleFoodNutrition(
        food: Food,
        quantity: FoodQuantity
    ): Promise<{ nutrition: StandardizedMealNutrition; confidence: number }> {
        const { grams, confidence: quantityConfidence } = QuantityParser.convertToGrams(
            quantity,
            food.name,
            food.category
        );

        const scaledNutrition: StandardizedMealNutrition = this.initializeStandardizedNutrition();

        // --- Food 型から StandardizedMealNutrition への変換ロジック ---
        NUTRITION_KEYS_IN_FOOD_TYPE.forEach((key: keyof Food) => { // key の型を明示
            if (key === 'confidence') return;

            const value = food[key];

            if (typeof value === 'number' && value >= 0) {
                let unit: NutrientUnit = 'g';
                if (key === 'calories') unit = 'kcal';
                else if (key === 'iron' || key === 'calcium') unit = 'mg';
                else if (key === 'folic_acid' || key === 'vitamin_d') unit = 'mcg';

                if (key === 'calories') {
                    scaledNutrition.totalCalories = value;
                }

                // key が文字列であることを確認してから replace を使用
                if (typeof key === 'string') {
                    const standardizedKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                    this.updateNutrient(scaledNutrition, standardizedKey, value, unit);
                }
            }
        });
        // --- 変換ロジックここまで ---

        const ratio = grams > 0 ? grams / 100 : 0;
        this.scaleNutrients(scaledNutrition, ratio);

        const foodConfidence = food.confidence ?? 0.8;
        const overallConfidence = Math.min(foodConfidence, quantityConfidence);

        return {
            nutrition: scaledNutrition,
            confidence: overallConfidence
        };
    }

    /**
     * 栄養バランススコアの計算（MVPの6栄養素に基づく）
     * 各栄養素の目標充足率に基づいてスコアを算出 (0-100)
     * @param nutrition 栄養データ
     * @param targetValues ユーザーの現在の妊娠周期に基づいた目標値 (例: { calories: 2200, protein: 75, ... })
     */
    evaluateNutritionBalance(nutrition: StandardizedMealNutrition, targetValues: Record<string, number>): number {
        const mvpNutrientNames = ['calories', 'protein', 'iron', 'calcium', 'folic_acid', 'vitamin_d'];
        let fulfillmentSum = 0;
        let targetCount = 0;

        for (const name of mvpNutrientNames) {
            const targetValue = targetValues[name];
            if (typeof targetValue === 'number' && targetValue > 0) {
                const currentValue = getNutrientValueByName(nutrition, name);
                const fulfillmentRatio = Math.min(1.0, currentValue / targetValue);
                fulfillmentSum += fulfillmentRatio;
                targetCount++;
            }
        }

        if (targetCount === 0) return 0;
        const averageFulfillment = fulfillmentSum / targetCount;
        const finalScore = averageFulfillment * 100;
        return Math.max(0, Math.min(100, Math.round(finalScore)));
    }

    /**
     * 不足している栄養素を特定する（MVPの6栄養素に基づく）
     * 目標値に対する充足率が閾値未満の栄養素名を返す
     * @param nutrition 栄養データ
     * @param targetValues 目標値 (例: { calories: 2200, protein: 75, ... })
     * @param threshold 不足と判断する充足率の閾値 (0.0-1.0、デフォルト: 0.7)
     * @returns 不足している栄養素の詳細情報リスト
     */
    identifyDeficientNutrients(
        nutrition: StandardizedMealNutrition,
        targetValues: Record<string, number>,
        threshold: number = 0.7
    ): NutrientDeficiency[] {
        const deficientNutrients: NutrientDeficiency[] = [];
        for (const [nutrientCode, targetValue] of Object.entries(targetValues)) {
            if (targetValue <= 0) continue;
            const currentValue = getNutrientValueByName(nutrition, nutrientCode);
            const fulfillmentRatio = currentValue / targetValue;
            if (fulfillmentRatio < threshold) {
                deficientNutrients.push({ nutrientCode, fulfillmentRatio, currentValue, targetValue });
            }
        }
        return deficientNutrients;
    }

    /**
     * データの完全性を計算する (TODO: StandardizedMealNutrition に基づくロジックに更新)
     * 現在は仮実装として 0.8 を返す
     */
    private calculateCompleteness(nutrition: StandardizedMealNutrition): number {
        // TODO: Implement completeness calculation based on StandardizedMealNutrition
        // (e.g., check number of nutrients present, confidence of food items)
        console.warn('calculateCompleteness is not fully implemented for StandardizedMealNutrition yet.');
        // 仮実装：必須栄養素がいくつか存在するかで判断
        const requiredNutrients = ['protein', 'fat', 'carbohydrate', 'iron', 'calcium', 'folic_acid'];
        const presentCount = requiredNutrients.filter(req =>
            nutrition.totalNutrients.some(n => n.name === req && n.value > 0)
        ).length;
        return presentCount / requiredNutrients.length;
    }

    /**
     * 空の標準栄養データオブジェクトを初期化する
     * MVPで必要な6栄養素を含む空のNutrient配列を持つオブジェクトを生成
     */
    private initializeStandardizedNutrition(): StandardizedMealNutrition {
        // 全ての栄養素を処理対象とするため、初期配列は空にする
        const initialNutrients: Nutrient[] = [];
        return createStandardizedMealNutrition({ totalNutrients: initialNutrients });
    }

    /**
     * StandardizedMealNutritionから特定の栄養素の値を取得するヘルパーメソッド
     * @param nutrition 栄養データ
     * @param nutrientName 栄養素名またはコード
     * @returns 栄養素の値、見つからない場合は0
     */
    private getNutrientValue(nutrition: StandardizedMealNutrition, nutrientName: string): number {
        // nutrientNameがカロリー関連であればtotalCaloriesを返す
        if (nutrientName === 'calories' || nutrientName === 'energy') {
            return nutrition.totalCalories;
        }

        // 栄養素名を日本語に変換するマッピング
        const codeToJapanese: Record<string, string> = {
            'protein': 'タンパク質',
            'iron': '鉄分',
            'calcium': 'カルシウム',
            'folic_acid': '葉酸',
            'vitamin_d': 'ビタミンD'
        };

        // 日本語の栄養素名を取得
        const japaneseName = codeToJapanese[nutrientName];

        if (japaneseName) {
            // totalNutrientsから該当する栄養素を探す
            const nutrient = nutrition.totalNutrients.find(n => n.name === japaneseName);
            return nutrient ? nutrient.value : 0;
        }

        // コードから直接検索できない場合は、栄養素名での検索を試みる
        return nutrition.totalNutrients.find(n => {
            return n.name.toLowerCase() === nutrientName.toLowerCase();
        })?.value || 0;
    }

    /**
     * StandardizedMealNutrition の totalNutrients 配列内の栄養素を更新または追加する
     * @param nutrition 更新対象の栄養データ
     * @param nutrientName 更新/追加する栄養素の名前
     * @param value 設定する値
     * @param unit 設定する単位
     */
    private updateNutrient(nutrition: StandardizedMealNutrition, nutrientName: string, value: number, unit: NutrientUnit): void {
        const existingNutrient = nutrition.totalNutrients.find(n => n.name === nutrientName);
        if (existingNutrient) {
            existingNutrient.value = value;
            existingNutrient.unit = unit; // 単位も更新（通常は同じはずだが念のため）
        } else {
            nutrition.totalNutrients.push({ name: nutrientName, value, unit });
        }
    }

    /**
     * 2つの標準栄養データオブジェクトの栄養素を合計する (target に source を加算)
     * MVPの6栄養素に限定して処理
     */
    private accumulateNutrients(target: StandardizedMealNutrition, source: StandardizedMealNutrition): void {
        // 1. totalCalories を加算
        target.totalCalories += source.totalCalories;

        // 2. source の totalNutrients 配列内のすべての栄養素を target に加算
        source.totalNutrients.forEach(sourceNutrient => {
            // 'calories' は totalCalories で加算済みなのでスキップ
            if (sourceNutrient.name === 'calories') return;

            const targetNutrient = target.totalNutrients.find(n => n.name === sourceNutrient.name);
            if (targetNutrient) {
                // 同じ栄養素が target に存在すれば値を加算
                targetNutrient.value += sourceNutrient.value;
                // 単位が異なるケースは基本的に考慮しない（DB側での統一を前提とする）
            } else {
                // target に存在しなければ、新しいオブジェクトとして追加
                target.totalNutrients.push({ ...sourceNutrient });
            }
        });

        // 3. totalNutrients 配列内の 'calories' を totalCalories プロパティの値に更新 (一貫性のため)
        const targetCaloriesNutrient = target.totalNutrients.find(n => n.name === 'calories');
        if (targetCaloriesNutrient) {
            targetCaloriesNutrient.value = target.totalCalories;
        } else {
            // 配列に calories がなければ追加
            target.totalNutrients.push({ name: 'calories', value: target.totalCalories, unit: 'kcal' });
        }
    }

    /**
     * 標準栄養データの各栄養素を指定された比率でスケーリングする
     * totalCalories と totalNutrients 内のすべての栄養素を処理
     */
    private scaleNutrients(target: StandardizedMealNutrition, ratio: number): void {
        target.totalCalories *= ratio;
        target.totalNutrients.forEach(nutrient => {
            // すべての栄養素をスケール
            nutrient.value *= ratio;
        });
        // foodItems のスケーリングは calculateNutrition 内で行う
    }

    /**
     * 解析された食品入力リストを処理し、栄養計算を実行して最終的な分析結果を返す。
     * @param parsedFoods 解析済みの食品入力リスト (FoodInputParseResult 配列)
     * @returns 食品分析結果 (FoodAnalysisResult)
     * @throws {AppError(ErrorCode.Nutrition.FOOD_NOT_FOUND)} 有効な食品が一つも見つからない場合
     */
    async processParsedFoods(parsedFoods: FoodInputParseResult[]): Promise<FoodAnalysisResult> {
        const mealFoodItems: MealFoodItem[] = [];
        // detailedParseResults にマッチング結果も含める
        const detailedParseResults: Array<FoodInputParseResult & { matchedFood?: Food, parsedQuantity?: { quantity: FoodQuantity, confidence: number }, matchResult?: FoodMatchResult | null }> = [];
        const successfulMatchResults: FoodMatchResult[] = []; // 成功したマッチング結果のみ保持
        let totalConfidenceSum = 0;
        let processedCount = 0;

        for (const parsedItem of parsedFoods) {
            let matchedFood: Food | undefined = undefined;
            let parsedQuantityResult: { quantity: FoodQuantity, confidence: number } | undefined = undefined;
            let foodMatchResult: FoodMatchResult | null = null;
            let processingError: string | undefined = undefined;
            let overallConfidence = parsedItem.confidence;

            try {
                foodMatchResult = await this.foodMatchingService.matchFood(parsedItem.foodName);
                if (foodMatchResult && foodMatchResult.food) {
                    matchedFood = foodMatchResult.food;
                    parsedQuantityResult = QuantityParser.parseQuantity(
                        parsedItem.quantityText ?? undefined,
                        matchedFood.name,
                        matchedFood.category
                    );
                    overallConfidence = foodMatchResult.similarity * parsedQuantityResult.confidence * parsedItem.confidence;

                    mealFoodItems.push({
                        foodId: matchedFood.id,
                        food: matchedFood,
                        quantity: parsedQuantityResult.quantity,
                        confidence: overallConfidence,
                        originalInput: parsedItem.foodName,
                    });
                    totalConfidenceSum += overallConfidence;
                    processedCount++;
                    successfulMatchResults.push(foodMatchResult); // 成功結果のみ追加
                } else {
                    console.warn(`Food not found for input: ${parsedItem.foodName}`);
                    // foodMatchResult は null のまま
                }
            } catch (error) {
                console.error(`Error processing parsed food ${parsedItem.foodName}:`, error);
                processingError = error instanceof Error ? error.message : 'Unknown processing error';
                // foodMatchResult は null のまま
            }
            // 詳細結果を追加 (マッチング結果も含める)
            detailedParseResults.push({
                ...parsedItem,
                ...(matchedFood !== undefined ? { matchedFood } : {}),
                ...(parsedQuantityResult !== undefined ? { parsedQuantity: parsedQuantityResult } : {}),
                ...(foodMatchResult !== null ? { matchResult: foodMatchResult } : {}),
            });
        }

        if (mealFoodItems.length === 0) {
            console.warn("No processable food items found after matching and parsing.");
            // 空の FoodAnalysisResult を返す (型に準拠)
            const result: FoodAnalysisResult = {
                foods: detailedParseResults.map(p => ({
                    name: p.foodName,
                    quantity: p.quantityText,
                    ...(p.matchedFood?.id !== undefined ? { matchedFoodId: p.matchedFood.id } : {}),
                    matchConfidence: p.matchResult?.similarity ?? 0
                })),
                nutrition: this.initializeStandardizedNutrition(),
                reliability: { confidence: 0 },
                matchResults: successfulMatchResults
            };
            return result;
        }

        const nutritionCalculationResult = await this.calculateNutrition(mealFoodItems);
        const finalNutrition = nutritionCalculationResult.nutrition;
        const averageConfidence = processedCount > 0 ? totalConfidenceSum / processedCount : 0;

        // FoodAnalysisResult を構築 (型に準拠)
        const finalResult: FoodAnalysisResult = {
            foods: detailedParseResults.map(p => ({
                name: p.foodName,
                quantity: p.quantityText,
                ...(p.matchedFood?.id !== undefined ? { matchedFoodId: p.matchedFood.id } : {}),
                matchConfidence: p.matchResult?.similarity ?? 0
            })),
            nutrition: finalNutrition,
            reliability: {
                confidence: averageConfidence,
                ...(nutritionCalculationResult.reliability.balanceScore !== undefined ? { balanceScore: nutritionCalculationResult.reliability.balanceScore } : {}),
                ...(nutritionCalculationResult.reliability.completeness !== undefined ? { completeness: nutritionCalculationResult.reliability.completeness } : {}),
            },
            matchResults: successfulMatchResults
        };
        return finalResult;
    }
} 