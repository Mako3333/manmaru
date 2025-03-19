import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RecipeIngredient } from '@/types/recipe';
import { AIService } from '@/lib/ai/ai-service';

interface CalculateNutrientsRequest {
    ingredients: RecipeIngredient[];
    servings: number;
}

export async function POST(req: Request) {
    try {
        // ユーザー認証確認
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            );
        }

        // リクエストボディを取得
        const requestData = await req.json() as CalculateNutrientsRequest;
        const { ingredients, servings } = requestData;

        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return NextResponse.json(
                { error: '材料データが必要です' },
                { status: 400 }
            );
        }

        if (!servings || servings <= 0) {
            return NextResponse.json(
                { error: '有効な人数を指定してください' },
                { status: 400 }
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

            return NextResponse.json({
                success: true,
                nutrition_per_serving: nutritionPerServing,
                meta: nutritionResult.meta
            });
        } catch (aiError: any) {
            console.error('栄養計算AI処理エラー:', aiError);
            return NextResponse.json(
                { error: `栄養素の計算に失敗しました: ${aiError.message || '不明なエラー'}` },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('栄養計算APIエラー:', error);
        return NextResponse.json(
            { error: `栄養素の計算中にエラーが発生しました: ${error.message || '不明なエラー'}` },
            { status: 500 }
        );
    }
} 