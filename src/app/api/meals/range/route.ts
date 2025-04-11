import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { withErrorHandling } from '@/lib/api/middleware';
import { AppError, ErrorCode } from '@/lib/error';
import { convertDbFormatToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';
import { StandardizedMealNutrition } from '@/types/nutrition';

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

interface Meal {
    id: string;
    meal_type: string;
    meal_date: string;
    photo_url?: string;
    food_description?: string;
    servings: number | null;
    created_at: string;
    updated_at: string;
    nutrition_data: Record<string, any> | null;
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
            nutrition_data
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

        // 主要栄養素の定義
        const mainNutrients = [
            { id: 1, name: 'calories', unit: 'kcal' },
            { id: 2, name: 'protein', unit: 'g' },
            { id: 3, name: 'iron', unit: 'mg' },
            { id: 4, name: 'folic_acid', unit: 'μg' },
            { id: 5, name: 'calcium', unit: 'mg' },
            { id: 6, name: 'vitamin_d', unit: 'μg' }
        ];

        (meals as SupabaseMeal[]).forEach(meal => {
            const date = meal.meal_date;
            const servings = meal.servings || 1;

            // そのmealDateに関するデータがなければ初期化
            if (!dailySummaries[date]) {
                dailySummaries[date] = {
                    date,
                    meals: 0,
                    nutrients: {}
                };
            }

            dailySummaries[date].meals += 1;

            // 栄養データがある場合の処理
            if (meal.nutrition_data) {
                const standardizedNutrition = convertDbFormatToStandardizedNutrition(meal.nutrition_data);

                if (standardizedNutrition) {
                    // 主要栄養素の処理
                    mainNutrients.forEach(nutrient => {
                        const nutrientName = nutrient.name;
                        let amount = 0;

                        // totalCaloriesの特別処理
                        if (nutrientName === 'calories' && standardizedNutrition.totalCalories) {
                            amount = standardizedNutrition.totalCalories * servings;
                        }
                        // totalNutrientsから値を取得
                        else if (standardizedNutrition.totalNutrients) {
                            const foundNutrient = standardizedNutrition.totalNutrients.find(
                                n => n.name.toLowerCase() === nutrientName
                            );
                            if (foundNutrient && typeof foundNutrient.amount === 'number') {
                                amount = foundNutrient.amount * servings;
                            }
                        }

                        // 栄養素サマリーに追加
                        if (!dailySummaries[date].nutrients[nutrientName]) {
                            dailySummaries[date].nutrients[nutrientName] = {
                                id: nutrient.id,
                                name: nutrientName,
                                unit: nutrient.unit,
                                total: 0
                            };
                        }

                        dailySummaries[date].nutrients[nutrientName].total += amount;
                    });
                }
            }
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