import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    { params }: { params: { date: string } }
) {
    try {
        const date = params.date;

        // 日付の形式を検証（YYYY-MM-DD）
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { error: '無効な日付形式です。YYYY-MM-DD形式を使用してください。' },
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

        // 指定された日付の食事データを取得
        const { data: meals, error } = await supabase
            .from('meals')
            .select(`
        id,
        meal_type,
        meal_date,
        photo_url,
        food_description,
        servings,
        created_at,
        updated_at,
        meal_nutrients(
          id,
          meal_id,
          nutrient_id,
          amount,
          nutrients(
            id,
            name,
            unit,
            category
          )
        )
      `)
            .eq('user_id', session.user.id)
            .eq('meal_date', date)
            .order('meal_type');

        if (error) {
            console.error('Supabase取得エラー:', error);
            return NextResponse.json(
                { error: '食事データの取得に失敗しました', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: meals
        });
    } catch (error) {
        console.error('食事取得APIエラー:', error);
        return NextResponse.json(
            { error: '食事データ取得中にエラーが発生しました', details: (error as Error).message },
            { status: 500 }
        );
    }
} 