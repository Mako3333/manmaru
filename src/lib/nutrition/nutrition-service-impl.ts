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
    convertToLegacyNutrition, // 追加 (後方互換性用)
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
//src\lib\nutrition\nutrition-service-impl.ts

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

        // initializeStandardizedNutrition を使用
        const scaledNutrition: StandardizedMealNutrition = this.initializeStandardizedNutrition();

        // --- ここから Food 型から StandardizedMealNutrition への変換ロジック ---
        // 将来的にはこのロジックは FoodRepository 層に移譲することが望ましい
        // MVPの6栄養素のみを変換
        scaledNutrition.totalCalories = food.calories || 0;
        this.updateNutrient(scaledNutrition, 'protein', food.protein || 0, 'g');
        this.updateNutrient(scaledNutrition, 'iron', food.iron || 0, 'mg');
        this.updateNutrient(scaledNutrition, 'folic_acid', food.folic_acid || 0, 'mcg');
        this.updateNutrient(scaledNutrition, 'calcium', food.calcium || 0, 'mg');
        this.updateNutrient(scaledNutrition, 'vitamin_d', food.vitamin_d || 0, 'mcg');
        // カロリーも totalNutrients 配列に反映
        this.updateNutrient(scaledNutrition, 'calories', scaledNutrition.totalCalories, 'kcal');
        // --- 変換ロジックここまで ---

        // 量に基づいてスケーリング (100gあたりから指定グラムへ)
        const ratio = grams > 0 ? grams / 100 : 0; // グラムが0または負なら比率も0
        // 修正された scaleNutrients を使用
        this.scaleNutrients(scaledNutrition, ratio);

        // Food 自体の信頼度と量の解析の信頼度を考慮
        const foodConfidence = food.confidence ?? 0.8; // 食品データ自体の信頼度 (なければデフォルト)
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
        // MVPの栄養素リスト
        const mvpNutrientNames = ['calories', 'protein', 'iron', 'calcium', 'folic_acid', 'vitamin_d'];

        let fulfillmentSum = 0;
        let targetCount = 0;

        for (const name of mvpNutrientNames) {
            const targetValue = targetValues[name];
            // 目標値が設定され、かつ0より大きい場合のみ評価対象とする
            if (typeof targetValue === 'number' && targetValue > 0) {
                const currentValue = this.getNutrientValue(nutrition, name);
                // 充足率を計算 (最大100% = 1.0)
                const fulfillmentRatio = Math.min(1.0, currentValue / targetValue);
                fulfillmentSum += fulfillmentRatio;
                targetCount++;
            }
        }

        // 評価対象の栄養素がなければスコアは0
        if (targetCount === 0) {
            return 0;
        }

        // 充足率の平均を計算し、100点満点に変換
        const averageFulfillment = fulfillmentSum / targetCount;
        const finalScore = averageFulfillment * 100;

        // 0-100の範囲に丸める
        return Math.max(0, Math.min(100, Math.round(finalScore)));
    }

    /**
     * 不足している栄養素を特定する（MVPの6栄養素に基づく）
     * 目標値に対する充足率が閾値未満の栄養素名を返す
     * @param nutrition 栄養データ
     * @param targetValues 目標値 (例: { calories: 2200, protein: 75, ... })
     * @param threshold 不足と判断する充足率の閾値 (デフォルト: 0.7)
     * @returns 不足している栄養素の詳細情報リスト
     */
    identifyDeficientNutrients(
        nutrition: StandardizedMealNutrition,
        targetValues: Record<string, number>,
        threshold: number = 0.7 // デフォルト値を設定
    ): NutrientDeficiency[] { // 戻り値の型を変更
        const deficiencies: NutrientDeficiency[] = [];

        const mvpNutrientNames = ['calories', 'protein', 'iron', 'calcium', 'folic_acid', 'vitamin_d'];

        for (const name of mvpNutrientNames) {
            const targetValue = targetValues[name];
            // 目標値が設定されている栄養素のみチェック
            if (typeof targetValue === 'number' && targetValue > 0) {
                const currentValue = this.getNutrientValue(nutrition, name);
                const fulfillmentRatio = currentValue / targetValue;

                if (fulfillmentRatio < threshold) {
                    deficiencies.push({ // 詳細情報を格納
                        nutrientCode: name,
                        fulfillmentRatio,
                        currentValue,
                        targetValue
                    });
                }
            }
        }
        return deficiencies; // 詳細情報の配列を返す
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
        const initialNutrients: Nutrient[] = [
            { name: 'calories', value: 0, unit: 'kcal' },
            { name: 'protein', value: 0, unit: 'g' },
            { name: 'iron', value: 0, unit: 'mg' },
            { name: 'calcium', value: 0, unit: 'mg' },
            { name: 'folic_acid', value: 0, unit: 'mcg' },
            { name: 'vitamin_d', value: 0, unit: 'mcg' },
        ];
        return createStandardizedMealNutrition({ totalNutrients: initialNutrients });
    }

    /**
     * StandardizedMealNutrition から特定の栄養素の値を取得する
     * @param nutrition 栄養データ
     * @param nutrientName 取得したい栄養素の名前
     * @returns 栄養素の値。見つからない場合は 0 を返す。
     */
    private getNutrientValue(nutrition: StandardizedMealNutrition, nutrientName: string): number {
        const nutrient = nutrition.totalNutrients.find(n => n.name === nutrientName);
        return nutrient?.value ?? 0;
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
        // 1. totalCalories を加算 (これを正とする)
        target.totalCalories += source.totalCalories;

        // 2. MVPの他の栄養素 (protein, iron, calcium, folic_acid, vitamin_d) を totalNutrients 配列で加算
        const mvpOtherNutrients = ['protein', 'iron', 'calcium', 'folic_acid', 'vitamin_d'];
        mvpOtherNutrients.forEach(name => {
            const sourceValue = this.getNutrientValue(source, name);
            if (sourceValue > 0) {
                const targetNutrient = target.totalNutrients.find(n => n.name === name);
                if (targetNutrient) {
                    targetNutrient.value += sourceValue;
                } else {
                    // source から単位を取得して追加 (通常は initialize で初期化済みのはず)
                    const sourceNutrient = source.totalNutrients.find(n => n.name === name);
                    if (sourceNutrient) {
                        target.totalNutrients.push({ ...sourceNutrient }); // 新しいオブジェクトとして追加
                    }
                }
            }
        });

        // 3. totalNutrients 配列内の 'calories' を totalCalories プロパティの値に更新 (一貫性のため)
        const targetCaloriesNutrient = target.totalNutrients.find(n => n.name === 'calories');
        if (targetCaloriesNutrient) {
            targetCaloriesNutrient.value = target.totalCalories;
        } else {
            // 配列に calories がなければ追加 (通常 initialize で初期化済み)
            target.totalNutrients.push({ name: 'calories', value: target.totalCalories, unit: 'kcal' });
        }
    }

    /**
     * 標準栄養データの各栄養素を指定された比率でスケーリングする
     * MVPの6栄養素に限定して処理
     */
    private scaleNutrients(target: StandardizedMealNutrition, ratio: number): void {
        target.totalCalories *= ratio;
        target.totalNutrients.forEach(nutrient => {
            // MVPの6栄養素のみスケール
            if (['calories', 'protein', 'iron', 'calcium', 'folic_acid', 'vitamin_d'].includes(nutrient.name)) {
                nutrient.value *= ratio;
            }
        });
        // foodItems のスケーリングは calculateNutrition 内で行う
    }

    /**
     * AIレスポンスパーサーからの解析結果を処理し、栄養計算と結果強化を行う
     * @param parsedFoods AIによって解析された食品情報の配列
     * @returns 食品分析結果
     */
    async processParsedFoods(parsedFoods: FoodInputParseResult[]): Promise<FoodAnalysisResult> {
        const mealFoodItems: MealFoodItem[] = [];
        const notFoundFoods: string[] = [];
        const matchDetails: FoodMatchResult[] = [];

        for (const parsedFood of parsedFoods) {
            try {
                const matchResult = await this.foodMatchingService.matchFood(parsedFood.foodName);

                if (matchResult && matchResult.food) {
                    const parsedQuantity = QuantityParser.parseQuantity(
                        parsedFood.quantityText ?? undefined,
                        matchResult.food.name,
                        matchResult.food.category
                    );

                    mealFoodItems.push({
                        foodId: matchResult.food.id,
                        food: matchResult.food,
                        quantity: parsedQuantity.quantity,
                        confidence: matchResult.similarity * parsedQuantity.confidence * (parsedFood.confidence ?? 1.0),
                        originalInput: parsedFood.foodName
                    });
                    matchDetails.push(matchResult);
                } else {
                    notFoundFoods.push(parsedFood.foodName);
                    // 低信頼度マッチやマッチなしに関する警告を追加することも検討
                    console.warn(`Food not found or matched with low confidence for input: ${parsedFood.foodName}`);
                }
            } catch (error) {
                console.error(`Error processing parsed food ${parsedFood.foodName}:`, error);
                notFoundFoods.push(parsedFood.foodName);
                // 個別の食品処理エラー。ログには残すが、処理全体は続行。
                // 全体として食品が見つからなかった場合は、後続のチェックで AppError をスローする。
                // 必要であれば、エラーを集約して最後にまとめて報告する設計も可能。
            }
        }

        // 1つも有効な食品アイテムが見つからなかった場合のエラーハンドリングを追加
        if (mealFoodItems.length === 0) {
            throw new AppError({
                code: ErrorCode.Nutrition.FOOD_NOT_FOUND,
                message: `No valid food items could be processed from the input: ${parsedFoods.map(p => p.foodName).join(', ')}`,
                userMessage: '入力された食品を処理できませんでした。食品名や量を確認してください。',
                details: { parsedFoods, notFoundFoods }
            });
        }

        // calculateNutrition を呼び出して StandardizedMealNutrition を取得
        const calculationResult = await this.calculateNutrition(mealFoodItems);
        const finalNutrition = calculationResult.nutrition;

        // FoodAnalysisResult 形式に変換 (nutrition 部分)
        // convertToLegacyNutrition を使用してフラットな構造を作る
        // 注意: この変換では foodItems の情報は失われる
        const legacyNutrition = convertToLegacyNutrition(finalNutrition);

        // FoodAnalysisResult を構築
        const result: FoodAnalysisResult = {
            foods: mealFoodItems.map(item => ({
                name: item.originalInput || item.food.name,
                quantity: `${item.quantity.value}${item.quantity.unit}`, // 元の形式に近い文字列で返す
                confidence: item.confidence
            })),
            nutrition: {
                calories: legacyNutrition.calories,
                protein: legacyNutrition.protein,
                iron: legacyNutrition.iron,
                folic_acid: legacyNutrition.folic_acid,
                calcium: legacyNutrition.calcium,
                vitamin_d: legacyNutrition.vitamin_d,
                confidence_score: calculationResult.reliability.confidence
            },
            meta: {
                notFoundFoods: notFoundFoods,
                calculationTime: 'N/A', // 必要であれば計測・設定
                matchedFoods: matchDetails.map(md => ({
                    original: md.originalInput,
                    matched: md.food.name,
                    similarity: md.similarity
                }))
                // 他のメタ情報も必要に応じて追加
            }
        };

        return result;
    }
} 