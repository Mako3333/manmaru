import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RecipeUrlClipResponse } from '@/types/recipe';

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

        // リクエストボディからレシピデータを取得
        const recipeData = await req.json() as RecipeUrlClipResponse & { recipe_type?: string };

        if (!recipeData.title || !recipeData.source_url) {
            return NextResponse.json(
                { error: 'レシピ情報が不完全です' },
                { status: 400 }
            );
        }

        // 同じURLのレシピが既に存在するかチェック
        const { data: existingRecipe } = await supabase
            .from('clipped_recipes')
            .select('id')
            .eq('user_id', user.id)
            .eq('source_url', recipeData.source_url)
            .maybeSingle();

        if (existingRecipe) {
            // 既存レシピを更新
            const { data: updatedRecipe, error: updateError } = await supabase
                .from('clipped_recipes')
                .update({
                    title: recipeData.title,
                    image_url: recipeData.image_url,
                    source_platform: recipeData.source_platform,
                    recipe_type: recipeData.recipe_type || 'main_dish', // デフォルト値
                    ingredients: recipeData.ingredients,
                    nutrition_per_serving: recipeData.nutrition_per_serving,
                    caution_foods: recipeData.caution_foods,
                    caution_level: recipeData.caution_level,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingRecipe.id)
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            return NextResponse.json({
                message: 'レシピを更新しました',
                recipe: updatedRecipe,
                isNew: false
            });
        }

        // 新規レシピとして保存
        const { data: newRecipe, error: insertError } = await supabase
            .from('clipped_recipes')
            .insert({
                user_id: user.id,
                title: recipeData.title,
                image_url: recipeData.image_url,
                source_url: recipeData.source_url,
                source_platform: recipeData.source_platform,
                recipe_type: recipeData.recipe_type || 'main_dish', // デフォルト値
                ingredients: recipeData.ingredients,
                nutrition_per_serving: recipeData.nutrition_per_serving,
                caution_foods: recipeData.caution_foods,
                caution_level: recipeData.caution_level,
                is_favorite: false,
                servings: 1,
                clipped_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            throw insertError;
        }

        return NextResponse.json({
            message: 'レシピを保存しました',
            recipe: newRecipe,
            isNew: true
        });

    } catch (error) {
        console.error('Recipe save error:', error);
        return NextResponse.json(
            { error: 'レシピの保存中にエラーが発生しました' },
            { status: 500 }
        );
    }
} 