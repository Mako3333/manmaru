import { NextResponse } from 'next/server';
import { RecipeIngredient } from '@/types/recipe';
import { AIService } from '@/lib/ai/ai-service';
import { withAuthAndErrorHandling, createSuccessResponse, validateRequestData } from '@/lib/api/api-handlers';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';

interface CalculateNutrientsRequest {
    ingredients: RecipeIngredient[];
    servings: number;
}

export const POST = withAuthAndErrorHandling(
    async (req, { user }) => {
        // リクエストを検証
        const { ingredients, servings } = await validateRequestData<CalculateNutrientsRequest>(
            req,
            ['ingredients', 'servings']
        );

        // 追加の検証
        if (!Array.isArray(ingredients) || ingredients.length === 0) {
            throw new ApiError(
                '材料データが空または無効です',
                ErrorCode.DATA_VALIDATION_ERROR,
                '材料データが必要です',
                400
            );
        }

        if (servings <= 0) {
            throw new ApiError(
                `無効なサービング数: ${servings}`,
                ErrorCode.DATA_VALIDATION_ERROR,
                '有効な人数を指定してください',
                400
            );
        }

        // AIServiceのフォーマットに変換
        const foodInputs = ingredients.map(ingredient => ({
            name: ingredient.name,
            quantity: ingredient.quantity
        }));

        try {
            // AIServiceを使用して栄養素を計算
            const aiService = AIService.getInstance();
            const nutritionResult = await aiService.analyzeTextInput(foodInputs);

            // サービング数に応じて栄養素を1人前に変換
            const nutritionPerServing = {
                calories: nutritionResult.nutrition.calories / servings,
                protein: nutritionResult.nutrition.protein / servings,
                iron: nutritionResult.nutrition.iron / servings,
                folic_acid: nutritionResult.nutrition.folic_acid / servings,
                calcium: nutritionResult.nutrition.calcium / servings,
                vitamin_d: nutritionResult.nutrition.vitamin_d ? nutritionResult.nutrition.vitamin_d / servings : 0
            };

            return NextResponse.json(createSuccessResponse({
                nutrition_per_serving: nutritionPerServing,
                meta: nutritionResult.meta
            }));
        } catch (aiError) {
            throw new ApiError(
                `栄養計算AI処理エラー: ${aiError instanceof Error ? aiError.message : String(aiError)}`,
                ErrorCode.NUTRITION_CALCULATION_ERROR,
                '栄養素の計算に失敗しました。入力内容を確認してください。',
                500,
                { originalError: aiError }
            );
        }
    }
); 