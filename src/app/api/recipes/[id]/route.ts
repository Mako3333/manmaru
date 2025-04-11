import { NextRequest, NextResponse } from 'next/server';
import { RecipeService } from '@/lib/services/recipe-service';
import { withAuthAndErrorHandling, createSuccessResponse } from '@/lib/api/api-handlers';
import { AppError, ErrorCode } from '@/lib/error';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js'; // User 型をインポート

// Define context type -> 未使用のため削除
// type RouteContext = {
//     params: { id: string };
// };

// Supabaseクライアント作成関数 (async に変更)
const createSupabaseClient = async () => {
    const cookieStore = await cookies(); // await を追加
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    // cookieStore.set({ name, value, ...options }); // 変更前: ガイドライン違反
                    // Route Handler 内の cookieStore は読み取り専用のため no-op にする
                },
                remove(name: string, options: CookieOptions) {
                    // cookieStore.delete({ name, ...options }); // 変更前: ガイドライン違反
                    // Route Handler 内の cookieStore は読み取り専用のため no-op にする
                },
            },
        }
    );
};

// レシピの取得
export const GET = withAuthAndErrorHandling(
    async (req: NextRequest, { params, user }: { params: Record<string, string>, user: User }) => {
        const { id } = params;

        // IDの検証
        if (!id) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'レシピIDが指定されていません',
                userMessage: 'レシピIDが必要です'
            });
        }

        const recipe = await RecipeService.getRecipeById(id, user.id);

        return NextResponse.json(createSuccessResponse(recipe));
    }
);

// レシピの更新
export const PATCH = withAuthAndErrorHandling(
    async (req: NextRequest, { params, user }: { params: Record<string, string>, user: User }) => {
        const { id } = params;

        // IDの検証
        if (!id) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'レシピIDが指定されていません',
                userMessage: 'レシピIDが必要です'
            });
        }

        try {
            // レシピの存在確認 (RecipeServiceを使用)
            await RecipeService.getRecipeById(id, user.id);

            // Supabaseクライアント初期化 (共通関数を使用, await を追加)
            const supabase = await createSupabaseClient();

            // リクエストボディからレシピ更新用データを取得
            // TODO: より安全な型検証（例: zod）と具体的な型定義を導入することを推奨
            const updateData = await req.json() as Record<string, unknown>;

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
                throw new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: `レシピ更新エラー: ${error.message}`,
                    userMessage: 'レシピの更新中にエラーが発生しました',
                    originalError: error instanceof Error ? error : undefined
                });
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
    async (req: NextRequest, { params, user }: { params: Record<string, string>, user: User }) => {
        const { id } = params;

        // IDの検証
        if (!id) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'レシピIDが指定されていません',
                userMessage: 'レシピIDが必要です'
            });
        }

        try {
            // レシピの存在確認 (RecipeServiceを使用)
            await RecipeService.getRecipeById(id, user.id);

            // Supabaseクライアント初期化 (共通関数を使用, await を追加)
            const supabase = await createSupabaseClient();

            // レシピ削除
            const { error } = await supabase
                .from('clipped_recipes')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) {
                throw new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: `レシピ削除エラー: ${error.message}`,
                    userMessage: 'レシピの削除中にエラーが発生しました',
                    originalError: error instanceof Error ? error : undefined
                });
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