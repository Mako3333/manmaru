import { NextResponse, NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { RecipeUrlClipResponse } from '@/types/recipe';
import { withErrorHandling } from '@/lib/api/middleware';
import { AppError, ErrorCode } from '@/lib/error';

// リクエストボディの拡張型定義
interface RecipeSaveRequest extends RecipeUrlClipResponse {
    recipe_type?: string;
    servings?: number;
    use_placeholder?: boolean;
}

export const POST = withErrorHandling(async (req: NextRequest) => {
    // ユーザー認証確認
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.delete({ name, ...options });
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new AppError({
            code: ErrorCode.Base.AUTH_ERROR,
            message: '認証が必要です',
            userMessage: 'この操作にはログインが必要です。'
        });
    }

    // リクエストボディからレシピデータを取得
    // TODO: より安全な型検証（例: zod）を導入することを推奨
    const recipeData = await req.json() as RecipeSaveRequest;

    console.log('保存するレシピデータ:', JSON.stringify(recipeData, null, 2));

    if (!recipeData.title || !recipeData.source_url) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: 'レシピ情報が不完全です (タイトルまたはURLがありません)',
            userMessage: 'レシピのタイトルまたはURLが取得できませんでした。'
        });
    }

    // テーブル構造を確認
    const { data: tableInfo, error: tableError } = await supabase
        .from('clipped_recipes')
        .select('*')
        .limit(1);

    if (tableError) {
        console.error('テーブル構造確認エラー:', tableError);
        throw new AppError({
            code: ErrorCode.Base.API_ERROR,
            message: `Failed to check table structure: ${tableError.message}`,
            userMessage: 'データベースの構造確認中にエラーが発生しました。',
            originalError: tableError
        });
    }

    console.log('テーブル構造サンプル:', tableInfo);

    // カラム名の配列を作成
    const columns = tableInfo && tableInfo.length > 0
        ? Object.keys(tableInfo[0])
        : [];

    console.log('利用可能なカラム:', columns);

    // 同じURLのレシピが既に存在するかチェック
    const { data: existingRecipe } = await supabase
        .from('clipped_recipes')
        .select('id')
        .eq('user_id', user.id)
        .eq('source_url', recipeData.source_url)
        .maybeSingle();

    // 保存用のデータを準備 - 基本情報（すべてのテーブルに存在するカラム）
    // TODO: より具体的な型定義を使用することが望ましいですが、
    // Supabaseの動的なスキーマに対応するため、現時点ではRecord型を使用
    // TODO: 将来的にはSupabaseの型生成機能などを活用し、テーブルスキーマに合わせた型を使用する
    const saveData: Record<string, unknown> = {
        title: recipeData.title,
        image_url: recipeData.image_url,
        source_platform: recipeData.source_platform,
        content_id: recipeData.content_id,
        recipe_type: recipeData.recipe_type || 'main_dish',
        ingredients: recipeData.ingredients,
        nutrition_per_serving: recipeData.nutrition_per_serving,
        caution_foods: recipeData.caution_foods,
        caution_level: recipeData.caution_level,
    };

    // カラムが存在するときだけ値を設定する
    if (columns.includes('use_placeholder')) {
        console.log('use_placeholderカラムが存在します。値を設定します:', recipeData.use_placeholder || false);
        saveData.use_placeholder = recipeData.use_placeholder || false;
    } else {
        console.log('use_placeholderカラムがテーブルに存在しないため、このフィールドはスキップします');
    }

    if (columns.includes('is_social_media')) {
        saveData.is_social_media = recipeData.is_social_media || false;
    }

    if (columns.includes('servings')) {
        saveData.servings = recipeData.servings || 1;
    }

    if (existingRecipe) {
        // 既存レシピを更新
        saveData.updated_at = new Date().toISOString();

        const { data: updatedRecipe, error: updateError } = await supabase
            .from('clipped_recipes')
            .update(saveData)
            .eq('id', existingRecipe.id)
            .select()
            .single();

        if (updateError) {
            console.error('レシピ更新エラー:', updateError);
            throw new AppError({
                code: ErrorCode.Base.API_ERROR,
                message: `Failed to update recipe: ${updateError.message}`,
                userMessage: 'レシピの更新に失敗しました。',
                originalError: updateError
            });
        }

        return NextResponse.json({
            message: 'レシピを更新しました',
            recipe: updatedRecipe,
            isNew: false
        });
    }

    // 新規レシピとして保存
    saveData.user_id = user.id;
    saveData.source_url = recipeData.source_url;
    saveData.is_favorite = false;
    saveData.clipped_at = new Date().toISOString();

    const { data: newRecipe, error: insertError } = await supabase
        .from('clipped_recipes')
        .insert(saveData)
        .select()
        .single();

    if (insertError) {
        console.error('レシピ保存エラー:', insertError);
        throw new AppError({
            code: ErrorCode.Base.API_ERROR,
            message: `Failed to insert recipe: ${insertError.message}`,
            userMessage: 'レシピの保存に失敗しました。',
            originalError: insertError
        });
    }

    return NextResponse.json({
        message: 'レシピを保存しました',
        recipe: newRecipe,
        isNew: true
    });
}); 