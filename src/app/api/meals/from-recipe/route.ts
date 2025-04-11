import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RecipeToMealData } from "@/types/recipe";

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

        // 分量に応じた栄養素の計算
        const calculatedNutrition: Record<string, number | string | object | unknown> = {};
        if (recipe.nutrition_per_serving) {
            Object.entries(recipe.nutrition_per_serving).forEach(([key, value]) => {
                if (typeof value === 'number') {
                    calculatedNutrition[key] = Math.round((value * portion_size) * 100) / 100;
                } else {
                    calculatedNutrition[key] = value;
                }
            });
        }

        // 食事記録を作成
        const { data: mealData, error: mealError } = await supabase
            .from('meals')
            .insert({
                user_id: session.user.id,
                meal_type,
                meal_date,
                food_description: recipe.ingredients,
                nutrition_data: calculatedNutrition,
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

        // meal_nutrientsテーブルに栄養データを保存
        const nutrition = calculatedNutrition;
        if (nutrition && mealData) {
            const { error: nutrientError } = await supabase
                .from('meal_nutrients')
                .insert({
                    meal_id: mealData.id,
                    calories: nutrition.calories || 0,
                    protein: nutrition.protein || 0,
                    iron: nutrition.iron || 0,
                    folic_acid: nutrition.folic_acid || 0,
                    calcium: nutrition.calcium || 0,
                    vitamin_d: nutrition.vitamin_d || 0,
                    confidence_score: 1.0  // レシピからの登録は信頼度100%
                });

            if (nutrientError) {
                console.error('栄養データ保存エラー:', nutrientError);
                // meal_nutrientsの保存に失敗しても、mealsの保存は成功しているので、警告だけ出す
                console.warn('栄養データの保存に失敗しましたが、食事データは保存されました');
            }
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