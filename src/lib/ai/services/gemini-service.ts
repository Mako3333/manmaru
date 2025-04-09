import { GeminiResponseParser, GeminiParseResult } from '../gemini-response-parser';
import { PromptService, PromptType } from '../prompts/prompt-service';
import { AIModelService } from '@/lib/ai/core/ai-model-service';
import { ModelOptions } from '@/lib/ai/core/ai-model-factory';
import { IAIService } from '@/lib/ai/ai-service.interface';
import {
    NutritionAdviceResult,
    MealAnalysisResult,
    RecipeAnalysisResult
} from '@/types/ai';
import { AppError, ErrorCode } from '@/lib/error';

/**
 * Gemini API設定
 */
interface GeminiServiceConfig {
    /** API URL */
    apiUrl: string;
    /** APIキー */
    apiKey: string;
    /** モデル名 */
    model: string;
    /** 最大トークン */
    maxOutputTokens: number;
    /** 温度パラメータ */
    temperature: number;
}

/**
 * セーフティ設定オプション
 */
enum HarmBlockThreshold {
    BLOCK_NONE = 'BLOCK_NONE',
    BLOCK_ONLY_HIGH = 'BLOCK_ONLY_HIGH',
    BLOCK_MEDIUM_AND_ABOVE = 'BLOCK_MEDIUM_AND_ABOVE',
    BLOCK_LOW_AND_ABOVE = 'BLOCK_LOW_AND_ABOVE',
    HARM_BLOCK_THRESHOLD_UNSPECIFIED = 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'
}

/**
 * セーフティ設定カテゴリ
 */
enum HarmCategory {
    HARM_CATEGORY_HATE_SPEECH = 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_DANGEROUS_CONTENT = 'HARM_CATEGORY_DANGEROUS_CONTENT',
    HARM_CATEGORY_SEXUALLY_EXPLICIT = 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_HARASSMENT = 'HARM_CATEGORY_HARASSMENT'
}

/**
 * セーフティ設定
 */
interface SafetySetting {
    category: HarmCategory;
    threshold: HarmBlockThreshold;
}

/**
 * Gemini APIを使用したAIサービス
 */
export class GeminiService implements IAIService {
    private config: GeminiServiceConfig;
    private parser: GeminiResponseParser;
    private safetySettings: SafetySetting[];
    private promptService: PromptService;
    private modelService: AIModelService;

    /**
     * コンストラクタ
     * @param config API設定
     */
    constructor(config: Partial<GeminiServiceConfig> = {}) {
        // デフォルト設定
        this.config = {
            apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            apiKey: process.env.GEMINI_API_KEY || '',
            model: 'gemini-1.5-flash', // デフォルトモデルを更新 (例)
            maxOutputTokens: 4096,     // 必要に応じて調整
            temperature: 0.3,
            ...config
        };

        // セーフティ設定
        this.safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE }
        ];

        this.parser = new GeminiResponseParser();
        this.promptService = PromptService.getInstance();
        this.modelService = new AIModelService();
    }

    /**
     * 食事画像から食品を解析
     */
    async analyzeMealImage(imageData: Buffer): Promise<MealAnalysisResult> {
        try {
            console.log(`[GeminiService] Analyzing meal image (size: ${imageData.length} bytes)...`);
            const base64Image = imageData.toString('base64');
            const prompt = this.promptService.generatePrompt(PromptType.FOOD_ANALYSIS, {
                mealType: '食事',
                trimester: undefined
            });
            const modelOptions: ModelOptions = {
                temperature: this.config.temperature,
                maxOutputTokens: this.config.maxOutputTokens,
            };
            const rawResponse = await this.modelService.invokeVision(prompt, base64Image, modelOptions);
            const parseResult = await this.parser.parseResponse(rawResponse as any);
            console.log(`[GeminiService] Meal image analysis successful.`);

            const result: MealAnalysisResult = {
                foods: parseResult.foods || [],
                confidence: parseResult.confidence,
                estimatedNutrition: parseResult.nutrition,
                debug: { ...parseResult.debug, rawResponse }
            };
            if (parseResult.error) {
                result.error = { message: parseResult.error };
            }
            return result;
        } catch (error: unknown) {
            console.error('[GeminiService] Error analyzing meal image:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCode = error instanceof AppError ? error.code : undefined;
            return {
                foods: [],
                error: { message: `画像解析エラー: ${errorMessage}`, code: errorCode, details: error }
            };
        }
    }

    /**
     * テキスト入力から食品を解析
     */
    async analyzeMealText(text: string): Promise<MealAnalysisResult> {
        try {
            console.log(`[GeminiService] Analyzing meal text (length: ${text.length})...`);
            const prompt = this.promptService.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, {
                foodsText: text
            });
            const modelOptions: ModelOptions = {
                temperature: this.config.temperature,
                maxOutputTokens: this.config.maxOutputTokens,
            };
            const rawResponse = await this.modelService.invokeText(prompt, modelOptions);
            const parseResult = await this.parser.parseResponse(rawResponse as any);
            console.log(`[GeminiService] Meal text analysis successful.`);

            const result: MealAnalysisResult = {
                foods: parseResult.foods || [],
                confidence: parseResult.confidence,
                estimatedNutrition: parseResult.nutrition,
                debug: { ...parseResult.debug, rawResponse }
            };
            if (parseResult.error) {
                result.error = { message: parseResult.error };
            }
            return result;
        } catch (error: unknown) {
            console.error('[GeminiService] Error analyzing meal text:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCode = error instanceof AppError ? error.code : undefined;
            return {
                foods: [],
                error: { message: `テキスト解析エラー: ${errorMessage}`, code: errorCode, details: error }
            };
        }
    }

    /**
     * レシピテキストから食品を解析
     */
    async analyzeRecipeText(recipeText: string): Promise<RecipeAnalysisResult> {
        console.warn('[GeminiService] analyzeRecipeText is deprecated.');
        try {
            console.log(`[GeminiService] Analyzing recipe text (length: ${recipeText.length})...`);
            const prompt = this.promptService.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, {
                foodsText: recipeText
            });
            const modelOptions: ModelOptions = {
                temperature: this.config.temperature,
                maxOutputTokens: this.config.maxOutputTokens,
            };
            const rawResponse = await this.modelService.invokeText(prompt, modelOptions);
            const parseResult = await this.parser.parseResponse(rawResponse as any);
            console.log(`[GeminiService] Recipe text analysis successful.`);

            const result: RecipeAnalysisResult = {
                title: parseResult.title,
                servings: parseResult.servings,
                ingredients: parseResult.foods || [],
                debug: { ...parseResult.debug, rawResponse }
            };
            if (parseResult.error) {
                result.error = { message: parseResult.error };
            }
            return result;
        } catch (error: unknown) {
            console.error('[GeminiService] Error analyzing recipe text:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCode = error instanceof AppError ? error.code : undefined;
            return {
                ingredients: [],
                error: { message: `レシピテキスト解析エラー: ${errorMessage}`, code: errorCode, details: error }
            };
        }
    }

    /**
     * URLからレシピを解析
     */
    async parseRecipeFromUrl(url: string, htmlContent?: string): Promise<RecipeAnalysisResult> {
        try {
            console.log(`[GeminiService] Parsing recipe from URL: ${url}`);

            let fetchedHtml = '';
            if (!htmlContent) {
                console.log(`[GeminiService] Fetching HTML from: ${url}`);
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    },
                    signal: AbortSignal.timeout(15000)
                });
                if (!response.ok) throw new Error(`Failed to fetch URL ${url}: ${response.status}`);
                fetchedHtml = await response.text();
                console.log(`[GeminiService] Fetched HTML content (length: ${fetchedHtml.length}) from: ${url}`);
            } else {
                fetchedHtml = htmlContent;
                console.log(`[GeminiService] Using provided HTML content (length: ${fetchedHtml.length})`);
            }

            let textContent = fetchedHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
                .replace(/\s\s+/g, ' ').trim();
            const MAX_CONTENT_LENGTH = 100000;
            if (textContent.length > MAX_CONTENT_LENGTH) {
                textContent = textContent.substring(0, MAX_CONTENT_LENGTH);
            }

            const prompt = this.promptService.generatePrompt(PromptType.RECIPE_URL_ANALYSIS, {
                recipeContent: textContent
            });
            const modelOptions: ModelOptions = {
                temperature: 0.2,
                maxOutputTokens: this.config.maxOutputTokens,
            };
            const rawResponse = await this.modelService.invokeText(prompt, modelOptions);
            const parseResult = await this.parser.parseResponse(rawResponse as any);
            console.log(`[GeminiService] URL parsing successful for: ${url}`);

            const result: RecipeAnalysisResult = {
                title: parseResult.title,
                servings: parseResult.servings,
                ingredients: parseResult.foods || [],
                debug: { ...parseResult.debug, rawResponse }
            };
            if (parseResult.error) {
                result.error = { message: parseResult.error };
            }
            return result;
        } catch (error: unknown) {
            console.error(`[GeminiService] Error parsing recipe from URL: ${url}`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCode = error instanceof AppError ? error.code : undefined;
            return {
                ingredients: [],
                error: { message: `URL解析エラー: ${errorMessage}`, code: errorCode, details: error }
            };
        }
    }

    /**
     * 栄養アドバイスを取得
     */
    async getNutritionAdvice(params: Record<string, unknown>, promptType: PromptType): Promise<NutritionAdviceResult> {
        try {
            console.log(`[GeminiService] Getting nutrition advice (type: ${promptType})...`);

            // params の値を検証または変換する必要があるかもしれない
            // 例: params の値がプリミティブ型であることを確認するなど
            const validatedParams: Record<string, string | number | boolean | undefined> = {};
            for (const [key, value] of Object.entries(params)) {
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === undefined) {
                    validatedParams[key] = value;
                } else {
                    console.warn(`[GeminiService] Skipping invalid param type for key "${key}":`, value);
                    // 不正な型の値は除外するか、エラーにするかは要件次第
                }
            }

            const prompt = this.promptService.generatePrompt(promptType, validatedParams);
            const modelOptions: ModelOptions = {
                temperature: 0.5, // アドバイス生成には少し高めの温度設定を試す
                maxOutputTokens: this.config.maxOutputTokens,
            };
            const rawResponse = await this.modelService.invokeText(prompt, modelOptions);
            const parseResult = await this.parser.parseResponse(rawResponse as any);
            console.log(`[GeminiService] Nutrition advice generation successful for type: ${promptType}. Parse result keys:`, Object.keys(parseResult));

            // recommendedFoods の型マッピング
            const recommendedFoodsData = parseResult.recommended_foods
                ? parseResult.recommended_foods.map((food: Record<string, unknown>) => ({
                    name: (food.name as string) || '不明な食品',
                    benefits: ''
                }))
                : [];

            const result: NutritionAdviceResult = {
                summary: parseResult.advice_summary || '',
                detailedAdvice: parseResult.advice_detail,
                recommendedFoods: recommendedFoodsData,
                debug: { ...parseResult.debug, rawResponse }
            };
            if (parseResult.error) {
                result.error = { message: parseResult.error };
            }
            return result;
        } catch (error: unknown) {
            console.error('[GeminiService] Error getting nutrition advice:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCode = error instanceof AppError ? error.code : ErrorCode.AI.ANALYSIS_FAILED;
            return {
                summary: 'アドバイスの取得中にエラーが発生しました。',
                error: { message: `アドバイス取得エラー: ${errorMessage}`, code: errorCode, details: error }
            };
        }
    }

    // Placeholder for generateResponse method to satisfy the interface
    async generateResponse(
        type: PromptType,
        context: Record<string, unknown>,
        options?: Record<string, unknown>,
    ): Promise<string> {
        console.log(`[GeminiService] Generating response for type: ${type}`);
        const prompt = this.promptService.generatePrompt(type, context);

        // stopSequences を安全に抽出
        const stopSequences = (options && Array.isArray(options.stopSequences) && options.stopSequences.length > 0)
            ? options.stopSequences as string[]
            : undefined;

        const modelOptions: ModelOptions = {
            temperature: options?.temperature as number ?? this.config.temperature,
            maxOutputTokens: options?.maxOutputTokens as number ?? this.config.maxOutputTokens,
            ...(stopSequences && { stopSequences }) // 安全に抽出した変数を使用
        };

        try {
            const rawResponse: string = await this.modelService.invokeText(prompt, modelOptions);
            console.log(`[GeminiService] Response generation successful for type: ${type}`);
            return rawResponse;
        } catch (error: unknown) {
            console.error(`[GeminiService] Error generating response for type ${type}:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCode = error instanceof AppError ? error.code : undefined;
            // エラーハンドリング: インターフェースは string を期待しているため、エラーメッセージを返すか、
            // 例外を再スローするかを決定する必要がある。
            // ここではエラーメッセージを含む文字列を返す。
            return JSON.stringify({ error: true, message: errorMessage, code: errorCode });
        }
    }
}
