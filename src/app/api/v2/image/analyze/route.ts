import { NextRequest } from 'next/server';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { FoodInputParser } from '@/lib/food/food-input-parser';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { withAuthAndErrorHandling, createSuccessResponse } from '@/lib/util/api-middleware';
import { validateRequestData, validateImageData } from '@/lib/util/request-validation';
import { AIErrorHandler } from '@/lib/ai/ai-error-handler';
import { NutritionErrorHandler } from '@/lib/nutrition/nutrition-error-handler';

/**
 * 画像解析API v2
 * 
 * 食事画像を解析し、新しい栄養計算システムで栄養素を計算します
 */
export const POST = withAuthAndErrorHandling(async (req: NextRequest) => {
    // リクエストデータを取得
    const requestData = await req.json();

    // リクエストデータを検証
    const validationResult = validateRequestData(
        requestData,
        [validateImageData]
    );

    if (!validationResult.valid || !validationResult.data) {
        throw validationResult.error;
    }

    const { imageData } = validationResult.data;
    const startTime = Date.now();

    try {
        // Base64画像データからバイナリに変換
        const base64Data = imageData.split(',')[1]; // data:image/jpeg;base64, の部分を削除
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // AIサービスを取得
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // 画像解析を実行
        const analysisResult = await aiService.analyzeMealImage(imageBuffer);

        // エラーチェック
        if (analysisResult.error) {
            throw AIErrorHandler.handleAnalysisError(analysisResult.error, 'image');
        }

        const foods = analysisResult.parseResult.foods;
        if (foods.length === 0) {
            throw AIErrorHandler.responseParseError(
                new Error('食品が検出されませんでした'),
                `AI応答: "${analysisResult.rawResponse || '応答なし'}"`
            );
        }

        // 栄養計算サービスを取得
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);

        // 食品名と量のペアを生成
        const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(foods);

        // 栄養素を計算
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
            []
        );
    }
});

/**
 * プリフライトリクエスト対応
 */
export const OPTIONS = withAuthAndErrorHandling(async () => {
    return createSuccessResponse({ message: 'OK' });
}, false); 