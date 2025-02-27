import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function POST(req: Request) {
    try {
        // リクエストボディの解析
        const body = await req.json();
        const { meal_type, meal_date, photo_url, food_description, nutrition_data, servings } = body;

        // バリデーション
        if (!meal_type || !meal_date) {
            return NextResponse.json(
                { error: '食事タイプと日付は必須です' },
                { status: 400 }
            );
        }

        // サーバーサイドSupabaseクライアントの初期化
        const cookieStore = cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });

        // 現在のユーザーセッションを取得
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json(
                { error: '認証されていません' },
                { status: 401 }
            );
        }

        // データベースに保存
        const { data, error } = await supabase
            .from('meals')
            .insert({
                user_id: session.user.id,
                meal_type,
                meal_date,
                photo_url,
                food_description,
                nutrition_data,
                servings: servings || 1
            })
            .select('id')
            .single();

        if (error) {
            console.error('Supabase保存エラー:', error);
            return NextResponse.json(
                { error: '食事の保存に失敗しました', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: '食事が保存されました',
            data: { id: data.id }
        });
    } catch (error) {
        console.error('食事保存APIエラー:', error);
        return NextResponse.json(
            { error: '食事保存中にエラーが発生しました', details: (error as Error).message },
            { status: 500 }
        );
    }
} 