import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api/middleware';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { z } from 'zod';
import { parseFoodInputText } from '@/lib/food/food-parsing-service';

// リクエストの検証スキーマ
const requestSchema = z.object({
    text: z.string().min(1, "テキスト入力は必須です"),
    mealType: z.string().optional(),
    trimester: z.number().int().min(1).max(3).optional()
});

/**
 * 食事テキスト解析・栄養計算API v2
 */
export const POST = withErrorHandling(async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestData = await req.json();

    try {
        const validatedData = requestSchema.parse(requestData);
        const text = validatedData.text.trim();
        const mealType = validatedData.mealType || '食事';
        const trimester = validatedData.trimester;

        const parseResult = await parseFoodInputText(text);

        if (parseResult.error) {
            throw parseResult.error;
        }

        const foods = parseResult.foods;

        if (!foods || foods.length === 0) {
            throw new AppError({
                code: ErrorCode.Nutrition.FOOD_NOT_FOUND,
                message: '食品が検出されませんでした',
                userMessage: '入力テキストから食品を検出できませんでした。別の入力をお試しください。',
                details: { reason: `Food parsing service (source: ${parseResult.analysisSource}) could not detect any food items.` }
            });
        }

        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);

        const nameQuantityPairs = (() => {
            try {
                return foods.map((item) => ({
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
        })();

        const nutritionResult = await (async () => {
            try {
                // TODO: trimester などの情報を栄養計算サービスに渡す必要があれば追加
                return await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);
            } catch (nutritionError) {
                if (nutritionError instanceof AppError) {
                    throw nutritionError;
                } else {
                    throw new AppError({
                        code: ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR,
                        message: `栄養計算中にエラーが発生: ${nutritionError instanceof Error ? nutritionError.message : String(nutritionError)}`,
                        userMessage: "栄養価の計算中に問題が発生しました。",
                        originalError: nutritionError instanceof Error ? nutritionError : undefined
                    });
                }
            }
        })();

        const standardizedNutrition = nutritionResult.nutrition;

        const warningMessage = (() => {
            if (nutritionResult.reliability.confidence < 0.7) {
                return '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
            }
            return undefined;
        })();

        const aiSpecificData = parseResult.analysisSource === 'ai' && parseResult.aiRawResult ? {
            recognitionConfidence: parseResult.confidence,
            aiEstimatedNutrition: parseResult.aiRawResult.estimatedNutrition
        } : {};

        return NextResponse.json({
            success: true,
            data: {
                foods: foods,
                originalText: text,
                mealType,
                ...(trimester ? { trimester } : {}),
                nutritionResult: {
                    nutrition: standardizedNutrition,
                    reliability: nutritionResult.reliability,
                    matchResults: nutritionResult.matchResults
                },
                ...aiSpecificData
            },
            meta: {
                processingTimeMs: Date.now() - startTime,
                analysisSource: parseResult.analysisSource,
                ...(warningMessage ? { warning: warningMessage } : {})
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '入力データが無効です',
                userMessage: "入力内容に誤りがあります。確認してください。",
                details: {
                    reason: error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
                    originalError: error
                }
            });
        }

        if (error instanceof AppError) {
            throw error;
        }

        // console.error('Unhandled error in /meal/text-analyze:', error); 
        throw new AppError({
            code: ErrorCode.Base.UNKNOWN_ERROR,
            message: `Unhandled error in /meal/text-analyze: ${error instanceof Error ? error.message : String(error)}`,
            userMessage: "サーバー内部で予期しない問題が発生しました。",
            originalError: error instanceof Error ? error : undefined
        });
    }
});

export const OPTIONS = withErrorHandling(async () => {
    return NextResponse.json({ success: true, data: { message: 'OK' } });
}); 