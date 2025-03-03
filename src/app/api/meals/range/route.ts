import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

interface NutrientData {
    id: number;
    name: string;
    unit: string;
    total: number;
}

interface DailySummary {
    date: string;
    meals: number;
    nutrients: Record<string, NutrientData>;
}

interface MealNutrient {
    id: number;
    meal_id: number;
    nutrient_id: number;
    amount: number;
    nutrients?: {
        id: number;
        name: string;
        unit: string;
        category: string;
    };
}

interface Meal {
    id: number;
    meal_type: string;
    meal_date: string;
    photo_url?: string;
    food_description?: string;
    servings: number;
    created_at: string;
    updated_at: string;
    meal_nutrients?: MealNutrient[];
}

// Supabaseから返されるデータ型
type SupabaseMeal = any;

export async function GET(request: Request) {
    try {
        // URLからクエリパラメータを取得
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        const rangeType = searchParams.get('range_type'); // 'day', 'week', 'month'

        // パラメータの検証
        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: '開始日と終了日は必須です' },
                { status: 400 }
            );
        }

        // 日付の形式を検証（YYYY-MM-DD）
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
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

        // 日付範囲の食事データを取得
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
            .gte('meal_date', startDate)
            .lte('meal_date', endDate)
            .order('meal_date')
            .order('meal_type');

        if (error) {
            console.error('Supabase取得エラー:', error);
            return NextResponse.json(
                { error: '食事データの取得に失敗しました', details: error.message },
                { status: 500 }
            );
        }

        // 日付範囲のタイプに応じたデータ集計
        if (rangeType === 'summary') {
            // 日付ごとの栄養素合計を計算
            const dailySummaries: Record<string, DailySummary> = {};

            (meals as SupabaseMeal[]).forEach(meal => {
                const date = meal.meal_date;

                if (!dailySummaries[date]) {
                    dailySummaries[date] = {
                        date,
                        meals: 0,
                        nutrients: {}
                    };
                }

                dailySummaries[date].meals += 1;

                // 各食事の栄養素を集計
                meal.meal_nutrients?.forEach((mealNutrient: any) => {
                    const nutrientId = mealNutrient.nutrient_id;
                    const nutrientName = mealNutrient.nutrients?.name || `nutrient_${nutrientId}`;
                    const amount = mealNutrient.amount * (meal.servings || 1);

                    if (!dailySummaries[date].nutrients[nutrientName]) {
                        dailySummaries[date].nutrients[nutrientName] = {
                            id: nutrientId,
                            name: nutrientName,
                            unit: mealNutrient.nutrients?.unit || '',
                            total: 0
                        };
                    }

                    dailySummaries[date].nutrients[nutrientName].total += amount;
                });
            });

            return NextResponse.json({
                success: true,
                data: Object.values(dailySummaries)
            });
        } else {
            // 詳細データをそのまま返す
            return NextResponse.json({
                success: true,
                data: meals
            });
        }
    } catch (error) {
        console.error('食事範囲取得APIエラー:', error);
        return NextResponse.json(
            { error: '食事データ範囲取得中にエラーが発生しました', details: (error as Error).message },
            { status: 500 }
        );
    }
} 