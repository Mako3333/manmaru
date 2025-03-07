import { z } from 'zod';
import { AIModelFactory } from './model-factory';
import { PromptService, PromptType } from './prompts/prompt-service';
import { AIError, ErrorCode } from '@/lib/errors/ai-error';

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

    private constructor() {
        this.promptService = PromptService.getInstance();
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
                ErrorCode.AI_MODEL_ERROR,
                error
            );
        }
    }

    /**
     * テキスト入力による食品解析を行う
     * @param foods 食品リスト
     * @param mealType 食事タイプ（オプション）
     */
    async analyzeTextInput(
        foods: FoodInput[],
        mealType: string = 'その他'
    ): Promise<FoodAnalysisResult> {
        // 食品データをテキスト形式に変換
        const foodsText = foods.map(food =>
            `${food.name}${food.quantity ? ` ${food.quantity}` : ''}`
        ).join('、');

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

            // JSONパース処理
            return this.parseJSONResponse<FoodAnalysisResult>(
                responseText,
                foodAnalysisSchema,
                'foods'
            );
        } catch (error) {
            if (error instanceof AIError) throw error;

            throw new AIError(
                'テキスト入力解析中にエラーが発生しました',
                ErrorCode.AI_MODEL_ERROR,
                error
            );
        }
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
    }): Promise<NutritionAdviceResult> {
        // プロンプト生成
        const prompt = this.promptService.generatePrompt(PromptType.NUTRITION_ADVICE, {
            ...params
        });

        console.log('AIService: 栄養アドバイス生成開始', {
            pregnancyWeek: params.pregnancyWeek,
            trimester: params.trimester,
            deficientNutrientsCount: params.deficientNutrients.length
        }); // デバッグ用ログ

        // モデル呼び出し
        const model = AIModelFactory.createTextModel({
            temperature: 0.7
        });

        try {
            const response = await model.invoke(prompt);
            const responseText = response.toString();

            // テキスト形式の応答をパース
            return this.parseNutritionAdvice(responseText);
        } catch (error) {
            if (error instanceof AIError) throw error;

            throw new AIError(
                '栄養アドバイス生成中にエラーが発生しました',
                ErrorCode.AI_MODEL_ERROR,
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
        // JSONパターンの抽出
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);

        if (!jsonMatch) {
            throw new AIError(
                'JSONレスポンスの形式が不正です',
                ErrorCode.RESPONSE_PARSE_ERROR,
                responseText
            );
        }

        // JSON抽出
        const jsonStr = (jsonMatch[1] || jsonMatch[2]).trim();

        try {
            // JSONパース
            const parsed = JSON.parse(jsonStr);

            // 必須フィールドの確認
            if (requiredField && !parsed[requiredField]) {
                throw new AIError(
                    `必須フィールド "${requiredField}" が見つかりません`,
                    ErrorCode.VALIDATION_ERROR,
                    { response: parsed }
                );
            }

            // スキーマ検証（オプション）
            if (schema) {
                const result = schema.safeParse(parsed);
                if (!result.success) {
                    throw new AIError(
                        'データ検証エラー',
                        ErrorCode.VALIDATION_ERROR,
                        { errors: result.error.issues, data: parsed }
                    );
                }
                return result.data;
            }

            return parsed;
        } catch (error) {
            if (error instanceof AIError) throw error;

            throw new AIError(
                'JSONの解析に失敗しました',
                ErrorCode.RESPONSE_PARSE_ERROR,
                { error, text: jsonStr }
            );
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
} 