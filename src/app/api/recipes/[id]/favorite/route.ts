import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// お気に入り状態の切り替え
export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        if (!id) {
            return NextResponse.json(
                { error: 'レシピIDが必要です' },
                { status: 400 }
            );
        }

        // ユーザー認証確認
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            );
        }

        // リクエストからお気に入り状態を取得
        const { is_favorite } = await req.json();

        if (typeof is_favorite !== 'boolean') {
            return NextResponse.json(
                { error: 'is_favoriteはbooleanである必要があります' },
                { status: 400 }
            );
        }

        // レシピの存在確認
        const { data: existingRecipe, error: fetchError } = await supabase
            .from('clipped_recipes')
            .select('id, is_favorite')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'レシピが見つかりません' },
                    { status: 404 }
                );
            }
            throw fetchError;
        }

        // お気に入り状態の更新
        const { data: updatedRecipe, error: updateError } = await supabase
            .from('clipped_recipes')
            .update({
                is_favorite,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({
            message: is_favorite ? 'お気に入りに追加しました' : 'お気に入りから削除しました',
            recipe: updatedRecipe
        });

    } catch (error) {
        console.error('Recipe favorite toggle error:', error);
        return NextResponse.json(
            { error: 'お気に入り設定の更新中にエラーが発生しました' },
            { status: 500 }
        );
    }
} 