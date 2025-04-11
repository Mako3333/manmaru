import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, NextRequest } from "next/server";
import { RecipeToMealData, ClippedRecipe } from "@/types/recipe";
import { StandardizedMealNutrition } from "@/types/nutrition";
import { withErrorHandling } from "@/lib/api/middleware";
import { AppError, ErrorCode } from "@/lib/error";

export const POST = withErrorHandling(async (req: NextRequest) => {
    const body = await req.json() as RecipeToMealData;
    const { recipe_id, meal_type, portion_size, meal_date } = body;

    if (!recipe_id || !meal_type || portion_size === undefined || portion_size === null || !meal_date) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: "Recipe ID, meal type, portion size, and date are required.",
            userMessage: "レシピID、食事タイプ、分量、日付は必須です。",
            details: body,
            severity: 'warning'
        });
    }
    if (typeof portion_size !== 'number' || portion_size <= 0 || !Number.isFinite(portion_size)) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: `Invalid portion_size value: ${portion_size}. Must be a finite number greater than 0.`,
            userMessage: "分量の値が不正です。0より大きい数値を入力してください。",
            details: { portion_size },
            severity: 'warning'
        });
    }

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
                    // Route Handler では no-op (ガイドライン cookie.md 参照)
                },
                remove(name: string, options: CookieOptions) {
                    // Route Handler では no-op (ガイドライン cookie.md 参照)
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new AppError({
            code: ErrorCode.Base.AUTH_ERROR,
            message: "User not authenticated.",
            userMessage: "認証されていません。ログインしてください。",
            severity: 'error'
        });
    }

    // ★★★ デバッグログ追加 (1) ★★★
    console.log('[API /meals/from-recipe] Fetching recipe with ID:', recipe_id);
    const { data: recipe, error: recipeError } = await supabase
        .from('clipped_recipes')
        .select('*')
        .eq('id', recipe_id)
        .eq('user_id', session.user.id)
        .single<ClippedRecipe>();

    // ★★★ デバッグログ追加 (2) ★★★
    if (recipeError) {
        console.error('[API /meals/from-recipe] Error fetching recipe:', recipeError);
    }
    if (!recipe) {
        console.warn('[API /meals/from-recipe] Recipe not found or access denied.');
    }
    // レシピ全体をログ出力
    console.log('[API /meals/from-recipe] Fetched recipe data:', JSON.stringify(recipe, null, 2));

    if (recipeError || !recipe) {
        throw new AppError({
            code: ErrorCode.Resource.NOT_FOUND,
            message: `Recipe not found or access denied (ID: ${recipe_id}). DB Error: ${recipeError?.message}`,
            userMessage: "指定されたレシピが見つからないか、アクセス権がありません。",
            originalError: recipeError ? new Error(recipeError.message) : undefined,
            details: { recipeId: recipe_id, userId: session.user.id },
            severity: 'error'
        });
    }

    const standardizedRecipeNutrition = recipe.nutrition_per_serving;
    const originalServings = recipe.servings; // ★★★ 元レシピの人数を取得 ★★★

    // ★★★ デバッグログ追加 (3) ★★★
    console.log('[API /meals/from-recipe] Original recipe servings:', originalServings);
    console.log('[API /meals/from-recipe] Nutrition data from DB (assumed total):', JSON.stringify(standardizedRecipeNutrition, null, 2));

    // --- 栄養価計算ロジック修正 --- 
    // DBの栄養価が「全体」で、人数も有効な場合のみ計算
    if (!standardizedRecipeNutrition ||
        typeof standardizedRecipeNutrition.totalCalories !== 'number' ||
        !Array.isArray(standardizedRecipeNutrition.totalNutrients) ||
        typeof originalServings !== 'number' ||
        originalServings <= 0 ||
        !Number.isFinite(originalServings)) {
        console.error(`Recipe ID: ${recipe_id} has invalid/missing nutrition data or invalid original servings.`);
        throw new AppError({
            code: ErrorCode.Nutrition.MISSING_NUTRITION_DATA,
            message: `Recipe ID: ${recipe_id} has invalid/missing nutrition data or invalid original servings (${originalServings}). Cannot calculate meal nutrition.`,
            userMessage: "レシピの栄養データまたは人数情報が不正なため、食事記録を作成できませんでした。",
            details: { recipeId: recipe_id, nutritionData: standardizedRecipeNutrition, originalServings: originalServings },
            severity: 'error'
        });
    }

    // ★★★ 1人前あたりの栄養価を計算 ★★★
    const oneServingNutrition: StandardizedMealNutrition = {
        ...standardizedRecipeNutrition,
        totalCalories: standardizedRecipeNutrition.totalCalories / originalServings,
        totalNutrients: standardizedRecipeNutrition.totalNutrients.map(nutrient => ({
            ...nutrient,
            value: nutrient.value / originalServings,
        })),
        // foodItems は元のレシピのものを保持（または必要ならスケーリング）
    };

    // ★★★ 実際に食べた量 (portion_sizeに基づく) の栄養価を計算 ★★★
    const calculatedStandardizedNutrition: StandardizedMealNutrition = {
        ...oneServingNutrition, // 1人前のデータを使用
        totalCalories: Math.round((oneServingNutrition.totalCalories * portion_size) * 100) / 100,
        totalNutrients: oneServingNutrition.totalNutrients.map(nutrient => ({
            ...nutrient,
            value: Math.round((nutrient.value * portion_size) * 100) / 100,
        })),
    };

    // ★★★ デバッグログ追加 (4) ★★★
    console.log('[API /meals/from-recipe] Calculated one serving nutrition:', JSON.stringify(oneServingNutrition, null, 2));
    console.log('[API /meals/from-recipe] Calculated final meal nutrition (portion adjusted):', JSON.stringify(calculatedStandardizedNutrition, null, 2));

    // ★★★ デバッグログ追加 (5) ★★★
    console.log('[API /meals/from-recipe] Inserting into meals table with portion:', portion_size);
    const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .insert({
            user_id: session.user.id,
            meal_type,
            meal_date,
            food_description: `レシピ: ${recipe.title}`,
            nutrition_data: calculatedStandardizedNutrition as unknown,
            servings: portion_size, // portion_size を保存
        })
        .select('id')
        .single();

    if (mealError) {
        // ★★★ デバッグログ追加 (6) ★★★
        console.error('[API /meals/from-recipe] Error inserting into meals:', mealError);
        throw new AppError({
            code: ErrorCode.Resource.DB_ERROR,
            message: `Failed to create meal record: ${mealError.message}`,
            userMessage: "食事記録の作成に失敗しました。",
            originalError: new Error(mealError.message),
            details: { meal_type, meal_date, recipeId: recipe_id },
            severity: 'critical'
        });
    }

    // ★★★ デバッグログ追加 (7) ★★★
    console.log('[API /meals/from-recipe] Inserting into meal_recipe_entries table...');
    const { error: relationError } = await supabase
        .from('meal_recipe_entries')
        .insert({
            meal_id: mealData.id,
            clipped_recipe_id: recipe_id,
            portion_size
        });

    if (relationError) {
        // ★★★ デバッグログ追加 (8) ★★★
        console.warn(`[API /meals/from-recipe] Failed to link meal (ID: ${mealData.id}) to recipe (ID: ${recipe_id}). DB Error:`, relationError);
    }

    // ★★★ デバッグログ追加 (9) ★★★
    console.log('[API /meals/from-recipe] Updating last_used_at for recipe...');
    const { error: updateLastError } = await supabase
        .from('clipped_recipes')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', recipe_id);

    if (updateLastError) {
        // ★★★ デバッグログ追加 (10) ★★★
        console.warn(`[API /meals/from-recipe] Failed to update last_used_at for recipe (ID: ${recipe_id}). DB Error:`, updateLastError);
    }

    // ★★★ デバッグログ追加 (11) ★★★
    console.log('[API /meals/from-recipe] Successfully processed meal from recipe.');
    return NextResponse.json({
        success: true,
        message: 'レシピから食事が記録されました',
        data: {
            id: mealData.id,
            meal_type,
            meal_date
        }
    });
}); 