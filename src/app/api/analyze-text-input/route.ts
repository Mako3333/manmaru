//src\app\api\analyze-text-input\route.ts
import { NextRequest } from 'next/server';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { withAuthAndErrorHandling, createSuccessResponse } from '@/lib/util/api-middleware';
import { validateRequestData, validateFoodTextInput } from '@/lib/util/request-validation';
import { AIErrorHandler } from '@/lib/ai/ai-error-handler';
import { NutritionErrorHandler } from '@/lib/nutrition/nutrition-error-handler';
import { FoodInputParser } from '@/lib/food/food-input-parser';

/**
 * 食品テキスト入力解析API
 * 
 * テキストから食品リストを解析し、栄養素を計算します
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

    try {
        // AIサービスを取得
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // テキスト解析を実行
        const analysisResult = await aiService.analyzeMealText(text);

        // エラーチェック
        if (analysisResult.error) {
            throw AIErrorHandler.handleAnalysisError(analysisResult.error, 'text');
        }

        // 栄養計算サービスを取得
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);

        // 解析結果から栄養素を計算
        const foods = analysisResult.parseResult.foods;
        if (foods.length === 0) {
            throw AIErrorHandler.responseParseError(
                new Error('食品が検出されませんでした'),
                `入力: "${text}", AI応答: "${analysisResult.rawResponse || '応答なし'}"`
            );
        }

        const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(foods);
        const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);

        // 警告メッセージの設定
        let warningMessage;
        if (nutritionResult.reliability.confidence < 0.7) {
            warningMessage = '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }

        // 結果を返却
        return createSuccessResponse({
            foods: foods,
            nutritionResult: nutritionResult,
            processingTimeMs: analysisResult.processingTimeMs
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