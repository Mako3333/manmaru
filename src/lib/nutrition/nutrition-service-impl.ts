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
import { getNutrientValueByName } from './nutrition-display-utils'; // getNutrientValueByName関数をインポート
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
        // Foodオブジェクトの全ての栄養素関連プロパティをコピーする
        for (const key in food) {
            if (Object.prototype.hasOwnProperty.call(food, key)) {
                const value = (food as any)[key];
                // 数値型のプロパティで、かつ0以上の値を栄養素とみなす（id, confidenceなどを除く）
                // TODO: より堅牢な栄養素判定ロジック（例: 栄養素名のリストと比較）を検討
                if (typeof value === 'number' && value >= 0 && !['id', 'confidence', 'servingSize', 'servingUnit', 'categoryId', 'datasourceId'].includes(key)) {
                    // 単位を推測（仮実装、Food型定義に単位情報を持たせるべき）
                    let unit: NutrientUnit = 'g'; // デフォルトはグラム
                    if (key === 'calories') unit = 'kcal';
                    else if (key === 'iron' || key === 'calcium' || key === 'sodium' || key === 'potassium' || key === 'zinc' || key === 'manganese' || key === 'copper') unit = 'mg';
                    else if (key === 'folic_acid' || key === 'vitamin_d' || key === 'vitamin_b12' || key === 'vitamin_a' || key === 'vitamin_k' || key === 'biotin' || key === 'iodine' || key === 'selenium') unit = 'mcg';
                    else if (key === 'vitamin_e' || key === 'niacin' || key === 'pantothenic_acid' || key === 'vitamin_b6' || key === 'vitamin_c') unit = 'mg'; // α-TEなども考慮が必要だが一旦mg

                    // totalCaloriesも更新
                    if (key === 'calories') {
                        scaledNutrition.totalCalories = value;
                    }
                    // updateNutrientを呼び出してtotalNutrients配列に追加
                    this.updateNutrient(scaledNutrition, key, value, unit);
                }
            }
        }
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
                const currentValue = getNutrientValueByName(nutrition, name);
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
     * @param threshold 不足と判断する充足率の閾値 (0.0-1.0、デフォルト: 0.7)
     * @returns 不足している栄養素の詳細情報リスト
     */
    identifyDeficientNutrients(
        nutrition: StandardizedMealNutrition,
        targetValues: Record<string, number>,
        threshold: number = 0.7 // デフォルト値を設定
    ): NutrientDeficiency[] { // 戻り値の型を変更
        const deficientNutrients: NutrientDeficiency[] = [];

        // 各栄養素について評価
        for (const [nutrientCode, targetValue] of Object.entries(targetValues)) {
            // 目標値が0以下の場合はスキップ
            if (targetValue <= 0) continue;

            // 現在の摂取量を取得
            const currentValue = getNutrientValueByName(nutrition, nutrientCode);

            // 充足率を計算
            const fulfillmentRatio = currentValue / targetValue;

            // 充足率が閾値未満なら不足と判断
            if (fulfillmentRatio < threshold) {
                deficientNutrients.push({
                    nutrientCode,
                    fulfillmentRatio,
                    currentValue,
                    targetValue
                });
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