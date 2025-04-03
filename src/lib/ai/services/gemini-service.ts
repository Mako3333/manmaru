import { GeminiResponseParser, GeminiParseResult } from '../gemini-response-parser';
import { PromptService, PromptType } from '../prompts/prompt-service';
import { AIModelService } from '@/lib/ai/core/ai-model-service';
import { ModelOptions } from '@/lib/ai/core/ai-model-factory';
import { IAIService } from '@/lib/ai/ai-service.interface';
import { NutritionAdviceResult } from '@/types/ai';

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
    async analyzeMealImage(imageData: Buffer): Promise<GeminiProcessResult> {
        const startTime = Date.now();
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
            const parseResult = await this.parser.parseResponse(rawResponse);
            const processingTimeMs = Date.now() - startTime;
            console.log(`[GeminiService] Meal image analysis successful (took ${processingTimeMs}ms)`);
            return { parseResult, rawResponse, processingTimeMs };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[GeminiService] Error analyzing meal image:', error);
            const processingTimeMs = Date.now() - startTime;
            return {
                parseResult: { foods: [], confidence: 0, error: `画像解析エラー: ${errorMessage}` },
                rawResponse: '',
                processingTimeMs,
                error: errorMessage
            };
        }
    }

    /**
     * テキスト入力から食品を解析
     */
    async analyzeMealText(text: string): Promise<GeminiProcessResult> {
        const startTime = Date.now();
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
            const parseResult = await this.parser.parseResponse(rawResponse);
            const processingTimeMs = Date.now() - startTime;
            console.log(`[GeminiService] Meal text analysis successful (took ${processingTimeMs}ms)`);
            return { parseResult, rawResponse, processingTimeMs };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[GeminiService] Error analyzing meal text:', error);
            const processingTimeMs = Date.now() - startTime;
            return {
                parseResult: { foods: [], confidence: 0, error: `テキスト解析エラー: ${errorMessage}` },
                rawResponse: '',
                processingTimeMs,
                error: errorMessage
            };
        }
    }

    /**
     * レシピテキストから食品を解析
     * ※現状、analyzeMealText とほぼ同じロジック
     */
    async analyzeRecipeText(recipeText: string): Promise<GeminiProcessResult> {
        const startTime = Date.now();
        try {
            console.log(`[GeminiService] Analyzing recipe text (length: ${recipeText.length})...`);
            // TODO: レシピテキスト解析専用プロンプトを作成・使用
            const prompt = this.promptService.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, {
                foodsText: recipeText // レシピテキスト解析用の指示を追加したプロンプトにすべき
            });
            const modelOptions: ModelOptions = {
                temperature: this.config.temperature,
                maxOutputTokens: this.config.maxOutputTokens,
            };
            const rawResponse = await this.modelService.invokeText(prompt, modelOptions);
            const parseResult = await this.parser.parseResponse(rawResponse);
            // レシピ特有のパース処理が必要な場合、ここに追加
            const processingTimeMs = Date.now() - startTime;
            console.log(`[GeminiService] Recipe text analysis successful (took ${processingTimeMs}ms)`);
            return { parseResult, rawResponse, processingTimeMs };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[GeminiService] Error analyzing recipe text:', error);
            const processingTimeMs = Date.now() - startTime;
            return {
                parseResult: { foods: [], confidence: 0, error: `レシピテキスト解析エラー: ${errorMessage}` },
                rawResponse: '',
                processingTimeMs,
                error: errorMessage
            };
        }
    }

    /**
     * URLからレシピを解析
     * @param url レシピページのURL
     */
    async parseRecipeFromUrl(url: string): Promise<GeminiProcessResult> {
        const startTime = Date.now();
        try {
            console.log(`[GeminiService] Parsing recipe from URL: ${url}`);

            // 1. URLからHTMLコンテンツを取得
            console.log(`[GeminiService] Fetching HTML from: ${url}`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                },
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch URL ${url}: ${response.status} ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            if (contentType && !contentType.includes('text/html')) {
                console.warn(`[GeminiService] Content-Type for ${url} is not text/html: ${contentType}`);
            }
            const htmlContent = await response.text();
            console.log(`[GeminiService] Fetched HTML content (length: ${htmlContent.length}) from: ${url}`);

            // 2. HTMLコンテンツをテキストとしてAIに渡す (簡易版)
            let textContent = htmlContent;
            // 簡単な前処理例: scriptとstyleタグを除去 (sフラグ代替)
            textContent = textContent.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
            textContent = textContent.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
            textContent = textContent.replace(/\s\s+/g, ' ').trim();

            const MAX_CONTENT_LENGTH = 100000;
            if (textContent.length > MAX_CONTENT_LENGTH) {
                console.warn(`[GeminiService] Content from ${url} is too long (${textContent.length} chars), truncating to ${MAX_CONTENT_LENGTH}`);
                textContent = textContent.substring(0, MAX_CONTENT_LENGTH);
            }
            console.log(`[GeminiService] Preprocessed text content length: ${textContent.length}`);

            // 3. プロンプト生成
            console.log(`[GeminiService] Generating prompt for URL content using RECIPE_URL_ANALYSIS...`);
            // 新しいプロンプトタイプを使用し、変数名を合わせる
            const prompt = this.promptService.generatePrompt(PromptType.RECIPE_URL_ANALYSIS, {
                recipeContent: textContent // プロンプトテンプレートの変数名に合わせる
            });
            console.log(`[GeminiService] Prompt generated (length: ${prompt.length})`);

            // 4. モデルオプションの設定
            const modelOptions: ModelOptions = {
                temperature: 0.2,
                maxOutputTokens: this.config.maxOutputTokens,
            };
            console.log(`[GeminiService] Invoking text model with options:`, modelOptions);

            // 5. AIモデル呼び出し
            const rawResponse = await this.modelService.invokeText(prompt, modelOptions);
            console.log(`[GeminiService] Received raw response from model (length: ${rawResponse.length}).`);

            // 6. レスポンスの解析
            console.log(`[GeminiService] Parsing response...`);
            // TODO: GeminiResponseParserもレシピ情報(title, servings)を抽出できるように拡張が必要
            const parseResult = await this.parser.parseResponse(rawResponse);
            console.log(`[GeminiService] Parsed response:`, parseResult);
            // 一時的なダミーデータ設定は削除 (Parser拡張時に対応)
            // if (!parseResult.title) parseResult.title = "タイトル不明(解析要改善)";
            // if (!parseResult.servings) parseResult.servings = "不明(解析要改善)";

            // 7. 処理時間の計算
            const processingTimeMs = Date.now() - startTime;
            console.log(`[GeminiService] URL parsing successful for: ${url} (took ${processingTimeMs}ms)`);

            // 8. 結果を返す
            return {
                parseResult,
                rawResponse,
                processingTimeMs
            };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[GeminiService] Error parsing URL ${url}:`, error);
            const processingTimeMs = Date.now() - startTime;
            return {
                parseResult: {
                    foods: [],
                    confidence: 0,
                    error: `URLからのレシピ解析に失敗しました: ${errorMessage}`
                },
                rawResponse: '',
                processingTimeMs: processingTimeMs,
                error: errorMessage
            };
        }
    }

    async getNutritionAdvice(params: any): Promise<NutritionAdviceResult> {
        console.warn('[GeminiService] getNutritionAdvice is not implemented yet.');
        // TODO: 栄養アドバイス生成ロジックを実装する
        // 現状はダミーデータを返すか、エラーをスローする
        return {
            summary: "栄養アドバイスは現在準備中です。",
            // detailedAdvice と recommendedFoods はオプショナルなのでなくてもOK
            // recommendedFoods: [],
        };
        // または:
        // throw new Error('getNutritionAdvice is not implemented in GeminiService');
    }

} // <<< GeminiService クラスの閉じ括弧 