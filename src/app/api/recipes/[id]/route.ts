import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// レシピの取得
export async function GET(req: Request, { params }: { params: { id: string } }) {
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

        // レシピデータ取得
        const { data: recipe, error } = await supabase
            .from('clipped_recipes')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'レシピが見つかりません' },
                    { status: 404 }
                );
            }
            throw error;
        }

        return NextResponse.json(recipe);

    } catch (error) {
        console.error('Recipe fetch error:', error);
        return NextResponse.json(
            { error: 'レシピの取得中にエラーが発生しました' },
            { status: 500 }
        );
    }
}

// レシピの更新
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

        // 更新データを取得
        const updateData = await req.json();

        // 重要：updateDataからuser_idとidの更新は許可しない
        if (updateData.user_id) delete updateData.user_id;
        if (updateData.id) delete updateData.id;

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
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'レシピが見つかりません' },
                    { status: 404 }
                );
            }
            throw error;
        }

        return NextResponse.json(updatedRecipe);

    } catch (error) {
        console.error('Recipe update error:', error);
        return NextResponse.json(
            { error: 'レシピの更新中にエラーが発生しました' },
            { status: 500 }
        );
    }
}

// レシピの削除
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
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

        // レシピ削除
        const { error } = await supabase
            .from('clipped_recipes')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            throw error;
        }

        return NextResponse.json({
            message: 'レシピを削除しました',
            id
        });

    } catch (error) {
        console.error('Recipe delete error:', error);
        return NextResponse.json(
            { error: 'レシピの削除中にエラーが発生しました' },
            { status: 500 }
        );
    }
} 