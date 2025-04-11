import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { withErrorHandling } from '@/lib/api/middleware';
import { AppError, ErrorCode } from '@/lib/error';

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
    }[];
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
type SupabaseMeal = Meal;

export const GET = withErrorHandling(async (request: NextRequest) => {
    // URLからクエリパラメータを取得
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const rangeType = searchParams.get('range_type'); // 'day', 'week', 'month'

    // パラメータの検証
    if (!startDate || !endDate) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: '開始日と終了日は必須です。'
        });
    }

    // 日付の形式を検証（YYYY-MM-DD）
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: '無効な日付形式です。YYYY-MM-DD形式を使用してください。'
        });
    }

    // サーバーサイドSupabaseクライアントの初期化
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

    // 現在のユーザーセッションを取得
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new AppError({
            code: ErrorCode.Base.AUTH_ERROR,
            message: '認証されていません',
            userMessage: 'この操作にはログインが必要です。'
        });
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
        throw new AppError({
            code: ErrorCode.Base.API_ERROR,
            message: `Supabase query error: ${error.message}`,
            userMessage: '食事データの取得に失敗しました。',
            originalError: error
        });
    }

    // 日付範囲のタイプに応じたデータ集計
    if (rangeType === 'summary') {
        // 日付ごとの栄養素合計を計算
        const dailySummaries: Record<string, DailySummary> = {};

        (meals as SupabaseMeal[]).forEach(meal => {
            const date = meal.meal_date;

            // そのmealDateに関するデータがなければ初期化
            if (!dailySummaries[date]) {
                dailySummaries[date] = {
                    date,
                    meals: 0,
                    nutrients: {}
                };
            }

            dailySummaries[date].meals += 1;

            // 各食事の栄養素を集計
            meal.meal_nutrients?.forEach((mealNutrient: MealNutrient) => {
                const nutrientId = mealNutrient.nutrient_id;
                const nutrientName = mealNutrient.nutrients?.[0]?.name || `nutrient_${nutrientId}`;
                const amount = mealNutrient.amount * (meal.servings || 1);

                // そのmealDateに関するデータがなければ初期化
                if (!dailySummaries[date]) {
                    dailySummaries[date] = {
                        date,
                        meals: 0,
                        nutrients: {}
                    };
                }

                // 栄養素データがなければ初期化
                if (!dailySummaries[date]?.nutrients) {
                    dailySummaries[date]!.nutrients = {};
                }

                if (!dailySummaries[date]?.nutrients[nutrientName]) {
                    dailySummaries[date]!.nutrients[nutrientName] = {
                        id: nutrientId,
                        name: nutrientName,
                        unit: mealNutrient.nutrients?.[0]?.unit || '',
                        total: 0
                    };
                }

                // 栄養素を合計に追加
                if (dailySummaries[date]?.nutrients[nutrientName]) {
                    dailySummaries[date]!.nutrients[nutrientName].total += amount;
                }
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
}); 