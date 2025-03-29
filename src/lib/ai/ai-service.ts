//src\\lib\\ai\\ai-service.ts
import { z } from 'zod';
import { PromptService, PromptType } from './prompts/prompt-service';
import { AIAnalysisError, AppError, ErrorCode, AnyErrorCode } from '@/lib/error';
import { GeminiResponseParser } from './gemini-response-parser';
import { AIModelService } from './core/ai-model-service';
import { FoodAnalysisResult, NutritionAdviceResult, FoodInput, AIParseResult, FoodAnalysisInput } from '@/types/ai';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';
import { NutritionService } from '@/lib/nutrition/nutrition-service';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepository } from '@/lib/food/food-repository';
import { FoodRepositoryFactory } from '@/lib/food/food-repository-factory';

/**
 * 統合型AIサービスクラス
 * AIモデル呼び出しからレスポンスのパースまで一元管理
 */
export class AIService {
    private static instance: AIService;
    private promptService: PromptService;
    private aiModelService: AIModelService;
    private responseParser: GeminiResponseParser;
    private nutritionService: NutritionService;

    private constructor() {
        console.log('AIService: インスタンス作成');
        try {
            this.promptService = PromptService.getInstance();
            this.aiModelService = new AIModelService();
            this.responseParser = new GeminiResponseParser();
            const foodRepository = FoodRepositoryFactory.getRepository();
            this.nutritionService = NutritionServiceFactory.getInstance().createService(foodRepository);
            console.log('AIService: Dependencies initialized successfully.');
        } catch (error) {
            console.error('AIService: Initialization failed:', error);
            if (error instanceof AppError) throw error;
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: 'AIService initialization failed.',
                originalError: error instanceof Error ? error : new Error(String(error))
            });
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
        const prompt = this.promptService.generatePrompt(PromptType.FOOD_ANALYSIS, {
            mealType,
            trimester
        });

        try {
            const responseText = await this.aiModelService.invokeVision(prompt, image, {
                temperature: 0.1
            });

            const parsedData = this.parseFoodAnalysisResponse(responseText);
            if (!parsedData || !parsedData.foods) {
                throw new AppError({
                    code: ErrorCode.AI.PARSING_ERROR,
                    message: 'AIレスポンスの解析に失敗しました (FoodAnalysis structure or foods missing)'
                });
            }

            const adaptedParsedFoods: FoodInputParseResult[] = (parsedData.foods || []).map((food: any) => ({
                foodName: food.name || '',
                quantityText: food.quantity || null,
                confidence: food.confidence || 0.7
            }));

            const finalResult = await this.nutritionService.processParsedFoods(adaptedParsedFoods);

            return finalResult;
        } catch (error) {
            console.error('AIService: analyzeMeal error:', error);
            if (error instanceof AppError) {
                const userMessage = error.userMessage || '画像の解析中にエラーが発生しました。'
                let suggestions = error.suggestions && error.suggestions.length > 0 ? error.suggestions : [
                    '別の画像を試してみてください',
                    'テキスト入力で食品を記録することもできます'
                ];

                switch (error.code) {
                    case ErrorCode.Resource.RATE_LIMIT_EXCEEDED:
                    case ErrorCode.Resource.QUOTA_EXCEEDED:
                        suggestions = ['しばらく経ってから再度お試しください', 'テキスト入力も利用可能です'];
                        break;
                    case ErrorCode.File.INVALID_IMAGE:
                        suggestions = ['別の画像を撮影・選択してください', '画像の形式(JPG/PNG)を確認してください'];
                        break;
                    case ErrorCode.Base.NETWORK_ERROR:
                        suggestions = ['ネットワーク接続を確認し、再度お試しください', 'Wi-Fi環境での利用をお勧めします'];
                        break;
                    case ErrorCode.Nutrition.FOOD_NOT_FOUND:
                        suggestions = ['一部の食品がデータベースに見つかりませんでした。テキスト入力で詳細を追記できます。', '別の画像を試してください。'];
                        break;
                    case ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR:
                        suggestions = ['栄養計算中にエラーが発生しました。後でもう一度お試しください。', 'サポートにお問い合わせください。'];
                        break;
                    case ErrorCode.AI.ANALYSIS_FAILED:
                    case ErrorCode.AI.MODEL_ERROR:
                    case ErrorCode.AI.PARSING_ERROR:
                    default:
                        suggestions = ['画像の内容を確認し、再度お試しください', 'テキスト入力も利用可能です'];
                        break;
                }

                throw new AppError({
                    code: error.code,
                    message: `analyzeMeal context: ${error.message}`,
                    userMessage: userMessage,
                    suggestions: suggestions,
                    details: error.details,
                    severity: error.severity,
                    originalError: error.originalError
                });
            } else {
                const originalError = error instanceof Error ? error : new Error(String(error));
                throw new AIAnalysisError(
                    `analyzeMeal中に予期せぬエラーが発生しました: ${originalError.message}`,
                    'image',
                    undefined,
                    originalError
                );
            }
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

        if (!foods || foods.length === 0) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '食品データが必要です'
            });
        }

        const validFoods = foods.filter(food => food.name && food.name.trim() !== '');

        if (validFoods.length === 0) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '有効な食品データが必要です'
            });
        }

        const foodsText = validFoods.map(food =>
            `${food.name.trim()}${food.quantity ? ` ${food.quantity.trim()}` : ''}`
        ).join('、');

        console.log('AIService: 解析対象食品テキスト:', foodsText);

        const prompt = this.promptService.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, {
            foodsText,
            mealType
        });

        try {
            const responseText = await this.aiModelService.invokeText(prompt, { temperature: 0.2 });
            console.log('AIService: AI response (text):', responseText.substring(0, 100) + '...');

            const parseResult = await this.responseParser.parseResponse(responseText);

            if (parseResult.error) {
                console.error('AIService: AI parse error:', parseResult.error, parseResult.debug);
                throw new AppError({
                    code: ErrorCode.AI.PARSING_ERROR,
                    message: `AIレスポンスの解析に失敗しました: ${parseResult.error}`,
                    details: parseResult.debug
                });
            }

            if (!parseResult.foods || parseResult.foods.length === 0) {
                console.warn('AIService: AI did not return foods from text input. Returning empty result.');
                throw new AppError({
                    code: ErrorCode.AI.ANALYSIS_FAILED,
                    message: "AIは食品を認識できませんでした。",
                    userMessage: "入力内容から食品を認識できませんでした。入力し直してください。",
                    details: { inputFoods: foods, responseText: responseText }
                });
            }

            const finalResult = await this.nutritionService.processParsedFoods(parseResult.foods);

            return finalResult;
        } catch (error) {
            console.error('AIService: analyzeTextInput error:', error);
            if (error instanceof AIAnalysisError) {
                error.message = `analyzeTextInput context: ${error.message}`;
                throw error;
            } else if (error instanceof AppError) {
                const userMessage = error.userMessage || 'テキスト解析中にエラーが発生しました。';
                let suggestions = error.suggestions && error.suggestions.length > 0 ? error.suggestions : [
                    '入力内容を確認して再度お試しください',
                    '食品名をより具体的に記述してください'
                ];

                switch (error.code) {
                    case ErrorCode.Resource.RATE_LIMIT_EXCEEDED:
                    case ErrorCode.Resource.QUOTA_EXCEEDED:
                        suggestions = ['しばらく経ってから再度お試しください'];
                        break;
                    case ErrorCode.Base.NETWORK_ERROR:
                        suggestions = ['ネットワーク接続を確認し、再度お試しください'];
                        break;
                    case ErrorCode.Nutrition.FOOD_NOT_FOUND:
                    case ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR:
                        suggestions = ['一部の食品が見つからないか、計算できませんでした。入力を確認してください。', 'サポートに連絡してください。'];
                        break;
                }

                throw new AppError({
                    code: error.code,
                    message: `analyzeTextInput context: ${error.message}`,
                    userMessage: userMessage,
                    suggestions: suggestions,
                    details: error.details,
                    severity: error.severity,
                    originalError: error.originalError
                });
            } else {
                const originalError = error instanceof Error ? error : new Error(String(error));
                throw new AIAnalysisError(
                    `analyzeTextInput中に予期せぬエラーが発生しました: ${originalError.message}`,
                    'text',
                    undefined,
                    originalError
                );
            }
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
        const prompt = this.promptService.generatePrompt(PromptType.NUTRITION_ADVICE, {
            ...params
        });
        console.log('AIService: Generating nutrition advice...');

        try {
            const responseText = await this.aiModelService.invokeText(prompt, {
                temperature: 0.7
            });

            console.log('AIService: AI response (advice):', responseText.substring(0, 150) + '...');
            return this.parseNutritionAdvice(responseText);
        } catch (error) {
            console.error('AIService: getNutritionAdvice error:', error);
            if (error instanceof AppError) {
                const userMessage = error.userMessage || '栄養アドバイス生成中にエラーが発生しました。';
                let suggestions = error.suggestions && error.suggestions.length > 0 ? error.suggestions : [
                    'しばらくしてから再度お試しください',
                    '基本的な栄養情報は引き続き閲覧できます'
                ];
                if (error.code === ErrorCode.Resource.RATE_LIMIT_EXCEEDED || error.code === ErrorCode.Resource.QUOTA_EXCEEDED) {
                    suggestions = ['少し時間をおいて再度アドバイスを生成してください'];
                }

                throw new AppError({
                    code: error.code,
                    message: `getNutritionAdvice context: ${error.message}`,
                    userMessage: userMessage,
                    suggestions: suggestions,
                    details: error.details,
                    severity: error.severity,
                    originalError: error.originalError
                });
            } else {
                const originalError = error instanceof Error ? error : new Error(String(error));
                throw new AppError({
                    code: ErrorCode.AI.ANALYSIS_FAILED,
                    message: `栄養アドバイス生成中に予期せぬエラーが発生しました: ${originalError.message}`,
                    userMessage: 'アドバイスの生成に失敗しました。時間をおいて再度お試しください。',
                    originalError: originalError
                });
            }
        }
    }

    /**
     * AIからの応答を解析してFoodAnalysisResult形式にする (analyzeMeal用の一時的な内部パーサー)
     * @private
     * @param responseText AIからの生の応答テキスト
     * @returns 解析されたデータ (FoodAnalysisInput形式に近い) または null
     */
    private parseFoodAnalysisResponse(responseText: string): FoodAnalysisInput | null {
        try {
            console.log(`AIService: FoodAnalysis応答解析開始 (${responseText.length}文字)`);

            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            let jsonStr = '';

            if (jsonMatch && jsonMatch[1]) {
                jsonStr = jsonMatch[1].trim();
            } else {
                const possibleJson = responseText.match(/(\{[\s\S]*\})/);
                if (!possibleJson || !possibleJson[1]) {
                    console.error('AIService: 有効なJSONが見つかりません (FoodAnalysis)');
                    return null;
                }
                jsonStr = possibleJson[1].trim();
            }

            console.log(`AIService: 抽出されたJSON文字列プレビュー: ${jsonStr.substring(0, 50)}...`);
            const parsedData = JSON.parse(jsonStr);

            if (!parsedData.foods || !parsedData.nutrition) {
                console.warn('AIService: 応答にfoodsまたはnutritionフィールドがありません (FoodAnalysis)');
                return null;
            }

            if (!parsedData.foods && parsedData.enhancedFoods) {
                parsedData.foods = parsedData.enhancedFoods;
                console.log('AIService: 応答形式を標準化 (enhancedFoods → foods)');
            }

            console.log('AIService: FoodAnalysis応答解析成功');
            return parsedData;
        } catch (error) {
            console.error('AIService: FoodAnalysis応答解析エラー', error);
            return null;
        }
    }

    /**
     * 栄養アドバイステキストのパース
     */
    private parseNutritionAdvice(responseText: string): NutritionAdviceResult {
        console.log('AIService: パース開始', { textLength: responseText.length });

        if (responseText.includes('"advice_summary"') && responseText.includes('"advice_detail"')) {
            try {
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0];
                    const parsedData = JSON.parse(jsonStr);

                    console.log('AIService: JSONレスポンスを検出', {
                        summaryLength: parsedData.advice_summary?.length || 0,
                        detailLength: parsedData.advice_detail?.length || 0
                    });

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
            }
        }

        const paragraphs = responseText.split(/\n\s*\n/);

        let summary = '';
        if (paragraphs.length > 0) {
            const firstParagraph = this.cleanupText(paragraphs[0] || '');
            summary = firstParagraph.length > 150
                ? firstParagraph.substring(0, 147) + '...'
                : firstParagraph;
        } else {
            summary = this.cleanupText(responseText || '');
        }

        const foodSectionIndex = responseText.indexOf('### 推奨食品');

        let detailedAdvice = '';
        if (foodSectionIndex !== -1) {
            detailedAdvice = this.cleanupText(responseText.substring(0, foodSectionIndex));
        } else {
            detailedAdvice = this.cleanupText(responseText);
        }

        if (detailedAdvice.startsWith(summary) && detailedAdvice.length > summary.length) {
            detailedAdvice = this.cleanupText(detailedAdvice.substring(summary.length));
        }

        if (!detailedAdvice && summary) {
            detailedAdvice = summary;
        }

        let recommendedFoods: Array<{ name: string, benefits: string }> = [];
        if (foodSectionIndex !== -1) {
            const foodSectionText = responseText.substring(foodSectionIndex);
            const lines = foodSectionText.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line) continue;

                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*') || trimmedLine.startsWith('•')) {
                    const content = trimmedLine.substring(1).trim();
                    console.log('extractRecommendedFoods: 箇条書き検出', { content });

                    const colonIndex = content.indexOf('：');
                    const colonIndex2 = content.indexOf(':');
                    const separatorIndex = colonIndex !== -1 ? colonIndex : colonIndex2;

                    if (separatorIndex !== -1) {
                        recommendedFoods.push({
                            name: content.substring(0, separatorIndex).trim(),
                            benefits: content.substring(separatorIndex + 1).trim()
                        });
                    } else if (content) {
                        recommendedFoods.push({
                            name: content,
                            benefits: '栄養バランスの向上に役立ちます'
                        });
                    }
                }

                if (i > 1 && line.startsWith('###') && !line.includes('推奨食品')) {
                    break;
                }
            }
        }

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
        });

        return {
            summary,
            detailedAdvice,
            recommendedFoods
        };
    }

    /**
     * テキストのクリーンアップ
     */
    private cleanupText(text: string): string {
        return text
            .replace(/^[#\s]+|[#\s]+$/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}