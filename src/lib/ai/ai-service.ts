import { z } from 'zod';
import { AIModelFactory } from './model-factory';
import { PromptService, PromptType } from './prompts/prompt-service';
import { AIError, ErrorCode as AIErrorCode } from '@/lib/errors/ai-error';
import { NutritionDatabase, NutritionDatabaseLLMAPI } from '@/lib/nutrition/database';
import { FoodItem, NutritionData, DatabaseFoodItem } from '@/types/nutrition';
import { FoodAnalysisError, ErrorCode as FoodErrorCode } from '@/lib/errors/food-analysis-error';

// 食品分析結果の型とスキーマ
export interface FoodAnalysisResult {
    foods: Array<{
        name: string;
        quantity: string;
        confidence: number;
    }>;
    nutrition: {
        calories: number;
        protein: number;
        iron: number;
        folic_acid: number;
        calcium: number;
        vitamin_d?: number;
        confidence_score: number;
    };
    meta?: {
        notFoundFoods?: string[];
        warning?: string;
        source?: string;
        searchDetail?: string;
        calculationTime?: string;
        [key: string]: any;
    };
}

// Zodスキーマでの結果検証
const foodAnalysisSchema = z.object({
    foods: z.array(z.object({
        name: z.string().min(1, "食品名は必須です"),
        quantity: z.string(),
        confidence: z.number().min(0).max(1)
    })).min(1, "少なくとも1つの食品が必要です"),
    nutrition: z.object({
        calories: z.number().min(0),
        protein: z.number().min(0),
        iron: z.number().min(0),
        folic_acid: z.number().min(0),
        calcium: z.number().min(0),
        vitamin_d: z.number().min(0).optional(),
        confidence_score: z.number().min(0).max(1)
    })
});

// 栄養アドバイス結果の型
export interface NutritionAdviceResult {
    summary: string;
    detailedAdvice?: string;
    recommendedFoods?: Array<{
        name: string;
        benefits: string;
    }>;
}

// 食品入力の型
export interface FoodInput {
    name: string;
    quantity?: string;
}

/**
 * 統合型AIサービスクラス
 * AIモデル呼び出しからレスポンスのパースまで一元管理
 */
export class AIService {
    private static instance: AIService;
    private promptService: PromptService;
    private nutritionDatabase: NutritionDatabaseLLMAPI;

    private constructor() {
        console.log('AIService: インスタンス作成');
        try {
            this.promptService = PromptService.getInstance();
            this.nutritionDatabase = NutritionDatabase.getInstance();
            console.log('AIService: 栄養データベースインスタンス取得成功');
        } catch (error) {
            console.error('AIService: 栄養データベースインスタンス取得エラー:', error);
            throw new FoodAnalysisError(
                '栄養データベースの初期化に失敗しました',
                FoodErrorCode.DB_INIT_ERROR,
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    /**
     * シングルトンインスタンス取得
     */
    static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    /**
     * データベースの初期化状態を確認
     */
    private async ensureDatabaseInitialized(): Promise<void> {
        try {
            const status = this.nutritionDatabase.getDatabaseStatus();
            console.log('AIService: データベース状態確認:', status);

            if (!status.isReady && status.itemCount <= 10) {
                console.log('AIService: 拡張データベースを読み込みます');
                await this.nutritionDatabase.loadExternalDatabase();

                // 読み込み後の状態を再確認
                const newStatus = this.nutritionDatabase.getDatabaseStatus();
                console.log('AIService: データベース読み込み後の状態:', newStatus);

                if (!newStatus.isReady) {
                    console.warn('AIService: 拡張データベースの読み込みに失敗しましたが、基本データベースで続行します');
                }
            }
        } catch (error) {
            console.error('AIService: データベース初期化確認エラー:', error);
            // 初期化エラーでも処理は続行（基本データベースを使用）
        }
    }

    /**
     * 食事写真の解析を行う
     * @param image 画像データ（Base64）
     * @param mealType 食事タイプ
     * @param trimester 妊娠期（オプション）
     */
    async analyzeMeal(
        image: string,
        mealType: string,
        trimester?: number
    ): Promise<FoodAnalysisResult> {
        // プロンプト生成
        const prompt = this.promptService.generatePrompt(PromptType.FOOD_ANALYSIS, {
            mealType,
            trimester
        });

        // モデル呼び出し
        const model = AIModelFactory.createVisionModel({
            temperature: 0.1
        });

        try {
            const response = await model.invokeWithImageData!(prompt, image);
            const responseText = response.toString();

            // JSONパース処理
            return this.parseJSONResponse<FoodAnalysisResult>(
                responseText,
                foodAnalysisSchema,
                'foods'
            );
        } catch (error) {
            if (error instanceof AIError) throw error;

            throw new AIError(
                '食事分析中にエラーが発生しました',
                AIErrorCode.AI_MODEL_ERROR,
                error
            );
        }
    }

    /**
     * テキスト入力の解析を行う
     * @param foods 食品リスト
     * @param mealType 食事タイプ（オプション）
     */
    async analyzeTextInput(
        foods: FoodInput[],
        mealType: string = 'その他'
    ): Promise<FoodAnalysisResult> {
        console.log('AIService: テキスト入力解析開始', { foods, mealType });

        // 入力データの検証
        if (!foods || foods.length === 0) {
            throw new FoodAnalysisError(
                '食品データが必要です',
                FoodErrorCode.VALIDATION_ERROR
            );
        }

        // 空の食品名をフィルタリング
        const validFoods = foods.filter(food => food.name && food.name.trim() !== '');

        if (validFoods.length === 0) {
            throw new FoodAnalysisError(
                '有効な食品データが必要です',
                FoodErrorCode.VALIDATION_ERROR
            );
        }

        // データベース初期化確認
        await this.ensureDatabaseInitialized();

        // 食品データをテキスト形式に変換
        const foodsText = validFoods.map(food =>
            `${food.name.trim()}${food.quantity ? ` ${food.quantity.trim()}` : ''}`
        ).join('、');

        console.log('AIService: 解析対象食品テキスト:', foodsText);

        // プロンプト生成
        const prompt = this.promptService.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, {
            foodsText,
            mealType
        });

        // モデル呼び出し
        const model = AIModelFactory.createTextModel({
            temperature: 0.2
        });

        try {
            const response = await model.invoke(prompt);
            const responseText = response.toString();

            // AIからのレスポンスをログ出力（長いレスポンスは省略）
            console.log('AIService: AIからのレスポンス:',
                responseText.length > 500
                    ? responseText.substring(0, 500) + '...'
                    : responseText
            );

            // JSONパース処理
            let result: FoodAnalysisResult;
            try {
                result = this.parseJSONResponse<FoodAnalysisResult>(
                    responseText,
                    foodAnalysisSchema,
                    'foods'
                );

                // foodsフィールドの存在確認（念のため）
                if (!result.foods || !Array.isArray(result.foods) || result.foods.length === 0) {
                    console.warn('AIService: foods配列が空または存在しないため、入力データから自動生成します');
                    result.foods = validFoods.map(food => ({
                        name: food.name.trim(),
                        quantity: food.quantity?.trim() || '', // undefinedの場合は空文字列に変換
                        confidence: 0.7
                    }));
                }
            } catch (parseError) {
                console.error('AIService: JSONパースエラー、データベースを使用してフォールバック処理を実行:', parseError);

                // 最適化: データベースAPIを使用した栄養計算
                result = await this.calculateNutritionUsingDatabase(validFoods);
            }

            // AIの結果をさらに正確にするためにデータベースを活用
            result = await this.enhanceResultWithDatabase(result);

            return result;
        } catch (error) {
            console.error('AIService: テキスト解析エラー:', error);
            throw new FoodAnalysisError(
                'テキスト解析中にエラーが発生しました',
                FoodErrorCode.AI_MODEL_ERROR,
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    /**
     * 食品リストから栄養計算を行う（データベース使用）
     * @private
     */
    private async calculateNutritionUsingDatabase(foods: FoodInput[]): Promise<FoodAnalysisResult> {
        console.log('AIService: データベースを使用した栄養計算を開始');

        // 食品データを標準形式に変換
        const foodItems: FoodItem[] = foods.map(food => ({
            name: food.name.trim(),
            quantity: food.quantity?.trim(),
            confidence: 0.7
        }));

        // データベースがNutritionDatabaseインスタンスであることを確認してからcalculateNutritionを呼び出す
        if (!(this.nutritionDatabase instanceof NutritionDatabase)) {
            throw new AIError(
                '栄養データベースが適切に初期化されていません',
                AIErrorCode.NUTRITION_CALCULATION_ERROR
            );
        }

        // 栄養計算を実行 (NutritionDatabaseクラスのメソッドとして呼び出す)
        const nutritionData = await (this.nutritionDatabase as NutritionDatabase).calculateNutrition(foodItems);

        // 結果の構築
        const result: FoodAnalysisResult = {
            foods: foodItems.map(food => ({
                name: food.name,
                quantity: food.quantity || '1人前',
                confidence: food.confidence || 0.7
            })),
            nutrition: {
                calories: nutritionData.calories,
                protein: nutritionData.protein,
                iron: nutritionData.iron,
                folic_acid: nutritionData.folic_acid,
                calcium: nutritionData.calcium,
                vitamin_d: nutritionData.vitamin_d,
                confidence_score: nutritionData.confidence_score || 0.5
            },
            meta: {
                notFoundFoods: nutritionData.notFoundFoods || [],
                source: 'database',
                searchDetail: (nutritionData.notFoundFoods || []).length > 0
                    ? '一部の食品がデータベースに見つかりませんでした'
                    : 'すべての食品がデータベースで見つかりました',
                calculationTime: new Date().toISOString()
            }
        };

        return result;
    }

    /**
     * 解析結果をデータベース情報で強化
     * @private
     */
    private async enhanceResultWithDatabase(result: FoodAnalysisResult): Promise<FoodAnalysisResult> {
        console.log('AIService: 解析結果をデータベース情報で強化');

        // 結果の食品名を使用して、データベースから正確な栄養情報を検索
        for (let i = 0; i < result.foods.length; i++) {
            const food = result.foods[i];

            // 完全一致検索
            let dbFood = this.nutritionDatabase.getFoodByExactName(food.name);

            // 完全一致がない場合は部分一致検索
            if (!dbFood) {
                const similarFoods = this.nutritionDatabase.getFoodsByPartialName(food.name, 1);
                if (similarFoods.length > 0) {
                    dbFood = similarFoods[0];
                    // 類似食品が見つかった場合は情報を更新
                    result.foods[i].name = dbFood.name;
                    food.confidence = Math.min(food.confidence, 0.8); // 信頼度を調整
                }
            }

            // データベースに食品が見つかった場合、信頼度を高く設定
            if (dbFood) {
                result.foods[i].confidence = Math.max(food.confidence, 0.9);
            }
        }

        // 栄養計算の再実行（データベースの情報を使用）
        if (result.foods.length > 0) {
            // 食品データを標準形式に変換
            const foodItems: FoodItem[] = result.foods.map(food => ({
                name: food.name,
                quantity: food.quantity,
                confidence: food.confidence
            }));

            // データベースがNutritionDatabaseインスタンスであることを確認してからcalculateNutritionを呼び出す
            if (!(this.nutritionDatabase instanceof NutritionDatabase)) {
                return result; // 適切なDBインスタンスがなければ現在の結果を返す
            }

            // 栄養計算を実行（NutritionDatabaseクラスのメソッドとして呼び出す）
            const nutritionData = await (this.nutritionDatabase as NutritionDatabase).calculateNutrition(foodItems);

            // より信頼性の高い栄養情報で更新
            if (nutritionData) {
                result.nutrition = {
                    calories: nutritionData.calories || 0,
                    protein: nutritionData.protein || 0,
                    iron: nutritionData.iron || 0,
                    folic_acid: nutritionData.folic_acid || 0,
                    calcium: nutritionData.calcium || 0,
                    vitamin_d: nutritionData.vitamin_d || 0,
                    confidence_score: nutritionData.confidence_score || 0.8 // データベース使用なので信頼度は高め
                };
            }
        }

        return result;
    }

    /**
     * 栄養アドバイスの生成
     */
    async getNutritionAdvice(params: {
        pregnancyWeek: number;
        trimester: number;
        deficientNutrients: string[];
        formattedDate: string;
        currentSeason: string;
        pastNutritionData?: Array<{
            date: string;
            overallScore: number;
            nutrients: {
                calories: { percentage: number };
                protein: { percentage: number };
                iron: { percentage: number };
                folic_acid: { percentage: number };
                calcium: { percentage: number };
                vitamin_d: { percentage: number };
            };
        }>;
    }): Promise<NutritionAdviceResult> {
        // プロンプト生成
        const prompt = this.promptService.generatePrompt(PromptType.NUTRITION_ADVICE, {
            ...params
        });

        console.log('AIService: 栄養アドバイス生成開始', {
            pregnancyWeek: params.pregnancyWeek,
            trimester: params.trimester,
            deficientNutrientsCount: params.deficientNutrients.length,
            pastNutritionDataCount: params.pastNutritionData?.length || 0 // 追加
        }); // デバッグ用ログ

        // プロンプトの内容をログ出力
        console.log('AIService: 生成されたプロンプト:', prompt);

        // モデル呼び出し
        const model = AIModelFactory.createTextModel({
            temperature: 0.7
        });

        try {
            const response = await model.invoke(prompt);
            const responseText = response.toString();

            // AIからのレスポンスをログ出力
            console.log('AIService: AIからのレスポンス:', responseText);

            // テキスト形式の応答をパース
            return this.parseNutritionAdvice(responseText);
        } catch (error) {
            if (error instanceof AIError) throw error;

            throw new AIError(
                '栄養アドバイス生成中にエラーが発生しました',
                AIErrorCode.AI_MODEL_ERROR,
                error
            );
        }
    }

    /**
     * AIからのJSON応答をパース
     */
    private parseJSONResponse<T>(
        responseText: string,
        schema?: z.ZodSchema<T>,
        requiredField?: string
    ): T {
        try {
            // JSONパターンの抽出
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);

            if (!jsonMatch) {
                console.error('AIService: JSON形式が見つかりません:', responseText);
                throw new AIError(
                    'JSONレスポンスの形式が不正です',
                    AIErrorCode.RESPONSE_PARSE_ERROR,
                    responseText
                );
            }

            // JSON抽出
            const jsonStr = (jsonMatch[1] || jsonMatch[2]).trim();
            console.log('AIService: 抽出されたJSON文字列:', jsonStr.substring(0, 200) + '...');

            // JSONパース
            let parsed: any;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (parseError) {
                console.error('AIService: JSONパースエラー:', parseError);

                // JSON構文エラーの場合は、文字列を修正して再試行
                const fixedJsonStr = this.attemptToFixJson(jsonStr);
                if (fixedJsonStr !== jsonStr) {
                    try {
                        parsed = JSON.parse(fixedJsonStr);
                        console.log('AIService: 修正後のJSONをパースしました');
                    } catch (secondError) {
                        console.error('AIService: 修正JSON再パースでもエラー:', secondError);
                        throw new AIError(
                            'JSONの解析に失敗しました',
                            AIErrorCode.RESPONSE_PARSE_ERROR,
                            { error: parseError, text: jsonStr }
                        );
                    }
                } else {
                    throw new AIError(
                        'JSONの解析に失敗しました',
                        AIErrorCode.RESPONSE_PARSE_ERROR,
                        { error: parseError, text: jsonStr }
                    );
                }
            }

            // 必須フィールドの確認と自動修正
            if (requiredField && !parsed[requiredField]) {
                console.warn(`AIService: 必須フィールド "${requiredField}" が見つかりません - 自動修正します`);

                // 特定のフィールドが欠落している場合の対処
                if (requiredField === 'foods') {
                    // foodsフィールドがない場合は空の配列を設定
                    parsed.foods = [];

                    // 代替フィールドを探す試み
                    if (parsed.food) {
                        console.log('AIService: "food" フィールドを "foods" として使用します');
                        if (Array.isArray(parsed.food)) {
                            parsed.foods = parsed.food;
                        } else if (typeof parsed.food === 'object') {
                            parsed.foods = [parsed.food];
                        }
                    } else if (parsed.items) {
                        console.log('AIService: "items" フィールドを "foods" として使用します');
                        if (Array.isArray(parsed.items)) {
                            parsed.foods = parsed.items;
                        }
                    } else if (parsed.foodItems) {
                        console.log('AIService: "foodItems" フィールドを "foods" として使用します');
                        if (Array.isArray(parsed.foodItems)) {
                            parsed.foods = parsed.foodItems;
                        }
                    } else if (parsed.enhancedFoods) {
                        console.log('AIService: "enhancedFoods" フィールドを "foods" として使用します');
                        if (Array.isArray(parsed.enhancedFoods)) {
                            parsed.foods = parsed.enhancedFoods.map((item: any) => ({
                                name: item.name || "不明な食品",
                                quantity: item.quantity || "1人前",
                                confidence: item.confidence || 0.7
                            }));
                        }
                    }
                }

                // 他のフィールドの対処も必要に応じて追加
            }

            // スキーマ検証（オプション）とデータ修正
            if (schema) {
                const result = schema.safeParse(parsed);
                if (!result.success) {
                    console.error('AIService: スキーマ検証エラー:', result.error.issues);

                    // FoodAnalysisResult形式のスキーマエラー時の特別処理
                    if (requiredField === 'foods') {
                        // 必須項目の設定
                        if (!parsed.foods) parsed.foods = [];

                        // foods配列のアイテムを確認、修正
                        if (Array.isArray(parsed.foods)) {
                            parsed.foods = parsed.foods.map((item: any) => ({
                                name: item.name || "不明な食品",
                                quantity: item.quantity || "",
                                confidence: item.confidence || 0.5
                            }));
                        }

                        // nutritionフィールド確認、修正
                        if (!parsed.nutrition) {
                            parsed.nutrition = {
                                calories: 0,
                                protein: 0,
                                iron: 0,
                                folic_acid: 0,
                                calcium: 0,
                                vitamin_d: 0,
                                confidence_score: 0.5
                            };
                        } else {
                            // 各栄養素フィールドが存在することを確認
                            const nutritionDefaults = {
                                calories: 0,
                                protein: 0,
                                iron: 0,
                                folic_acid: 0,
                                calcium: 0,
                                vitamin_d: 0,
                                confidence_score: 0.5
                            };

                            parsed.nutrition = {
                                ...nutritionDefaults,
                                ...parsed.nutrition
                            };
                        }

                        // 再検証
                        const recheck = schema.safeParse(parsed);
                        if (recheck.success) {
                            console.log('AIService: 自動修正によりスキーマ検証に成功しました');
                            return recheck.data;
                        }
                    }

                    // それでも失敗する場合はエラー
                    throw new AIError(
                        'データ検証エラー',
                        AIErrorCode.VALIDATION_ERROR,
                        { errors: result.error.issues, data: parsed }
                    );
                }
                return result.data;
            }

            return parsed;
        } catch (error) {
            // AIErrorをそのまま再スロー
            if (error instanceof AIError) throw error;

            // その他のエラーはAIErrorに変換
            throw new AIError(
                'JSONの解析処理中にエラーが発生しました',
                AIErrorCode.RESPONSE_PARSE_ERROR,
                error
            );
        }
    }

    /**
     * JSON文字列の修正を試みる
     */
    private attemptToFixJson(jsonStr: string): string {
        try {
            // 一般的なJSON構文エラーの修正

            // 1. 不要なテキストの除去
            let fixed = jsonStr.replace(/[\r\n\t]+/g, ' ');

            // 2. クォーテーションの修正
            fixed = fixed.replace(/(['"])([a-zA-Z0-9_]+)(['"]):/g, '"$2":');

            // 3. 欠落したクォーテーションの追加
            fixed = fixed.replace(/:([a-zA-Z]+)/g, ':"$1"');

            // 4. 末尾のカンマを修正
            fixed = fixed.replace(/,\s*([}\]])/g, '$1');

            // 5. 誤った構文の修正
            fixed = fixed.replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

            console.log('AIService: JSON修正を試みました');
            return fixed;
        } catch (error) {
            console.error('AIService: JSON修正エラー:', error);
            return jsonStr; // 修正に失敗した場合は元の文字列を返す
        }
    }

    /**
     * 栄養アドバイステキストのパース
     */
    private parseNutritionAdvice(responseText: string): NutritionAdviceResult {
        console.log('AIService: パース開始', { textLength: responseText.length }); // デバッグ用ログ

        // JSONレスポンスかどうかを確認
        if (responseText.includes('"advice_summary"') && responseText.includes('"advice_detail"')) {
            try {
                // JSONの部分を抽出
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0];
                    const parsedData = JSON.parse(jsonStr);

                    console.log('AIService: JSONレスポンスを検出', {
                        summaryLength: parsedData.advice_summary?.length || 0,
                        detailLength: parsedData.advice_detail?.length || 0
                    });

                    // 推奨食品の形式を変換
                    let recommendedFoods: Array<{ name: string, benefits: string }> = [];
                    if (parsedData.recommended_foods && Array.isArray(parsedData.recommended_foods)) {
                        recommendedFoods = parsedData.recommended_foods.map((food: any) => ({
                            name: food.name || '',
                            benefits: food.description || food.benefits || ''
                        }));
                    }

                    return {
                        summary: parsedData.advice_summary || '',
                        detailedAdvice: parsedData.advice_detail || '',
                        recommendedFoods: recommendedFoods
                    };
                }
            } catch (error) {
                console.error('AIService: JSONパースエラー', error);
                // JSONパースに失敗した場合は通常のテキスト処理に進む
            }
        }

        // 通常のテキスト処理（JSONでない場合）
        // テキストを段落に分割
        const paragraphs = responseText.split(/\n\s*\n/);

        // 最初の段落を要約として抽出（最大150文字まで）
        let summary = '';
        if (paragraphs.length > 0) {
            const firstParagraph = this.cleanupText(paragraphs[0]);
            summary = firstParagraph.length > 150
                ? firstParagraph.substring(0, 147) + '...'
                : firstParagraph;
        } else {
            summary = this.cleanupText(responseText.substring(0, 150) + '...');
        }

        // 推奨食品セクションを探す
        const foodSectionIndex = responseText.indexOf('### 推奨食品');

        // 詳細アドバイスを抽出
        let detailedAdvice = '';
        if (foodSectionIndex !== -1) {
            // 推奨食品セクションがある場合、その前までを詳細アドバイスとする
            detailedAdvice = this.cleanupText(responseText.substring(0, foodSectionIndex));
        } else {
            // 推奨食品セクションがない場合、全文を詳細アドバイスとする
            detailedAdvice = this.cleanupText(responseText);
        }

        // 詳細アドバイスが要約と同じ場合は、要約を除いた部分を詳細アドバイスとする
        if (detailedAdvice.startsWith(summary) && detailedAdvice.length > summary.length) {
            detailedAdvice = this.cleanupText(detailedAdvice.substring(summary.length));
        }

        // 詳細アドバイスが空の場合は、要約をそのまま詳細アドバイスとする
        if (!detailedAdvice && summary) {
            detailedAdvice = summary;
        }

        // 推奨食品リストを抽出
        let recommendedFoods: Array<{ name: string, benefits: string }> = [];
        if (foodSectionIndex !== -1) {
            const foodSectionText = responseText.substring(foodSectionIndex);
            recommendedFoods = this.extractRecommendedFoods(foodSectionText);
        }

        // 推奨食品が見つからない場合は、デフォルトの推奨食品を設定
        if (recommendedFoods.length === 0) {
            recommendedFoods = [
                { name: '葉物野菜', benefits: '葉酸が豊富で胎児の神経管の発達に重要です' },
                { name: '乳製品', benefits: 'カルシウムが豊富で骨の発達に役立ちます' },
                { name: '果物', benefits: 'ビタミンが豊富で免疫力向上に役立ちます' }
            ];
        }

        console.log('AIService: パース結果', {
            summaryLength: summary.length,
            detailedAdviceLength: detailedAdvice.length,
            recommendedFoodsCount: recommendedFoods.length
        }); // デバッグ用ログ

        return {
            summary,
            detailedAdvice,
            recommendedFoods
        };
    }

    /**
     * 推奨食品リストを抽出
     */
    private extractRecommendedFoods(text: string): Array<{ name: string, benefits: string }> {
        const foods: Array<{ name: string, benefits: string }> = [];
        console.log('extractRecommendedFoods: 開始', { textLength: text.length }); // デバッグ用ログ

        try {
            // 推奨食品セクションを探す
            if (!text.includes('### 推奨食品')) {
                console.log('extractRecommendedFoods: 推奨食品セクションが見つかりませんでした'); // デバッグ用ログ
                return foods;
            }

            // 推奨食品セクション以降のテキストを取得
            const foodSectionText = text.substring(text.indexOf('### 推奨食品'));
            console.log('extractRecommendedFoods: セクションテキスト', {
                length: foodSectionText.length,
                preview: foodSectionText.substring(0, 100) + '...'
            }); // デバッグ用ログ

            // 箇条書きアイテムを抽出
            const lines = foodSectionText.split('\n');
            for (let i = 1; i < lines.length; i++) { // 1から開始して「### 推奨食品」の行をスキップ
                const line = lines[i].trim();

                // 空行はスキップ
                if (!line) continue;

                // 箇条書きの行を検出
                if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
                    const content = line.substring(1).trim();
                    console.log('extractRecommendedFoods: 箇条書き検出', { content }); // デバッグ用ログ

                    // 食品名と利点を分離
                    const colonIndex = content.indexOf('：');
                    const colonIndex2 = content.indexOf(':');
                    const separatorIndex = colonIndex !== -1 ? colonIndex : colonIndex2;

                    if (separatorIndex !== -1) {
                        foods.push({
                            name: content.substring(0, separatorIndex).trim(),
                            benefits: content.substring(separatorIndex + 1).trim()
                        });
                    } else if (content) {
                        // 区切りがない場合は食品名のみとして扱う
                        foods.push({
                            name: content,
                            benefits: '栄養バランスの向上に役立ちます'
                        });
                    }
                }

                // 次のセクションが始まったら終了
                if (i > 1 && line.startsWith('###') && !line.includes('推奨食品')) {
                    break;
                }
            }

            console.log('extractRecommendedFoods: 抽出結果', { count: foods.length }); // デバッグ用ログ
        } catch (error) {
            console.error('extractRecommendedFoods: エラー発生', error);
            // エラーが発生した場合でも空の配列を返す
        }

        return foods;
    }

    /**
     * テキストのクリーンアップ
     */
    private cleanupText(text: string): string {
        return text
            .replace(/^[#\s]+|[#\s]+$/g, '') // 先頭と末尾の#や空白を削除
            .replace(/\n{3,}/g, '\n\n')      // 3つ以上の連続改行を2つに
            .trim();
    }

    private generatePrompt(foods: string[], mealType: string): string {
        return `
以下の食事内容の栄養価を分析してください。必ず指定されたJSON形式で回答してください。

食事タイプ: ${mealType}
食事内容:
${foods.join('\n')}

レスポンス形式:
{
    "foods": [
        {
            "name": "食品名",
            "amount": "量（g）",
            "calories": "カロリー（kcal）",
            "protein": "タンパク質（g）",
            "fat": "脂質（g）",
            "carbohydrate": "炭水化物（g）",
            "confidence": "信頼度（0-1）"
        }
    ],
    "analysis": {
        "total_calories": "合計カロリー（kcal）",
        "total_protein": "合計タンパク質（g）",
        "total_fat": "合計脂質（g）",
        "total_carbohydrate": "合計炭水化物（g）"
    }
}

注意：
- 必ず"foods"フィールドを含めてください
- 各食品の量は一般的な1人前の量を想定してください
- 信頼度は分析の確実性を0から1の値で示してください
`;
    }
}