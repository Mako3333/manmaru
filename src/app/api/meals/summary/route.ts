import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { withErrorHandling } from '@/lib/api/middleware';
import { AppError, ErrorCode } from '@/lib/error';
import { convertDbFormatToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';

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
interface SupabaseMeal {
    id: string;
    meal_type: string;
    meal_date: string;
    servings: number | null;
    nutrition_data: Record<string, any> | null;
}

export const GET = withErrorHandling(async (request: NextRequest) => {
    try {
        // URLからクエリパラメータを取得
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        // パラメータの検証
        if (!date) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '日付パラメータ(date)は必須です。'
            });
        }

        // 日付の形式を検証（YYYY-MM-DD）
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
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

        // 指定された日付の食事データを取得
        const { data: meals, error } = await supabase
            .from('meals')
            .select(`id, meal_type, meal_date, servings, nutrition_data`)
            .eq('user_id', session.user.id)
            .eq('meal_date', date);

        if (error) {
            console.error('Supabase取得エラー:', error);
            throw new AppError({
                code: ErrorCode.Base.API_ERROR,
                message: `Supabase query error: ${error.message}`,
                userMessage: '食事データの取得に失敗しました。',
                originalError: error
            });
        }

        // Supabase からの応答が null の場合のフォールバック
        const validMeals: SupabaseMeal[] = meals || [];

        // 日付ごとの栄養素合計を計算
        const summary: DailySummary = {
            date,
            total_meals: validMeals.length,
            nutrients: {}
        };

        // 主要栄養素の定義
        const mainNutrients = [
            { id: 1, name: 'calories', unit: 'kcal', category: '主要栄養素' },
            { id: 2, name: 'protein', unit: 'g', category: '主要栄養素' },
            { id: 3, name: 'iron', unit: 'mg', category: '主要栄養素' },
            { id: 4, name: 'folic_acid', unit: 'μg', category: '主要栄養素' },
            { id: 5, name: 'calcium', unit: 'mg', category: '主要栄養素' },
            { id: 6, name: 'vitamin_d', unit: 'μg', category: '主要栄養素' }
        ];

        // 各食事の栄養素を集計
        validMeals.forEach((meal) => {
            const servings = meal.servings || 1;

            if (meal.nutrition_data) {
                // StandardizedMealNutrition形式に変換して利用
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
                            if (foundNutrient && foundNutrient.amount) {
                                amount = foundNutrient.amount * servings;
                            }
                        }

                        // 栄養素サマリーに追加
                        if (!summary.nutrients[nutrientName]) {
                            summary.nutrients[nutrientName] = {
                                id: nutrient.id,
                                name: nutrientName,
                                unit: nutrient.unit,
                                category: nutrient.category,
                                total: 0
                            };
                        }

                        summary.nutrients[nutrientName].total += amount;
                    });

                    // その他の栄養素の処理（該当する場合）
                    if (standardizedNutrition.totalNutrients) {
                        standardizedNutrition.totalNutrients.forEach(nutrient => {
                            const nutrientName = nutrient.name.toLowerCase();

                            // 主要栄養素以外を処理
                            if (!mainNutrients.some(n => n.name === nutrientName) && nutrient.amount) {
                                const amount = nutrient.amount * servings;

                                if (!summary.nutrients[nutrientName]) {
                                    summary.nutrients[nutrientName] = {
                                        id: 100 + Object.keys(summary.nutrients).length, // 仮のID
                                        name: nutrientName,
                                        unit: nutrient.unit || '',
                                        category: 'その他栄養素',
                                        total: 0
                                    };
                                }

                                summary.nutrients[nutrientName].total += amount;
                            }
                        });
                    }
                }
            }
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
}); 