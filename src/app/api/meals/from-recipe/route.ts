import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RecipeToMealData } from "@/types/recipe";
import { StandardizedMealNutrition } from "@/types/nutrition";
import { convertToDbNutritionFormat, convertDbFormatToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';

export async function POST(req: Request) {
    try {
        // リクエストボディの解析
        const body = await req.json() as RecipeToMealData;
        const { recipe_id, meal_type, portion_size, meal_date } = body;

        // バリデーション
        if (!recipe_id || !meal_type || !meal_date) {
            return NextResponse.json(
                { error: 'レシピID、食事タイプ、日付は必須です' },
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
            return NextResponse.json(
                { error: '認証されていません' },
                { status: 401 }
            );
        }

        // 指定されたレシピを取得
        const { data: recipe, error: recipeError } = await supabase
            .from('clipped_recipes')
            .select('*')
            .eq('id', recipe_id)
            .eq('user_id', session.user.id)
            .single();

        if (recipeError || !recipe) {
            console.error('レシピ取得エラー:', recipeError);
            return NextResponse.json(
                { error: '指定されたレシピが見つかりません', details: recipeError?.message },
                { status: 404 }
            );
        }

        // DBから取得した栄養データを StandardizedMealNutrition に変換
        const standardizedRecipeNutrition = convertDbFormatToStandardizedNutrition(recipe.nutrition_per_serving);

        if (!standardizedRecipeNutrition) {
            console.warn(`レシピID: ${recipe_id} の栄養データが不正です。`);
            // 栄養データなしとして処理を進めるか、エラーにするか検討
            // ここではエラーとせず、栄養データなしで食事記録を作成する
        }

        // 分量に応じた栄養素の計算 (StandardizedMealNutrition を使用)
        let calculatedStandardizedNutrition: StandardizedMealNutrition | null = null;
        if (standardizedRecipeNutrition) {
            calculatedStandardizedNutrition = {
                ...standardizedRecipeNutrition,
                totalCalories: Math.round((standardizedRecipeNutrition.totalCalories * portion_size) * 100) / 100,
                totalNutrients: standardizedRecipeNutrition.totalNutrients.map(nutrient => ({
                    ...nutrient,
                    value: Math.round((nutrient.value * portion_size) * 100) / 100,
                })),
                // foodItems の栄養素もスケーリングする必要があるが、複雑になるため一旦省略
                // 必要であれば foodItems 内の nutrient.value も portion_size でスケールする
            };
        }

        // 計算後の栄養データを DB 保存形式に変換
        const dbNutritionData = convertToDbNutritionFormat(calculatedStandardizedNutrition);

        // 食事記録を作成
        const { data: mealData, error: mealError } = await supabase
            .from('meals')
            .insert({
                user_id: session.user.id,
                meal_type,
                meal_date,
                food_description: recipe.ingredients,
                nutrition_data: dbNutritionData,
                servings: Math.max(1, Math.round(portion_size))
            })
            .select('id')
            .single();

        if (mealError) {
            console.error('食事記録作成エラー:', mealError);
            return NextResponse.json(
                { error: '食事記録の作成に失敗しました', details: mealError.message },
                { status: 500 }
            );
        }

        // meal_recipe_entriesテーブルにレシピとの関連を保存
        const { error: relationError } = await supabase
            .from('meal_recipe_entries')
            .insert({
                meal_id: mealData.id,
                clipped_recipe_id: recipe_id,
                portion_size
            });

        if (relationError) {
            console.error('レシピ関連保存エラー:', relationError);
            console.warn('レシピと食事の関連付けに失敗しましたが、食事データは保存されました');
        }

        // レシピの最終使用日時を更新
        await supabase
            .from('clipped_recipes')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', recipe_id);

        return NextResponse.json({
            success: true,
            message: 'レシピから食事が記録されました',
            data: {
                id: mealData.id,
                meal_type,
                meal_date
            }
        });
    } catch (error) {
        console.error('レシピからの食事記録APIエラー:', error);
        return NextResponse.json(
            { error: 'レシピからの食事記録中にエラーが発生しました', details: (error as Error).message },
            { status: 500 }
        );
    }
} 