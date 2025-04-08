//src\app\api\recipes\calculate-nutrients\route.ts
import { NextResponse, NextRequest } from 'next/server';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { IAIService } from '@/lib/ai/ai-service.interface';
import { withErrorHandling } from '@/lib/api/middleware';
import { createSuccessResponse, validateRequestData } from '@/lib/api/api-handlers';
import { AppError, ErrorCode } from '@/lib/error';
import { FoodRepositoryFactory } from '@/lib/food/food-repository-factory';

export const POST = withErrorHandling(
    async (req: NextRequest) => {
        // リクエスト本文を解析してデータ取得
        const requestData = await validateRequestData<{
            ingredients: { name: string; quantity: string }[];
            servings?: number;
        }>(req, ['ingredients']);

        const { ingredients, servings = 1 } = requestData;

        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '材料リストが空です',
                userMessage: '少なくとも1つの材料が必要です'
            });
        }

        // 名前と量のペアのリストを作成
        const nameQuantityPairs = ingredients.map(item => ({
            name: item.name,
            quantity: item.quantity
        }));

        // 栄養計算サービスのインスタンスを取得
        const nutritionService = NutritionServiceFactory.getInstance().createService(
            FoodRepositoryFactory.getRepository()
        );

        // 栄養計算実行
        const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);

        // 栄養データはすでに StandardizedMealNutrition 型なので変換は不要
        const standardizedNutrition = nutritionResult.nutrition;

        // 1人前あたりの栄養素計算（servings > 1 の場合）
        const perServingNutrition = servings > 1
            ? {
                // servingsで割って1人前のデータを計算
                ...standardizedNutrition,
                totalCalories: standardizedNutrition.totalCalories / servings,
                totalNutrients: standardizedNutrition.totalNutrients.map(nutrient => ({
                    ...nutrient,
                    value: nutrient.value / servings
                }))
            }
            : undefined;

        return NextResponse.json(createSuccessResponse({
            nutritionResult: {
                nutrition: standardizedNutrition,
                legacyNutrition: nutritionResult.nutrition,
                matchResults: nutritionResult.matchResults,
                reliability: nutritionResult.reliability,
                // 1人前データ（オプション）
                perServing: perServingNutrition,
                legacyPerServing: perServingNutrition ? nutritionResult.nutrition : undefined
            }
        }));
    }
); 