//src\app\api\recipes\parse-social-url\route.ts
import { NextResponse } from 'next/server';
import { RecipeService } from '@/lib/services/recipe-service';
import { withAuthAndErrorHandling, createSuccessResponse, validateRequestData } from '@/lib/api/api-handlers';
import { RecipeUrlClipRequest, RecipeUrlClipResponse } from '@/types/recipe';
import { convertToStandardizedNutrition, createEmptyStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';

export const POST = withAuthAndErrorHandling(
    async (req, { user }) => {
        // リクエストを検証
        const { url } = await validateRequestData<RecipeUrlClipRequest>(req, ['url']);

        // レシピデータの解析
        const recipeData = await RecipeService.parseRecipeFromUrl(url);

        // nutrition_per_serving を StandardizedMealNutrition に変換
        const standardizedNutrition = recipeData.nutrition_per_serving
            ? convertToStandardizedNutrition(recipeData.nutrition_per_serving as any)
            : createEmptyStandardizedNutrition();

        // レスポンスデータを作成
        const responseData: RecipeUrlClipResponse = {
            title: recipeData.title,
            image_url: recipeData.image_url,
            source_url: recipeData.source_url,
            source_platform: recipeData.source_platform,
            content_id: recipeData.content_id,
            ingredients: recipeData.ingredients,
            nutrition_per_serving: standardizedNutrition,
            is_social_media: recipeData.is_social_media,
            description: recipeData.description,
            use_placeholder: undefined
        };

        return NextResponse.json(createSuccessResponse(responseData));
    }
); 