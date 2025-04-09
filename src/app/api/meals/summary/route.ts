import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 栄養素サマリーの型定義
interface NutrientSummary {
    id: number;
    name: string;
    unit: string;
    total: number;
    category: string;
}

// 日付ごとのサマリーの型定義
interface DailySummary {
    date: string;
    total_meals: number;
    nutrients: Record<string, NutrientSummary>;
}

// 食事データとそれに関連する型の定義
// interface Nutrient {
//     id: number;
//     name: string;
//     unit: string;
//     category: string;
// }
// 
// interface MealNutrient {
//     id: number;
//     nutrient_id: number;
//     amount: number;
//     nutrients: Nutrient;
// }
// 
// interface Meal {
//     id: number;
//     meal_type: string;
//     meal_date: string;
//     servings: number | null;
//     meal_nutrients: MealNutrient[] | null;
// }

// Supabase からの応答データに合わせた型定義
interface SupabaseNutrient {
    id: number;
    name: string;
    unit: string;
    category: string;
}

interface SupabaseMealNutrient {
    id: number;
    nutrient_id: number;
    amount: number;
    nutrients: SupabaseNutrient | null; // null の可能性を考慮
}

interface SupabaseMeal {
    id: number;
    meal_type: string;
    meal_date: string;
    servings: number | null;
    meal_nutrients: SupabaseMealNutrient[] | null; // null の可能性を考慮
}

export async function GET(request: Request) {
    try {
        // URLからクエリパラメータを取得
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        // パラメータの検証
        if (!date) {
            return NextResponse.json(
                { error: '日付は必須です' },
                { status: 400 }
            );
        }

        // 日付の形式を検証（YYYY-MM-DD）
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return NextResponse.json(
                { error: '無効な日付形式です。YYYY-MM-DD形式を使用してください。' },
                { status: 400 }
            );
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
                        cookieStore.set({ name, value, ...options });
                    },
                    remove(name: string, options: CookieOptions) {
                        cookieStore.delete({ name, ...options });
                    },
                },
            }
        );

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
        servings,
        meal_nutrients(
          id,
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
            .eq('meal_date', date);

        if (error) {
            console.error('Supabase取得エラー:', error);
            return NextResponse.json(
                { error: '食事データの取得に失敗しました', details: error.message },
                { status: 500 }
            );
        }

        // Supabase からの応答が null の場合のフォールバック
        // Supabaseの型推論の問題を回避するため、明示的に型アサーションを使用
        // unknown を経由して型アサーションを行う
        const validMeals: SupabaseMeal[] = (meals as unknown as SupabaseMeal[] | null) || [];

        // 日付ごとの栄養素合計を計算
        const summary: DailySummary = {
            date,
            total_meals: validMeals.length, // meals の代わりに validMeals を使用
            nutrients: {}
        };

        // 各食事の栄養素を集計
        // TODO: Supabaseからの戻り値の正確な型定義を行い、any型を置き換える -> 修正済み
        validMeals.forEach((meal) => { // any を削除し、推論された型 (SupabaseMeal) を使用
            const servings = meal.servings || 1;

            meal.meal_nutrients?.forEach((mealNutrient) => { // any を削除し、推論された型 (SupabaseMealNutrient) を使用
                const nutrient = mealNutrient.nutrients;
                // nutrient が null の場合はスキップ
                if (!nutrient) return;

                const nutrientId = nutrient.id;
                const nutrientName = nutrient.name;
                // mealNutrient.amount が数値であることを保証 (必要なら型ガードを追加)
                const amount = (mealNutrient.amount || 0) * servings;

                if (!summary.nutrients[nutrientName]) {
                    summary.nutrients[nutrientName] = {
                        id: nutrientId,
                        name: nutrientName,
                        unit: nutrient.unit || '', // null/undefined の場合のフォールバック
                        category: nutrient.category || 'その他', // null/undefined の場合のフォールバック
                        total: 0
                    };
                }

                summary.nutrients[nutrientName].total += amount;
            });
        });

        // カテゴリごとに栄養素をグループ化
        const categorizedNutrients: Record<string, NutrientSummary[]> = {};

        Object.values(summary.nutrients).forEach(nutrient => {
            const category = nutrient.category;

            if (!categorizedNutrients[category]) {
                categorizedNutrients[category] = [];
            }

            categorizedNutrients[category].push(nutrient);
        });

        return NextResponse.json({
            success: true,
            data: {
                date: summary.date,
                total_meals: summary.total_meals,
                nutrients_by_category: categorizedNutrients,
                nutrients_flat: Object.values(summary.nutrients)
            }
        });
    } catch (error) {
        console.error('栄養素サマリーAPIエラー:', error);
        return NextResponse.json(
            { error: '栄養素サマリー取得中にエラーが発生しました', details: (error as Error).message },
            { status: 500 }
        );
    }
} 