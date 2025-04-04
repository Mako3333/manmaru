import { NextResponse } from 'next/server';
import { RecipeService } from '@/lib/services/recipe-service';
import { withAuthAndErrorHandling, createSuccessResponse } from '@/lib/api/api-handlers';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// レシピの取得
export const GET = withAuthAndErrorHandling(
    async (req, { params, user }) => {
        const { id } = params;

        const recipe = await RecipeService.getRecipeById(id, user.id);

        return NextResponse.json(createSuccessResponse(recipe));
    }
);

// レシピの更新
export const PATCH = withAuthAndErrorHandling(
    async (req, { params, user }) => {
        const { id } = params;

        // 更新データを取得
        const updateData = await req.json();

        // 重要：updateDataからuser_idとidの更新は許可しない
        if (updateData.user_id) delete updateData.user_id;
        if (updateData.id) delete updateData.id;

        try {
            // レシピの存在確認
            await RecipeService.getRecipeById(id, user.id);

            // Supabaseクライアント初期化
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

            // データ更新
            const { data: updatedRecipe, error } = await supabase
                .from('clipped_recipes')
                .update({
                    ...updateData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) {
                throw new ApiError(
                    `レシピ更新エラー: ${error.message}`,
                    ErrorCode.API_ERROR,
                    'レシピの更新中にエラーが発生しました',
                    500
                );
            }

            return NextResponse.json(createSuccessResponse(updatedRecipe, 'レシピを更新しました'));
        } catch (error) {
            // withAuthAndErrorHandlingによって適切にハンドリングされる
            throw error;
        }
    }
);

// レシピの削除
export const DELETE = withAuthAndErrorHandling(
    async (req, { params, user }) => {
        const { id } = params;

        try {
            // レシピの存在確認
            await RecipeService.getRecipeById(id, user.id);

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

            // レシピ削除
            const { error } = await supabase
                .from('clipped_recipes')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) {
                throw new ApiError(
                    `レシピ削除エラー: ${error.message}`,
                    ErrorCode.API_ERROR,
                    'レシピの削除中にエラーが発生しました',
                    500
                );
            }

            return NextResponse.json(createSuccessResponse(
                { id },
                'レシピを削除しました'
            ));
        } catch (error) {
            // withAuthAndErrorHandlingによって適切にハンドリングされる
            throw error;
        }
    }
); 