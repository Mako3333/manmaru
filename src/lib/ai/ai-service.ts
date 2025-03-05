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
        isSummary: boolean;
        formattedDate: string;
        currentSeason: string;
    }): Promise<NutritionAdviceResult> {
        // プロンプト生成
        const prompt = this.promptService.generatePrompt(PromptType.NUTRITION_ADVICE, {
            ...params,
            adviceType: params.isSummary ? '簡潔な' : '詳細な',
            adviceInstructions: params.isSummary
                ? '簡潔な要約アドバイスを1段落で提供してください。'
                : '詳細なアドバイスを提供し、最後に「### 推奨食品」セクションを追加して、不足している栄養素を補うのに適した食品を3〜5つリストアップしてください。各食品について、その利点も簡単に説明してください。'
        });

        // モデル呼び出し
        const model = AIModelFactory.createTextModel({
            temperature: 0.7
        });

        try {
            const response = await model.invoke(prompt);
            const responseText = response.toString();

            // テキスト形式の応答をパース
            return this.parseNutritionAdvice(responseText, params.isSummary);
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
    private parseNutritionAdvice(responseText: string, isSummary: boolean): NutritionAdviceResult {
        if (isSummary) {
            // 要約モードの場合は単純にテキスト全体を要約として扱う
            return {
                summary: this.cleanupText(responseText)
            };
        }

        // 詳細モードの場合は推奨食品リストを抽出
        const recommendedFoods = this.extractRecommendedFoods(responseText);

        // 最初の段落を要約として抽出
        const paragraphs = responseText.split(/\n\s*\n/);
        const summary = paragraphs.length > 0
            ? this.cleanupText(paragraphs[0])
            : this.cleanupText(responseText);

        // 詳細アドバイスを抽出（推奨食品リストの前まで）
        let detailedAdvice = '';
        const foodListIndex = responseText.indexOf('### 推奨食品');
        if (foodListIndex !== -1 && paragraphs.length > 1) {
            detailedAdvice = this.cleanupText(
                responseText.substring(paragraphs[0].length, foodListIndex)
            );
        } else if (paragraphs.length > 1) {
            // 食品リストが見つからない場合
            detailedAdvice = this.cleanupText(
                responseText.substring(paragraphs[0].length)
            );
        }

        return {
            summary,
            detailedAdvice: detailedAdvice || undefined,
            recommendedFoods: recommendedFoods.length > 0 ? recommendedFoods : undefined
        };
    }

    /**
     * 推奨食品リストを抽出
     */
    private extractRecommendedFoods(text: string): Array<{ name: string, benefits: string }> {
        const foods: Array<{ name: string, benefits: string }> = [];

        // 推奨食品セクションを探す
        const foodSection = text.match(/###\s*推奨食品[^#]*|推奨食品[：:][^#]*/i);
        if (!foodSection) return foods;

        // 箇条書きアイテムを抽出
        const listItems = foodSection[0].match(/[-•*]\s*([^:：\n]+)[：:]\s*([^\n]+)/g);
        if (!listItems) return foods;

        // 各アイテムをパース
        listItems.forEach(item => {
            const parts = item.match(/[-•*]\s*([^:：\n]+)[：:]\s*([^\n]+)/);
            if (parts && parts.length >= 3) {
                foods.push({
                    name: parts[1].trim(),
                    benefits: parts[2].trim()
                });
            }
        });

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