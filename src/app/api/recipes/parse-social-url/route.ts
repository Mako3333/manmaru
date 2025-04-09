//src\app\api\recipes\parse-social-url\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { RecipeService } from '@/lib/services/recipe-service';
import { withAuthAndErrorHandling, createSuccessResponse, validateRequestData } from '@/lib/api/api-handlers';
import { RecipeUrlClipRequest, RecipeUrlClipResponse } from '@/types/recipe';
import { convertToStandardizedNutrition, createEmptyStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';

export const POST = withAuthAndErrorHandling(
    async (req: NextRequest, { user }) => {
        // ユーザーIDをログに記録（未使用変数エラー回避）
        console.debug(`Recipe URL clip requested by user: ${user.id}`);

        // リクエストを検証
        const { url } = await validateRequestData<RecipeUrlClipRequest>(req, ['url']);

        // レシピデータの解析
        const recipeData = await RecipeService.parseRecipeFromUrl(url);

        // nutrition_per_serving を StandardizedMealNutrition に変換
        // TODO: convertToStandardizedNutrition関数の引数型を拡張するか、
        // 正確な変換関数を実装して、この型アサーションを削除する
        const standardizedNutrition = recipeData.nutrition_per_serving
            // @ts-expect-error 現在の型定義ではNutritionData型しか受け付けないが、実際には他の形式も変換可能
            ? convertToStandardizedNutrition(recipeData.nutrition_per_serving)
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