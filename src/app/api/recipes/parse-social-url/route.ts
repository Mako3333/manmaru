//src\app\api\recipes\parse-social-url\route.ts
import { NextResponse } from 'next/server';
import { RecipeService } from '@/lib/services/recipe-service';
import { withAuthAndErrorHandling, createSuccessResponse, validateRequestData } from '@/lib/api/api-handlers';
import { RecipeUrlClipRequest, RecipeUrlClipResponse } from '@/types/recipe';

export const POST = withAuthAndErrorHandling(
    async (req, { user }) => {
        // リクエストを検証
        const { url } = await validateRequestData<RecipeUrlClipRequest>(req, ['url']);

        // レシピデータの解析
        const recipeData = await RecipeService.parseRecipeFromUrl(url);

        return NextResponse.json(createSuccessResponse(recipeData as RecipeUrlClipResponse));
    }
); 