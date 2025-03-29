//src\lib\ai\gemini-service.ts
import { AIServiceV2, AIProcessResult } from './ai-service';
import { GeminiResponseParser } from './gemini-response-parser';
import { PromptService, PromptType } from './prompts/prompt-service';

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
export class GeminiService implements AIServiceV2 {
    private config: GeminiServiceConfig;
    private parser: GeminiResponseParser;
    private safetySettings: SafetySetting[];
    private promptService: PromptService;

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
    }

    /**
     * 食事画像から食品を解析
     */
    async analyzeMealImage(imageData: any): Promise<AIProcessResult> {
        try {
            const startTime = Date.now();

            // 画像のBase64エンコーディング
            const base64Image = imageData.toString('base64');

            // プロンプト生成（PromptServiceを使用）
            const prompt = this.promptService.generatePrompt(PromptType.FOOD_ANALYSIS, {
                mealType: '食事',
                trimester: undefined
            });

            // API呼び出しURL
            const apiUrl = `${this.config.apiUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

            // API呼び出し
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: 'image/jpeg',
                                        data: base64Image
                                    }
                                }
                            ]
                        }
                    ],
                    safety_settings: this.safetySettings,
                    generation_config: {
                        temperature: this.config.temperature,
                        max_output_tokens: this.config.maxOutputTokens
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API エラー: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // レスポンスの解析
            const parseResult = await this.parser.parseResponse(rawResponse);

            // 処理時間の計算
            const processingTimeMs = Date.now() - startTime;

            return {
                parseResult,
                rawResponse,
                processingTimeMs
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GeminiService: 画像解析エラー', error);
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
    async analyzeMealText(text: string): Promise<AIProcessResult> {
        try {
            const startTime = Date.now();

            // プロンプト生成（PromptServiceを使用）
            const prompt = this.promptService.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, {
                foodsText: text
            });

            // API呼び出しURL
            const apiUrl = `${this.config.apiUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

            // API呼び出し
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt }
                            ]
                        }
                    ],
                    safety_settings: this.safetySettings,
                    generation_config: {
                        temperature: this.config.temperature,
                        max_output_tokens: this.config.maxOutputTokens
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API エラー: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // レスポンスの解析
            const parseResult = await this.parser.parseResponse(rawResponse);

            // 処理時間の計算
            const processingTimeMs = Date.now() - startTime;

            return {
                parseResult,
                rawResponse,
                processingTimeMs
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GeminiService: テキスト解析エラー', error);
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
    async analyzeRecipeText(recipeText: string): Promise<AIProcessResult> {
        try {
            const startTime = Date.now();

            // プロンプト生成（PromptServiceを使用）
            const prompt = this.promptService.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, {
                foodsText: recipeText
            });

            // API呼び出しURL
            const apiUrl = `${this.config.apiUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

            // API呼び出し
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt }
                            ]
                        }
                    ],
                    safety_settings: this.safetySettings,
                    generation_config: {
                        temperature: this.config.temperature,
                        max_output_tokens: this.config.maxOutputTokens
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API エラー: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // レスポンスの解析
            const parseResult = await this.parser.parseResponse(rawResponse);

            // 処理時間の計算
            const processingTimeMs = Date.now() - startTime;

            return {
                parseResult,
                rawResponse,
                processingTimeMs
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GeminiService: レシピ解析エラー', error);
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