import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

// 栄養素データの型定義
interface NutritionData {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
}

// 仮の食品項目型定義 (any[] の代わり)
interface FoodItem {
    name: string;
    quantity: number;
    unit: string;
    // 必要に応じて他のプロパティを追加
}

// 食事データの型定義
interface MealData {
    food_description?: {
        items?: FoodItem[]; // any[] を FoodItem[] に変更
        nutrition?: Partial<NutritionData>;
    };
    meal_type?: string;
    servings?: number;
    nutrition_data?: Partial<NutritionData>; // これは meals テーブルのカラム？ food_description.nutrition と混同しないように注意
}

// 基準栄養素量（一般的な妊婦の目安）
// const DEFAULT_NUTRITION_TARGETS: NutritionData = {
//     calories: 2200,
//     protein: 80,
//     iron: 10,
//     folic_acid: 400,
//     calcium: 800
// };

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式の日付

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!
        );

        // 1. 今日の食事データを取得
        const { data: mealsData, error: mealsError } = await supabase
            .from('meals')
            .select('food_description, meal_type, servings')
            .eq('user_id', userId)
            .eq('meal_date', today);

        if (mealsError) {
            throw mealsError;
        }

        // 2. 栄養摂取を計算
        const nutritionSummary = calculateDailyNutrition(mealsData || []);

        // 3. 不足している栄養素を特定
        const deficientNutrients = identifyDeficientNutrients(nutritionSummary);

        // 4. 栄養ログを更新または作成 (upsert を使用)
        const nutritionLogData = {
            user_id: userId,
            log_date: today,
            nutrition_data: {
                summary: nutritionSummary,
                deficient_nutrients: deficientNutrients,
                meals_count: mealsData?.length || 0
            }
        };

        const { error: upsertError } = await supabase
            .from('daily_nutrition_logs')
            .upsert(nutritionLogData, {
                onConflict: 'user_id, log_date' // user_id と log_date が重複した場合に update
            });

        if (upsertError) {
            console.error('Supabase upsert エラー:', upsertError);
            throw upsertError;
        }

        return NextResponse.json({
            success: true,
            nutrition_summary: nutritionSummary,
            deficient_nutrients: deficientNutrients
        });
    } catch (error) {
        console.error('Error updating nutrition log:', error);
        return NextResponse.json(
            { error: '栄養ログの更新に失敗しました' },
            { status: 500 }
        );
    }
}

// 日次栄養摂取量の計算 (reduce を使用し、サービング計算を修正)
function calculateDailyNutrition(meals: MealData[]): NutritionData {
    const initialNutrition: NutritionData = {
        calories: 0, protein: 0, iron: 0, folic_acid: 0, calcium: 0
    };

    return meals.reduce((total, meal) => {
        const servings = meal.servings || 1;
        const mealNutrition = meal.food_description?.nutrition;

        if (mealNutrition) {
            // mealNutrition は食品全体、servings は摂取数と仮定し、乗算する
            // (以前の / servings は誤りの可能性)
            total.calories += (mealNutrition.calories || 0) * servings;
            total.protein += (mealNutrition.protein || 0) * servings;
            total.iron += (mealNutrition.iron || 0) * servings;
            total.folic_acid += (mealNutrition.folic_acid || 0) * servings;
            total.calcium += (mealNutrition.calcium || 0) * servings;
        }
        return total;
    }, initialNutrition);
}

// 不足栄養素の特定 (閾値を明確化)
function identifyDeficientNutrients(nutritionSummary: NutritionData): string[] {
    // 妊婦の1日の推奨栄養摂取量（例）- 必要に応じてユーザーデータから取得
    const recommendedIntake: NutritionData = {
        calories: 2000, protein: 60, iron: 27, folic_acid: 400, calcium: 1000
    };
    const DEFICIENCY_THRESHOLD = 0.8; // 80%未満を不足と判定

    const deficientNutrients: string[] = [];

    if (nutritionSummary.calories < recommendedIntake.calories * DEFICIENCY_THRESHOLD) {
        deficientNutrients.push('カロリー');
    }
    if (nutritionSummary.protein < recommendedIntake.protein * DEFICIENCY_THRESHOLD) {
        deficientNutrients.push('タンパク質');
    }
    if (nutritionSummary.iron < recommendedIntake.iron * DEFICIENCY_THRESHOLD) {
        deficientNutrients.push('鉄分');
    }
    if (nutritionSummary.folic_acid < recommendedIntake.folic_acid * DEFICIENCY_THRESHOLD) {
        deficientNutrients.push('葉酸');
    }
    if (nutritionSummary.calcium < recommendedIntake.calcium * DEFICIENCY_THRESHOLD) {
        deficientNutrients.push('カルシウム');
    }

    return deficientNutrients;
} 