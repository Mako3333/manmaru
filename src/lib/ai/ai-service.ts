//src\lib\ai\ai-service.ts
import { z } from 'zod';
import { AIModelFactory } from './model-factory';
import { PromptService, PromptType } from './prompts/prompt-service';
import { AIError, ErrorCode as AIErrorCode } from '@/lib/errors/ai-error';
import { NutritionDatabase, NutritionDatabaseLLMAPI } from '@/lib/nutrition/database';
import { SupabaseFoodDatabase } from '@/lib/nutrition/supabase-db';
import { FoodItem, NutritionData, DatabaseFoodItem } from '@/types/nutrition';
import { FoodAnalysisError, ErrorCode as FoodErrorCode } from '@/lib/errors/food-analysis-error';
import { AIParseResult } from './ai-response-parser';

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
        matchedFoods?: Array<{
            original: string;
            matched: string;
            similarity: number;
        }>;
        possibleMatches?: Array<{
            original: string;
            suggestion: string;
            similarity: number;
        }>;
        [key: string]: any;
    };
}

// AIからのレスポンスを解析するための内部型定義
interface FoodAnalysisInput {
    foods?: Array<{
        name: string;
        quantity?: string;
        confidence?: number;
    }>;
    enhancedFoods?: Array<{
        name: string;
        quantity?: string;
        confidence?: number;
    }>;
    nutrition?: {
        calories: number;
        protein: number;
        iron: number;
        folic_acid: number;
        calcium: number;
        vitamin_d?: number;
        confidence_score: number;
    };
    meta?: {
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
 * AI処理結果
 */
export interface AIProcessResult {
    /** 解析結果 */
    parseResult: AIParseResult;
    /** 生のAI応答 */
    rawResponse: string;
    /** 処理時間（ミリ秒） */
    processingTimeMs: number;
    /** エラーメッセージ */
    error?: string;
}

/**
 * 新しいAIサービスのインターフェース
 * フェーズ5の再設計において使用される新しいインターフェース
 */
export interface AIServiceV2 {
    /**
     * 食事画像から食品を解析
     * @param imageData 画像データ
     * @returns 解析結果
     */
    analyzeMealImage(imageData: any): Promise<AIProcessResult>;

    /**
     * テキスト入力から食品を解析
     * @param text テキスト入力
     * @returns 解析結果
     */
    analyzeMealText(text: string): Promise<AIProcessResult>;

    /**
     * レシピテキストから食品を解析
     * @param recipeText レシピテキスト
     * @returns 解析結果
     */
    analyzeRecipeText(recipeText: string): Promise<AIProcessResult>;
}

/**
 * 統合型AIサービスクラス
 * AIモデル呼び出しからレスポンスのパースまで一元管理
 */
export class AIService {
    private static instance: AIService;
    private promptService: PromptService;
    private nutritionDatabase: NutritionDatabaseLLMAPI;
    private supabaseDatabase: SupabaseFoodDatabase;

    private constructor() {
        console.log('AIService: インスタンス作成');
        try {
            this.promptService = PromptService.getInstance();
            this.nutritionDatabase = NutritionDatabase.getInstance();
            this.supabaseDatabase = SupabaseFoodDatabase.getInstance();
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
            // Supabaseデータベースのキャッシュを更新
            try {
                await this.supabaseDatabase.refreshCache();
                console.log('AIService: Supabaseデータベースのキャッシュ更新完了');
            } catch (error) {
                console.warn('AIService: Supabaseデータベースキャッシュ更新エラー:', error);
            }
        } catch (error) {
            console.error('AIService: データベース初期化確認エラー:', error);
            // エラーが発生しても処理は続行
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
            const parsedData = this.parseAiResponse(responseText);
            if (!parsedData) {
                throw new AIError(
                    'AIレスポンスの解析に失敗しました',
                    AIErrorCode.RESPONSE_PARSE_ERROR,
                );
            }

            // Zodスキーマで検証
            try {
                foodAnalysisSchema.parse(parsedData);
            } catch (validationError) {
                console.error('AIService: データ検証エラー:', validationError);
                // 検証エラーの場合も、最善のデータを返す
            }

            return parsedData as FoodAnalysisResult;
        } catch (error) {
            // エラー詳細の記録
            console.error('画像解析エラー詳細:', JSON.stringify(error, null, 2));

            // すでにAIErrorの場合はそのまま再スロー
            if (error instanceof AIError) throw error;

            // errorオブジェクトからメッセージを安全に抽出
            const errorMessage = error instanceof Error
                ? error.message
                : typeof error === 'string'
                    ? error
                    : 'Unknown error';

            // Gemini API特有のエラータイプに応じた分岐
            if (errorMessage.includes('RESOURCE_EXHAUSTED')) {
                throw new AIError(
                    'APIリクエスト上限に達しました。しばらく経ってからお試しください。',
                    AIErrorCode.RATE_LIMIT,
                    error,
                    ['少し時間をおいて再度お試しください', 'テキスト入力で食品を記録することもできます']
                );
            } else if (errorMessage.includes('INVALID_ARGUMENT')) {
                throw new AIError(
                    '画像の形式が正しくありません。別の画像をお試しください。',
                    AIErrorCode.INVALID_IMAGE,
                    error,
                    ['別の画像を撮影してみてください', '画像のサイズを小さくすると解決する場合があります']
                );
            } else if (errorMessage.includes('DEADLINE_EXCEEDED')) {
                throw new AIError(
                    '応答に時間がかかりすぎています。ネットワーク接続を確認してください。',
                    AIErrorCode.TIMEOUT,
                    error,
                    ['ネットワーク接続を確認してください', 'Wi-Fi環境での利用をお勧めします']
                );
            } else if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('content_blocked')) {
                throw new AIError(
                    'コンテンツポリシーにより画像を処理できません。別の画像をお試しください。',
                    AIErrorCode.CONTENT_FILTER,
                    error,
                    ['食事の写真をより明確に撮影してみてください', 'テキスト入力で食品を記録することもできます']
                );
            } else if (errorMessage.includes('QUOTA_EXCEEDED')) {
                throw new AIError(
                    '月間APIクォータを超過しました。しばらくしてからお試しください。',
                    AIErrorCode.QUOTA_EXCEEDED,
                    error,
                    ['テキスト入力で食品を記録することができます', '明日以降に再度お試しください']
                );
            } else if (errorMessage.includes('MODEL_NOT_FOUND') || errorMessage.includes('NOT_AVAILABLE')) {
                throw new AIError(
                    '現在、AIモデルが利用できません。しばらくしてからお試しください。',
                    AIErrorCode.MODEL_UNAVAILABLE,
                    error,
                    ['テキスト入力で食品を記録することができます', 'しばらく経ってから再度お試しください']
                );
            } else if (errorMessage.includes('UNAVAILABLE')) {
                throw new AIError(
                    'サービスが一時的に利用できません。しばらくしてからお試しください。',
                    AIErrorCode.NETWORK_ERROR,
                    error,
                    ['ネットワーク接続を確認してください', 'しばらく経ってから再度お試しください']
                );
            }

            // その他のエラー
            throw new AIError(
                '画像の解析中にエラーが発生しました。もう一度お試しください。',
                AIErrorCode.AI_MODEL_ERROR,
                error,
                ['別の画像を試してみてください', 'テキスト入力で食品を記録することもできます']
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
                const parsedData = this.parseAiResponse(responseText);
                if (!parsedData) {
                    throw new Error('レスポンスのパースに失敗しました');
                }

                // Zodスキーマで検証（エラーは捕捉するだけ）
                try {
                    foodAnalysisSchema.parse(parsedData);
                } catch (validationError) {
                    console.warn('AIService: データ検証警告:', validationError);
                    // 検証エラーでも処理は続行
                }

                result = parsedData as FoodAnalysisResult;

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

        try {
            // まずSupabaseデータベースを試みる
            const nutritionData = await this.supabaseDatabase.calculateNutrition(foodItems);

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
                    confidence_score: nutritionData.confidence_score || 0.7
                },
                meta: {
                    notFoundFoods: nutritionData.notFoundFoods || [],
                    source: 'supabase_database',
                    searchDetail: (nutritionData.notFoundFoods || []).length > 0
                        ? '一部の食品がデータベースに見つかりませんでした'
                        : 'すべての食品がデータベースで見つかりました',
                    calculationTime: new Date().toISOString()
                }
            };

            // 値の妥当性チェック
            result.nutrition = this.validateNutritionValues(result.nutrition, foodItems.length);

            return result;
        } catch (error) {
            console.warn('AIService: Supabaseでの計算に失敗、ローカルDBにフォールバック:', error);

            // フォールバック: 従来のNutritionDatabaseを使用
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
                    source: 'local_database',
                    searchDetail: (nutritionData.notFoundFoods || []).length > 0
                        ? '一部の食品がデータベースに見つかりませんでした'
                        : 'すべての食品がデータベースで見つかりました',
                    calculationTime: new Date().toISOString()
                }
            };

            // 値の妥当性チェック
            result.nutrition = this.validateNutritionValues(result.nutrition, foodItems.length);

            return result;
        }
    }

    /**
     * 栄養値の妥当性をチェックし、異常値を補正する
     * @private
     */
    private validateNutritionValues(nutrition: FoodAnalysisResult['nutrition'], foodCount: number): FoodAnalysisResult['nutrition'] {
        // 最大許容値（一般的な1食の上限値）
        const MAX_CALORIES_PER_FOOD = 1000; // 1食品あたり最大1000kcal
        const MAX_PROTEIN_PER_FOOD = 100;   // 1食品あたり最大100g
        const MAX_IRON = 50;               // 1食あたり最大50mg
        const MAX_FOLIC_ACID = 1000;       // 1食あたり最大1000μg
        const MAX_CALCIUM = 1500;          // 1食あたり最大1500mg
        const MAX_VITAMIN_D = 50;          // 1食あたり最大50μg

        // 食品数に基づいた上限値の調整
        const adjustedMaxCalories = Math.min(MAX_CALORIES_PER_FOOD * foodCount, 2500);
        const adjustedMaxProtein = Math.min(MAX_PROTEIN_PER_FOOD * foodCount, 150);

        // 異常値のチェックと補正
        const validated = {
            ...nutrition,
            calories: Math.min(nutrition.calories, adjustedMaxCalories),
            protein: Math.min(nutrition.protein, adjustedMaxProtein),
            iron: Math.min(nutrition.iron, MAX_IRON),
            folic_acid: Math.min(nutrition.folic_acid, MAX_FOLIC_ACID),
            calcium: Math.min(nutrition.calcium, MAX_CALCIUM),
            vitamin_d: Math.min(nutrition.vitamin_d || 0, MAX_VITAMIN_D)
        };

        // 値が極端に大きい場合は信頼度スコアを下げる
        if (
            nutrition.calories > adjustedMaxCalories * 0.8 ||
            nutrition.protein > adjustedMaxProtein * 0.8 ||
            nutrition.iron > MAX_IRON * 0.8 ||
            nutrition.folic_acid > MAX_FOLIC_ACID * 0.8 ||
            nutrition.calcium > MAX_CALCIUM * 0.8 ||
            (nutrition.vitamin_d || 0) > MAX_VITAMIN_D * 0.8
        ) {
            validated.confidence_score = Math.min(validated.confidence_score, 0.6);
        }

        return validated;
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

            try {
                // まずSupabaseデータベースで検索
                const fuzzyResults = await this.supabaseDatabase.getFoodsByFuzzyMatch(food.name, 1);

                if (fuzzyResults.length > 0) {
                    const dbFood = fuzzyResults[0].food;
                    const similarity = fuzzyResults[0].similarity;

                    // 類似度が十分高い場合のみ採用
                    if (similarity >= 0.7) {
                        // 食品名を標準化
                        result.foods[i].name = dbFood.name;
                        // データベースの情報を優先して信頼度を更新
                        result.foods[i].confidence = Math.max(food.confidence, 0.8);
                        // メタデータがなければ初期化
                        result.meta = result.meta || {};
                        result.meta.matchedFoods = result.meta.matchedFoods || [];
                        // マッチした食品の情報を記録
                        result.meta.matchedFoods.push({
                            original: food.name,
                            matched: dbFood.name,
                            similarity
                        });
                    } else if (similarity >= 0.5) {
                        // 中程度の類似度の場合は候補として記録
                        result.meta = result.meta || {};
                        result.meta.possibleMatches = result.meta.possibleMatches || [];
                        result.meta.possibleMatches.push({
                            original: food.name,
                            suggestion: dbFood.name,
                            similarity
                        });
                    }
                } else {
                    // Supabaseに見つからない場合は従来のDBを使用
                    // 完全一致検索
                    let dbFood = this.nutritionDatabase.getFoodByExactName(food.name);

                    // 完全一致がない場合は部分一致検索
                    if (!dbFood) {
                        const similarFoods = this.nutritionDatabase.getFoodsByPartialName(food.name, 1);
                        if (similarFoods.length > 0) {
                            dbFood = similarFoods[0];
                            // 類似食品が見つかった場合は情報を更新
                            result.foods[i].name = dbFood.name;
                            food.confidence = Math.min(food.confidence, 0.7); // 信頼度を調整
                        }
                    }

                    // データベースに食品が見つかった場合、信頼度を設定
                    if (dbFood) {
                        result.foods[i].confidence = Math.max(food.confidence, 0.7);
                    }
                }
            } catch (error) {
                console.error(`食品[${food.name}]の検索中にエラー:`, error);
                // エラーが発生しても次の食品の処理を継続
            }
        }

        // 栄養計算の再実行（データベースの情報を使用）
        if (result.foods.length > 0) {
            try {
                // 食品データを標準形式に変換
                const foodItems: FoodItem[] = result.foods.map(food => ({
                    name: food.name,
                    quantity: food.quantity,
                    confidence: food.confidence
                }));

                // Supabaseデータベースを使用して再計算
                const nutritionData = await this.supabaseDatabase.calculateNutrition(foodItems);

                // 結果の更新
                result.nutrition = {
                    calories: nutritionData.calories || 0,
                    protein: nutritionData.protein || 0,
                    iron: nutritionData.iron || 0,
                    folic_acid: nutritionData.folic_acid || 0,
                    calcium: nutritionData.calcium || 0,
                    vitamin_d: nutritionData.vitamin_d || 0,
                    confidence_score: nutritionData.confidence_score || 0.8 // データベース使用なので信頼度は高め
                };

                // 値の妥当性チェック
                result.nutrition = this.validateNutritionValues(result.nutrition, foodItems.length);

                // メタデータ更新
                result.meta = result.meta || {};
                result.meta.source = 'supabase_enhanced';
                result.meta.notFoundFoods = nutritionData.notFoundFoods;

            } catch (error) {
                console.warn('AIService: Supabaseでの再計算に失敗、ローカルDBにフォールバック:', error);

                // フォールバック：ローカルDBを使用
                try {
                    // 食品データを標準形式に変換
                    const foodItems: FoodItem[] = result.foods.map(food => ({
                        name: food.name,
                        quantity: food.quantity,
                        confidence: food.confidence
                    }));

                    // データベースがNutritionDatabaseインスタンスであることを確認
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
                            confidence_score: nutritionData.confidence_score || 0.7
                        };

                        // 値の妥当性チェック
                        result.nutrition = this.validateNutritionValues(result.nutrition, foodItems.length);

                        // メタデータ更新
                        result.meta = result.meta || {};
                        result.meta.source = 'local_enhanced';
                        result.meta.notFoundFoods = nutritionData.notFoundFoods;
                    }
                } catch (fallbackError) {
                    console.error('AIService: ローカルDBでの再計算にも失敗:', fallbackError);
                    // 元の結果をそのまま返す
                }
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
            // エラー詳細のログ記録
            console.error('栄養アドバイス生成エラー詳細:', JSON.stringify(error, null, 2));

            // すでにAIErrorの場合はそのまま再スロー
            if (error instanceof AIError) throw error;

            // errorオブジェクトからメッセージを安全に抽出
            const errorMessage = error instanceof Error
                ? error.message
                : typeof error === 'string'
                    ? error
                    : 'Unknown error';

            // Gemini API特有のエラータイプに応じた分岐
            if (errorMessage.includes('RESOURCE_EXHAUSTED')) {
                throw new AIError(
                    'APIリクエスト上限に達しました。しばらく経ってからアドバイスを取得してください。',
                    AIErrorCode.RATE_LIMIT,
                    error,
                    ['少し時間をおいて再度お試しください', 'しばらくすると再度アドバイスを取得できるようになります']
                );
            } else if (errorMessage.includes('DEADLINE_EXCEEDED')) {
                throw new AIError(
                    '応答に時間がかかりすぎています。ネットワーク接続を確認してください。',
                    AIErrorCode.TIMEOUT,
                    error,
                    ['ネットワーク接続を確認してください', 'Wi-Fi環境での利用をお勧めします']
                );
            } else if (errorMessage.includes('QUOTA_EXCEEDED')) {
                throw new AIError(
                    '月間APIクォータを超過しました。しばらくしてからお試しください。',
                    AIErrorCode.QUOTA_EXCEEDED,
                    error,
                    ['明日以降に再度お試しください', '基本的な栄養情報は引き続き閲覧できます']
                );
            } else if (errorMessage.includes('MODEL_NOT_FOUND') || errorMessage.includes('NOT_AVAILABLE')) {
                throw new AIError(
                    '現在、AIモデルが利用できません。しばらくしてからお試しください。',
                    AIErrorCode.MODEL_UNAVAILABLE,
                    error,
                    ['しばらく経ってから再度お試しください', '基本的な栄養情報は引き続き閲覧できます']
                );
            } else if (errorMessage.includes('UNAVAILABLE')) {
                throw new AIError(
                    'サービスが一時的に利用できません。しばらくしてからお試しください。',
                    AIErrorCode.NETWORK_ERROR,
                    error,
                    ['ネットワーク接続を確認してください', 'しばらく経ってから再度お試しください']
                );
            }

            throw new AIError(
                '栄養アドバイス生成中にエラーが発生しました。後でもう一度お試しください。',
                AIErrorCode.AI_MODEL_ERROR,
                error,
                ['しばらくしてから再度お試しください', '基本的な栄養情報は引き続き閲覧できます']
            );
        }
    }

    /**
     * AIからの応答を解析してフォーマット
     * @private
     */
    private parseAiResponse(responseText: string): FoodAnalysisInput | null {
        try {
            // デバッグログの改善
            console.log(`AIService: 応答解析開始 (${responseText.length}文字)`);

            // JSONコードブロック抽出を改善
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (!jsonMatch) {
                console.warn('AIService: JSONブロックが見つかりません', {
                    responsePreview: responseText.substring(0, 100) + '...'
                });
                // JSON形式全体を探す
                const possibleJson = responseText.match(/(\{[\s\S]*\})/);
                if (!possibleJson) {
                    console.error('AIService: 有効なJSONが見つかりません');
                    return null;
                }

                try {
                    const parsedJson = JSON.parse(possibleJson[1]);
                    console.log('AIService: JSON形式で解析に成功しました', {
                        hasFood: !!parsedJson.foods || !!parsedJson.enhancedFoods,
                        hasNutrition: !!parsedJson.nutrition
                    });
                    return parsedJson;
                } catch (e) {
                    console.error('AIService: 応答のJSON解析に失敗', e);
                    return null;
                }
            }

            // JSON文字列の前処理
            const jsonStr = jsonMatch[1].trim();
            console.log(`AIService: 抽出されたJSON文字列プレビュー: ${jsonStr.substring(0, 50)}...`);

            // JSON解析
            const parsedData = JSON.parse(jsonStr);

            // foods/enhancedFoodsフィールドの取り扱い改善
            if (!parsedData.foods && parsedData.enhancedFoods) {
                parsedData.foods = parsedData.enhancedFoods;
                // わかりやすいログメッセージ
                console.log('AIService: 応答形式を標準化 (enhancedFoods → foods)');
            }

            // nutrition フィールドの標準化
            if (!parsedData.nutrition) {
                console.log('AIService: nutrition フィールドを生成');
                parsedData.nutrition = {
                    calories: 0,
                    protein: 0,
                    iron: 0,
                    folic_acid: 0,
                    calcium: 0,
                    vitamin_d: 0,
                    confidence_score: 0.5
                };
            }

            // 検証成功
            console.log('AIService: 応答解析成功', {
                foodCount: parsedData.foods?.length || 0,
                hasNutrition: !!parsedData.nutrition
            });

            return parsedData;
        } catch (error) {
            console.error('AIService: 応答解析エラー', error);
            return null;
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