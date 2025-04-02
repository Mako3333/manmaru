//src\lib\ai\gemini-service.ts
import { GeminiResponseParser, GeminiParseResult } from './gemini-response-parser';
import { PromptService, PromptType } from './prompts/prompt-service';
import { AIModelService } from '@/lib/ai/core/ai-model-service';
import { ModelOptions } from '@/lib/ai/core/ai-model-factory';

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
 * GeminiServiceの処理結果を表す型
 */
export interface GeminiProcessResult {
    parseResult: GeminiParseResult;
    rawResponse: string;
    processingTimeMs: number;
    error?: string;
}

/**
 * Gemini APIを使用したAIサービス
 */
export class GeminiService {
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
            model: 'gemini-2.0-flash-001',
            maxOutputTokens: 2048,
            temperature: 0.3,
            ...config
        };

        // セーフティ設定
        this.safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
            },
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
            }
        ];

        this.parser = new GeminiResponseParser();
        this.promptService = PromptService.getInstance();
        this.modelService = new AIModelService();
    }

    /**
     * 食事画像から食品を解析
     */
    async analyzeMealImage(imageData: Buffer): Promise<GeminiProcessResult> {
        try {
            const startTime = Date.now();

            // 画像のBase64エンコーディング
            const base64Image = imageData.toString('base64');

            // プロンプト生成
            const prompt = this.promptService.generatePrompt(PromptType.FOOD_ANALYSIS, {
                mealType: '食事',
                trimester: undefined
            });

            // モデルオプションの設定（温度など）
            const modelOptions: ModelOptions = {
                temperature: this.config.temperature,
                maxOutputTokens: this.config.maxOutputTokens,
            };

            // AIモデル呼び出し (invokeVisionを使用)
            const rawResponse = await this.modelService.invokeVision(prompt, base64Image, modelOptions);

            // レスポンスの解析
            const parseResult = await this.parser.parseResponse(rawResponse);

            // 処理時間の計算
            const processingTimeMs = Date.now() - startTime;

            // 結果を GeminiProcessResult 型で返す
            return {
                parseResult,
                rawResponse,
                processingTimeMs
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GeminiService: 画像解析エラー', error);
            // GeminiProcessResult 型でエラー情報を返す
            return {
                parseResult: {
                    foods: [],
                    confidence: 0,
                    error: errorMessage
                },
                rawResponse: '',
                processingTimeMs: 0,
                error: errorMessage
            };
        }
    }

    /**
     * テキスト入力から食品を解析
     */
    async analyzeMealText(text: string): Promise<GeminiProcessResult> {
        try {
            const startTime = Date.now();

            // プロンプト生成
            const prompt = this.promptService.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, {
                foodsText: text
            });

            // モデルオプションの設定
            const modelOptions: ModelOptions = {
                temperature: this.config.temperature,
                maxOutputTokens: this.config.maxOutputTokens,
            };

            // AIモデル呼び出し (invokeTextを使用)
            const rawResponse = await this.modelService.invokeText(prompt, modelOptions);

            // レスポンスの解析
            const parseResult = await this.parser.parseResponse(rawResponse);

            // 処理時間の計算
            const processingTimeMs = Date.now() - startTime;

            // 結果を GeminiProcessResult 型で返す
            return {
                parseResult,
                rawResponse,
                processingTimeMs
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GeminiService: テキスト解析エラー', error);
            // GeminiProcessResult 型でエラー情報を返す
            return {
                parseResult: {
                    foods: [],
                    confidence: 0,
                    error: errorMessage
                },
                rawResponse: '',
                processingTimeMs: 0,
                error: errorMessage
            };
        }
    }

    /**
     * レシピテキストから食品を解析
     */
    async analyzeRecipeText(recipeText: string): Promise<GeminiProcessResult> {
        try {
            const startTime = Date.now();

            // プロンプト生成 (レシピ用だが、現状 TEXT_INPUT_ANALYSIS を流用)
            const prompt = this.promptService.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, {
                foodsText: recipeText
            });

            // モデルオプションの設定
            const modelOptions: ModelOptions = {
                temperature: this.config.temperature,
                maxOutputTokens: this.config.maxOutputTokens,
            };

            // AIモデル呼び出し (invokeTextを使用)
            const rawResponse = await this.modelService.invokeText(prompt, modelOptions);

            // レスポンスの解析
            const parseResult = await this.parser.parseResponse(rawResponse);

            // 処理時間の計算
            const processingTimeMs = Date.now() - startTime;

            // 結果を GeminiProcessResult 型で返す
            return {
                parseResult,
                rawResponse,
                processingTimeMs
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GeminiService: レシピ解析エラー', error);
            // GeminiProcessResult 型でエラー情報を返す
            return {
                parseResult: {
                    foods: [],
                    confidence: 0,
                    error: errorMessage
                },
                rawResponse: '',
                processingTimeMs: 0,
                error: errorMessage
            };
        }
    }
} 