import { NextRequest } from 'next/server';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { withAuthAndErrorHandling, createSuccessResponse } from '@/lib/util/api-middleware';
import { validateRequestData, validateFoodTextInput } from '@/lib/util/request-validation';
import { AIErrorHandler } from '@/lib/ai/ai-error-handler';
import { NutritionErrorHandler } from '@/lib/nutrition/nutrition-error-handler';
import { FoodInputParser } from '@/lib/food/food-input-parser';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';

/**
 * 食品テキスト入力解析API v2
 * 
 * テキストから食品リストを解析し、新しい栄養計算システムで栄養素を計算します
 */
export const POST = withAuthAndErrorHandling(async (req: NextRequest) => {
    // リクエストデータを取得
    const requestData = await req.json();

    // リクエストデータを検証
    const validationResult = validateRequestData(
        requestData,
        [validateFoodTextInput]
    );

    if (!validationResult.valid || !validationResult.data) {
        throw validationResult.error;
    }

    const { text } = validationResult.data;
    const startTime = Date.now();

    try {
        // 1. テキスト解析
        // 直接解析可能な形式の場合はFoodInputParserを使用
        const parsedFoods = FoodInputParser.parseBulkInput(text);

        let foods;
        let processingTimeMs;
        let warningMessage;

        // 直接解析できた場合
        if (parsedFoods.length > 0) {
            foods = parsedFoods;
            processingTimeMs = Date.now() - startTime;
        } else {
            // AIサービスを使用して解析
            const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);
            const analysisResult = await aiService.analyzeMealText(text);

            // エラーチェック
            if (analysisResult.error) {
                throw AIErrorHandler.handleAnalysisError(analysisResult.error, 'text');
            }

            foods = analysisResult.parseResult.foods;
            processingTimeMs = analysisResult.processingTimeMs;

            if (foods.length === 0) {
                throw AIErrorHandler.responseParseError(
                    new Error('食品が検出されませんでした'),
                    `入力: "${text}", AI応答: "${analysisResult.rawResponse || '応答なし'}"`
                );
            }
        }

        // 2. 食品マッチングと栄養計算
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);
        const matchingService = FoodMatchingServiceFactory.getService();

        // 食品名と量のペアを生成
        const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(foods);

        // マッチング結果に基づいて栄養計算
        const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);

        // 信頼性の確認
        if (nutritionResult.reliability.confidence < 0.7) {
            warningMessage = '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }

        // 結果を返却
        return createSuccessResponse({
            foods: foods,
            nutritionResult: nutritionResult,
            processingTimeMs: processingTimeMs || (Date.now() - startTime)
        }, warningMessage);

    } catch (error) {
        // エラーを栄養計算エラーとして処理
        throw NutritionErrorHandler.handleCalculationError(
            error,
            [{ name: text }]
        );
    }
});

/**
 * プリフライトリクエスト対応
 */
export const OPTIONS = withAuthAndErrorHandling(async () => {
    return createSuccessResponse({ message: 'OK' });
}, false); 