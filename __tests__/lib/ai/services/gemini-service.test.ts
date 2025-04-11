import { GeminiService } from '@/lib/ai/services/gemini-service';
import { AIModelService } from '@/lib/ai/core/ai-model-service';
import { PromptService, PromptType } from '@/lib/ai/prompts/prompt-service';
import { GeminiResponseParser, GeminiParseResult } from '@/lib/ai/gemini-response-parser';
import { NutritionAdviceResult } from '@/types/ai';
import { AppError, ErrorCode } from '@/lib/error';

// 依存関係をモック
jest.mock('@/lib/ai/core/ai-model-service');
jest.mock('@/lib/ai/prompts/prompt-service');
jest.mock('@/lib/ai/gemini-response-parser');

describe('GeminiService', () => {
    let geminiService: GeminiService;
    let mockModelService: jest.Mocked<AIModelService>;
    let mockPromptService: jest.Mocked<PromptService>;
    let mockResponseParser: jest.Mocked<GeminiResponseParser>;

    beforeEach(() => {
        jest.clearAllMocks();

        // モックインスタンスの取得/作成 (jest.mockによりコンストラクタやメソッドがモック化されている)
        mockModelService = new AIModelService() as jest.Mocked<AIModelService>; // コンストラクタはモックされる
        // PromptService は getInstance をモックする必要がある
        mockPromptService = { generatePrompt: jest.fn() } as unknown as jest.Mocked<PromptService>; // getInstanceは静的なので別途モック
        PromptService.getInstance = jest.fn().mockReturnValue(mockPromptService);
        mockResponseParser = new GeminiResponseParser() as jest.Mocked<GeminiResponseParser>; // コンストラクタはモックされる

        // GeminiService のインスタンスを作成
        // コンストラクタ内で new する依存関係がモックされていることを確認
        geminiService = new GeminiService();

        // コンストラクタ内で new されるインスタンスを差し替えたい場合 (上記で jest.mock していれば不要な場合も)
        (geminiService as unknown as { modelService: AIModelService }).modelService = mockModelService;
        (geminiService as unknown as { promptService: PromptService }).promptService = mockPromptService;
        (geminiService as unknown as { parser: GeminiResponseParser }).parser = mockResponseParser;

    });

    describe('analyzeMealImage', () => {
        const imageData = Buffer.from('test-image-data');
        const promptText = 'Analyze this meal image.';
        const rawApiResponse = '{\"foods\": [{\"foodName\": \"りんご\", \"quantityText\": \"1個\"}], \"confidence\": 0.9}';
        const parsedResult: GeminiParseResult = {
            foods: [{ foodName: 'りんご', quantityText: '1個', confidence: 0.9 }],
            confidence: 0.9,
            nutrition: undefined,
            error: '',
        };

        test('正常に画像解析が行われ、MealAnalysisResultが返される', async () => {
            // Arrange
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeVision.mockResolvedValue(rawApiResponse);
            mockResponseParser.parseResponse.mockResolvedValue(parsedResult);

            // Act
            const result = await geminiService.analyzeMealImage(imageData);

            // Assert
            expect(mockPromptService.generatePrompt).toHaveBeenCalledWith(PromptType.FOOD_ANALYSIS, expect.any(Object));
            expect(mockModelService.invokeVision).toHaveBeenCalledWith(promptText, imageData.toString('base64'), expect.any(Object));
            expect(mockResponseParser.parseResponse).toHaveBeenCalledWith(rawApiResponse);

            expect(result).toBeDefined();
            expect(result.foods).toEqual(parsedResult.foods);
            expect(result.confidence).toBe(parsedResult.confidence);
            expect(result.error).toBeUndefined();
            expect(result.estimatedNutrition).toBeUndefined();
        });

        test('AIモデルの呼び出しでエラーが発生した場合、エラー情報を含む結果を返す', async () => {
            // Arrange
            const errorMessage = 'API Error';
            const apiError = new Error(errorMessage);
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeVision.mockRejectedValue(apiError);

            // Act
            const result = await geminiService.analyzeMealImage(imageData);

            // Assert
            expect(result.foods).toEqual([]);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('画像解析エラー');
            expect(result.error?.message).toContain(errorMessage);
            expect(result.error?.details).toBe(apiError);
            expect(mockResponseParser.parseResponse).not.toHaveBeenCalled(); // パース処理は呼ばれない
        });

        test('AppErrorがスローされた場合、エラーコードも含まれる', async () => {
            // Arrange
            const errorMessage = 'Rate Limit Exceeded';
            const errorCode = ErrorCode.AI.API_REQUEST_ERROR;
            const appError = new AppError({ code: errorCode, message: errorMessage });
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeVision.mockRejectedValue(appError);

            // Act
            const result = await geminiService.analyzeMealImage(imageData);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain(errorMessage);
            expect(result.error?.code).toBe(errorCode);
            expect(result.error?.details).toBe(appError);
        });

        test('レスポンスのパースでエラーが発生した場合 (parseResult.error)', async () => {
            // Arrange
            const parseErrorMessage = 'Invalid JSON format';
            const errorParsedResult: GeminiParseResult = {
                foods: [{ foodName: 'りんご', quantityText: '1個', confidence: 0.9 }],
                confidence: 0.9,
                nutrition: undefined,
                error: parseErrorMessage,
            };
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeVision.mockResolvedValue(rawApiResponse);
            mockResponseParser.parseResponse.mockResolvedValue(errorParsedResult);

            // Act
            const result = await geminiService.analyzeMealImage(imageData);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.message).toBe(parseErrorMessage);
        });

        test('レスポンスのパース自体が失敗した場合 (例外スロー)', async () => {
            // Arrange
            const parseExceptionMessage = 'Cannot parse response';
            const parseError = new Error(parseExceptionMessage);
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeVision.mockResolvedValue(rawApiResponse);
            mockResponseParser.parseResponse.mockRejectedValue(parseError);

            // Act
            const result = await geminiService.analyzeMealImage(imageData);

            // Assert
            expect(result.foods).toEqual([]);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('画像解析エラー');
            expect(result.error?.message).toContain(parseExceptionMessage);
            expect(result.error?.details).toBe(parseError);
        });
    });

    describe('analyzeMealText', () => {
        const inputText = 'りんご 1個 と バナナ 半分';
        const promptText = 'Analyze this meal text.';
        const rawApiResponse = '{\"foods\": [{\"foodName\": \"りんご\", \"quantityText\": \"1個\", \"confidence\": 0.8}, {\"foodName\": \"バナナ\", \"quantityText\": \"半分\", \"confidence\": 0.7}], \"confidence\": 0.75}';
        const parsedResult: GeminiParseResult = {
            foods: [
                { foodName: 'りんご', quantityText: '1個', confidence: 0.8 },
                { foodName: 'バナナ', quantityText: '半分', confidence: 0.7 },
            ],
            confidence: 0.75,
            nutrition: undefined,
            error: '',
        };

        test('正常にテキスト解析が行われ、MealAnalysisResultが返される', async () => {
            // Arrange
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeText.mockResolvedValue(rawApiResponse);
            mockResponseParser.parseResponse.mockResolvedValue(parsedResult);

            // Act
            const result = await geminiService.analyzeMealText(inputText);

            // Assert
            expect(mockPromptService.generatePrompt).toHaveBeenCalledWith(PromptType.TEXT_INPUT_ANALYSIS, { foodsText: inputText });
            expect(mockModelService.invokeText).toHaveBeenCalledWith(promptText, expect.any(Object));
            expect(mockResponseParser.parseResponse).toHaveBeenCalledWith(rawApiResponse);

            expect(result).toBeDefined();
            expect(result.foods).toEqual(parsedResult.foods);
            expect(result.confidence).toBe(parsedResult.confidence);
            expect(result.error).toBeUndefined();
            expect(result.estimatedNutrition).toBeUndefined();
        });

        test('AIモデルの呼び出しでエラーが発生した場合、エラー情報を含む結果を返す', async () => {
            // Arrange
            const errorMessage = 'API Connection Error';
            const apiError = new Error(errorMessage);
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeText.mockRejectedValue(apiError);

            // Act
            const result = await geminiService.analyzeMealText(inputText);

            // Assert
            expect(result.foods).toEqual([]);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('テキスト解析エラー');
            expect(result.error?.message).toContain(errorMessage);
            expect(result.error?.details).toBe(apiError);
        });

        test('レスポンスのパースでエラーが発生した場合 (parseResult.error)', async () => {
            // Arrange
            const parseErrorMessage = 'Invalid JSON in text response';
            const textParseErrorResult: GeminiParseResult = {
                foods: [{ foodName: 'りんご', quantityText: '1個', confidence: 0.9 }],
                confidence: 0.9,
                nutrition: undefined,
                error: parseErrorMessage
            };
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeText.mockResolvedValue(rawApiResponse);
            mockResponseParser.parseResponse.mockResolvedValue(textParseErrorResult);

            // Act
            const result = await geminiService.analyzeMealText(inputText);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.message).toBe(parseErrorMessage);
        });
    });

    describe('parseRecipeFromUrl', () => {
        const recipeUrl = 'https://example.com/recipe';
        const htmlContent = '<html><body><h1>レシピ</h1><p>材料: りんご 1個</p></body></html>';
        const extractedTextContent = ' レシピ 材料: りんご 1個 ';
        const promptText = 'Analyze this recipe content.';
        const rawApiResponse = '{\"title\": \"テストレシピ\", \"servings\": \"2人分\", \"foods\": [{\"foodName\": \"りんご\", \"quantityText\": \"1個\"}]}';
        const parsedResult: GeminiParseResult = {
            title: 'テストレシピ',
            servings: '2人分',
            foods: [{ foodName: 'りんご', quantityText: '1個', confidence: 0.9 }],
            confidence: 0.8,
            nutrition: undefined,
            error: '',
        };
        const mockFetch = jest.fn();
        const originalFetch = globalThis.fetch;
        beforeAll(() => { globalThis.fetch = mockFetch; });
        afterAll(() => { globalThis.fetch = originalFetch; });
        beforeEach(() => { mockFetch.mockClear(); });

        test('URLからHTMLを取得し、正常に解析される', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, text: async () => htmlContent, status: 200 });
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeText.mockResolvedValue(rawApiResponse);
            mockResponseParser.parseResponse.mockResolvedValue(parsedResult);
            const result = await geminiService.parseRecipeFromUrl(recipeUrl);
            expect(mockFetch).toHaveBeenCalledWith(recipeUrl, expect.any(Object));
            expect(mockPromptService.generatePrompt).toHaveBeenCalledWith(PromptType.RECIPE_URL_ANALYSIS, { recipeContent: extractedTextContent });
            expect(mockModelService.invokeText).toHaveBeenCalledWith(promptText, expect.any(Object));
            expect(mockResponseParser.parseResponse).toHaveBeenCalledWith(rawApiResponse);
            expect(result).toBeDefined();
            expect(result.title).toBe(parsedResult.title);
            expect(result.servings).toBe(parsedResult.servings);
            expect(result.ingredients).toEqual(parsedResult.foods);
            expect(result.error).toBeUndefined();
        });

        test('事前にHTMLコンテンツが提供された場合、fetchは呼び出されない', async () => {
            // Arrange
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeText.mockResolvedValue(rawApiResponse);
            mockResponseParser.parseResponse.mockResolvedValue(parsedResult);

            // Act
            const result = await geminiService.parseRecipeFromUrl(recipeUrl, htmlContent);

            // Assert
            expect(mockFetch).not.toHaveBeenCalled();
            expect(mockPromptService.generatePrompt).toHaveBeenCalledWith(PromptType.RECIPE_URL_ANALYSIS, { recipeContent: extractedTextContent });
            expect(mockModelService.invokeText).toHaveBeenCalled();
            expect(mockResponseParser.parseResponse).toHaveBeenCalled();
            expect(result.title).toBe(parsedResult.title);
        });

        test('fetchでエラーが発生した場合、エラー情報を含む結果を返す', async () => {
            // Arrange
            const fetchErrorMsg = 'Network Error';
            mockFetch.mockRejectedValueOnce(new Error(fetchErrorMsg));

            // Act
            const result = await geminiService.parseRecipeFromUrl(recipeUrl);

            // Assert
            expect(result.ingredients).toEqual([]);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('レシピURL解析エラー');
            expect(result.error?.message).toContain(fetchErrorMsg);
        });

        test('fetchでok: falseが返された場合、エラー情報を含む結果を返す', async () => {
            // Arrange
            const status = 404;
            mockFetch.mockResolvedValueOnce({
                ok: false,
                text: async () => 'Not Found',
                status: status,
            });

            // Act
            const result = await geminiService.parseRecipeFromUrl(recipeUrl);

            // Assert
            expect(result.ingredients).toEqual([]);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain(`Failed to fetch URL ${recipeUrl}: ${status}`);
        });

        test('AIモデルの呼び出しでエラーが発生した場合、エラー情報を含む結果を返す', async () => {
            // Arrange
            mockFetch.mockResolvedValueOnce({ ok: true, text: async () => htmlContent, status: 200 });
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            const modelError = new Error('Model invocation failed');
            mockModelService.invokeText.mockRejectedValue(modelError);

            // Act
            const result = await geminiService.parseRecipeFromUrl(recipeUrl);

            // Assert
            expect(result.ingredients).toEqual([]);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('レシピURL解析エラー');
            expect(result.error?.message).toContain(modelError.message);
        });
    });

    describe('getNutritionAdvice', () => {
        const params = { userId: 'user1', targetCalories: 2000 };
        const promptType = PromptType.NUTRITION_ADVICE;
        const promptText = 'Generate nutrition advice.';
        const rawApiResponse = '{\"summary\": \"野菜をもっと食べましょう\", \"recommendedFoods\": [{\"name\": \"野菜スープ\", \"description\": \"温かいスープです\"}]}';
        const expectedResult: Partial<NutritionAdviceResult> = {
            summary: '野菜をもっと食べましょう',
            recommendedFoods: [{ name: '野菜スープ', description: '温かいスープです' }],
        };

        test('正常に栄養アドバイスが生成される', async () => {
            // Arrange
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeText.mockResolvedValue(rawApiResponse);

            // Act
            const result = await geminiService.getNutritionAdvice(params, promptType);

            // Assert
            expect(mockPromptService.generatePrompt).toHaveBeenCalledWith(promptType, params);
            expect(mockModelService.invokeText).toHaveBeenCalledWith(promptText, expect.any(Object));

            expect(result).toBeDefined();
            expect(result.summary).toContain(expectedResult.summary);
            expect(result.recommendedFoods).toEqual(expectedResult.recommendedFoods);
            expect(result.error).toBeUndefined();
        });

        test('AIモデルの呼び出しでエラーが発生した場合、エラー情報を含む結果を返す', async () => {
            // Arrange
            const modelError = new Error('Generation failed');
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeText.mockRejectedValue(modelError);

            // Act
            const result = await geminiService.getNutritionAdvice(params, promptType);

            // Assert
            expect(result.summary).toBeUndefined();
            expect(result.recommendedFoods).toBeUndefined();
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('栄養アドバイス生成エラー');
            expect(result.error?.message).toContain(modelError.message);
        });

        test('プロンプト生成でエラーが発生した場合、エラー情報を含む結果を返す', async () => {
            // Arrange
            const promptError = new Error('Invalid parameters');
            mockPromptService.generatePrompt.mockRejectedValue(promptError);

            // Act
            const result = await geminiService.getNutritionAdvice(params, promptType);

            // Assert
            expect(mockModelService.invokeText).not.toHaveBeenCalled();
            expect(result.summary).toBeUndefined();
            expect(result.recommendedFoods).toBeUndefined();
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('栄養アドバイス生成エラー');
            expect(result.error?.message).toContain(promptError.message);
        });
    });

    describe('generateResponse', () => {
        const context = { meal: 'カレーライス' };
        const promptType = PromptType.NUTRITION_TIPS;
        const promptText = 'Generate tips.';
        const rawApiResponse = '健康的な食事のヒントです。';

        test('正常に汎用応答が生成される', async () => {
            // Arrange
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeText.mockResolvedValue(rawApiResponse);

            // Act
            const result = await geminiService.generateResponse(promptType, context);

            // Assert
            expect(mockPromptService.generatePrompt).toHaveBeenCalledWith(promptType, context);
            expect(mockModelService.invokeText).toHaveBeenCalledWith(promptText, expect.any(Object));
            expect(result).toBe(rawApiResponse);
        });

        test('AIモデルの呼び出しでエラーが発生した場合、エラーがスローされる', async () => {
            // Arrange
            const modelError = new Error('API Timeout');
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeText.mockRejectedValue(modelError);

            // Act & Assert
            await expect(geminiService.generateResponse(promptType, context))
                .rejects
                .toThrow(modelError);
        });

        test('オプションが渡された場合、invokeTextに引き継がれる', async () => {
            // Arrange
            const options = { temperature: 0.9, maxOutputTokens: 100 };
            mockPromptService.generatePrompt.mockResolvedValue(promptText);
            mockModelService.invokeText.mockResolvedValue(rawApiResponse);

            // Act
            await geminiService.generateResponse(promptType, context, options);

            // Assert
            expect(mockModelService.invokeText).toHaveBeenCalledWith(promptText, options);
        });
    });
}); 