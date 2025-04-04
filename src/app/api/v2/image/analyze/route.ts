import { NextRequest, NextResponse } from 'next/server';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { withErrorHandling } from '@/lib/api/middleware';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { z } from 'zod';
import { convertToLegacyNutrition } from '@/lib/nutrition/nutrition-type-utils';
import type { FoodInputParseResult } from '@/lib/food/food-input-parser';

/**
 * 画像解析API v2
 * 
 * 食事画像を解析し、新しい栄養計算システムで栄養素を計算します
 */
const requestSchema = z.object({
    image: z.string().min(1, "画像データは必須です"),
    mealType: z.string().optional(),
});

export const POST = withErrorHandling(async (req: NextRequest): Promise<NextResponse> => {
    const requestData = await req.json();
    const startTime = Date.now();

    try {
        const validatedData = requestSchema.parse(requestData);
        const imageData = validatedData.image;
        const mealType = validatedData.mealType || '食事';

        if (!imageData || !imageData.startsWith('data:image/')) {
            throw new AppError({
                code: ErrorCode.File.INVALID_IMAGE,
                message: '無効な画像形式です',
                details: { reason: '画像データはbase64エンコードされた文字列である必要があります' }
            });
        }
        const base64Data = imageData.split(',')[1];
        if (!base64Data) {
            throw new AppError({
                code: ErrorCode.File.INVALID_IMAGE,
                message: 'Base64データの解析に失敗しました',
                details: { reason: '画像データからBase64部分を抽出できませんでした' }
            });
        }
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        const analysisResult = await aiService.analyzeMealImage(imageBuffer);

        if (analysisResult.error) {
            throw new AppError({
                code: ErrorCode.AI.IMAGE_PROCESSING_ERROR,
                message: analysisResult.error.message || '画像解析中にAIエラーが発生しました',
                details: { originalError: analysisResult.error.details }
            });
        }

        const foods: FoodInputParseResult[] = analysisResult.foods || [];
        const aiEstimatedNutrition = analysisResult.estimatedNutrition;

        if (foods.length === 0) {
            throw new AppError({
                code: ErrorCode.AI.PARSING_ERROR,
                message: 'AI応答から食品を検出できませんでした',
                userMessage: '画像から食品を検出できませんでした。別の写真で試すか、テキストで入力してください。',
                details: { reason: `AI response did not contain food items. Raw response might be available in service logs.` }
            });
        }

        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);

        let nameQuantityPairs: Array<{ name: string; quantity?: string }>;
        try {
            nameQuantityPairs = foods.map((item) => ({
                name: item.foodName,
                ...(item.quantityText ? { quantity: item.quantityText } : {}),
            }));
        } catch (mapError) {
            throw new AppError({
                code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                message: `Error mapping food results: ${mapError instanceof Error ? mapError.message : String(mapError)}`,
                userMessage: "解析結果の整形中に問題が発生しました。",
                originalError: mapError instanceof Error ? mapError : undefined
            });
        }

        let nutritionResult;
        try {
            nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);
        } catch (nutritionError) {
            throw nutritionError instanceof AppError ? nutritionError : new AppError({
                code: ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR,
                message: `栄養計算中にエラーが発生: ${nutritionError instanceof Error ? nutritionError.message : String(nutritionError)}`,
                userMessage: "栄養価の計算中に問題が発生しました。",
                originalError: nutritionError instanceof Error ? nutritionError : undefined
            });
        }

        const standardizedNutrition = nutritionResult.nutrition;
        let legacyNutrition;
        try {
            legacyNutrition = convertToLegacyNutrition(standardizedNutrition);
        } catch (conversionError) {
            throw new AppError({
                code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                message: `Error converting to legacy nutrition format: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`,
                userMessage: '計算結果の表示形式への変換中に問題が発生しました。',
                originalError: conversionError instanceof Error ? conversionError : undefined
            });
        }

        let warningMessage;
        if (nutritionResult.reliability.confidence < 0.7) {
            warningMessage = '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }

        return NextResponse.json({
            success: true,
            data: {
                foods: foods,
                originalImageProvided: true,
                mealType: mealType,
                nutritionResult: {
                    nutrition: standardizedNutrition,
                    reliability: nutritionResult.reliability,
                    matchResults: nutritionResult.matchResults,
                    legacyNutrition: legacyNutrition
                },
                recognitionConfidence: analysisResult.confidence,
                aiEstimatedNutrition: aiEstimatedNutrition
            },
            meta: {
                processingTimeMs: Date.now() - startTime,
                analysisSource: 'ai',
                ...(warningMessage ? { warning: warningMessage } : {})
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '入力データが無効です',
                details: {
                    reason: error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
                    originalError: error
                }
            });
        }
        if (error instanceof AppError) { throw error; }
        console.error('Unhandled error in /image/analyze:', error);
        throw new AppError({
            code: ErrorCode.Base.UNKNOWN_ERROR,
            message: '画像解析または栄養計算中に予期せぬエラーが発生しました',
            details: { originalError: error instanceof Error ? error.message : String(error) },
            originalError: error instanceof Error ? error : undefined
        });
    }
});

/**
 * プリフライトリクエスト対応
 */
export const OPTIONS = withErrorHandling(async () => {
    return NextResponse.json({ success: true, data: { message: 'OK' } });
}); 