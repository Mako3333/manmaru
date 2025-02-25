import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

// 基準栄養素量（一般的な妊婦の目安）
const DEFAULT_NUTRITION_TARGETS = {
    calories: 2200,
    protein: 80,
    iron: 10,
    folic_acid: 400,
    calcium: 800
};

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

        // 4. 栄養ログを更新または作成
        const { data: existingLog, error: logCheckError } = await supabase
            .from('daily_nutrition_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('log_date', today)
            .maybeSingle();

        if (logCheckError) {
            throw logCheckError;
        }

        const nutritionData = {
            summary: nutritionSummary,
            deficient_nutrients: deficientNutrients,
            meals_count: mealsData?.length || 0
        };

        let updateResult;

        if (existingLog) {
            // 既存のログを更新
            updateResult = await supabase
                .from('daily_nutrition_logs')
                .update({ nutrition_data: nutritionData })
                .eq('id', existingLog.id);
        } else {
            // 新しいログを作成
            updateResult = await supabase
                .from('daily_nutrition_logs')
                .insert({
                    user_id: userId,
                    log_date: today,
                    nutrition_data: nutritionData
                });
        }

        if (updateResult.error) {
            throw updateResult.error;
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

// 日次栄養摂取量の計算
function calculateDailyNutrition(meals: any[]) {
    let totalNutrition = {
        calories: 0,
        protein: 0,
        iron: 0,
        folic_acid: 0,
        calcium: 0
    };

    for (const meal of meals) {
        const foodItems = meal.food_description?.items || [];
        const servings = meal.servings || 1;

        // 各食品の栄養素を合計
        // 本来はここで詳細な栄養計算をするが、MVPでは簡易実装
        // 実際のアプリでは、meal.food_descriptionに含まれる栄養情報を使用

        // 例えば、meal.food_description.nutritionが存在する場合
        if (meal.food_description?.nutrition) {
            const mealNutrition = meal.food_description.nutrition;
            // サービングサイズで調整
            totalNutrition.calories += (mealNutrition.calories || 0) / servings;
            totalNutrition.protein += (mealNutrition.protein || 0) / servings;
            totalNutrition.iron += (mealNutrition.iron || 0) / servings;
            totalNutrition.folic_acid += (mealNutrition.folic_acid || 0) / servings;
            totalNutrition.calcium += (mealNutrition.calcium || 0) / servings;
        }
    }

    return totalNutrition;
}

// 不足栄養素の特定
function identifyDeficientNutrients(nutritionSummary: any) {
    // 妊婦の1日の推奨栄養摂取量（例）
    const recommendedIntake = {
        calories: 2000, // kcal
        protein: 60,    // g
        iron: 27,       // mg
        folic_acid: 400, // μg
        calcium: 1000    // mg
    };

    const deficientNutrients = [];

    // 各栄養素の充足率をチェック
    if (nutritionSummary.calories < recommendedIntake.calories * 0.8) {
        deficientNutrients.push('カロリー');
    }

    if (nutritionSummary.protein < recommendedIntake.protein * 0.8) {
        deficientNutrients.push('タンパク質');
    }

    if (nutritionSummary.iron < recommendedIntake.iron * 0.8) {
        deficientNutrients.push('鉄分');
    }

    if (nutritionSummary.folic_acid < recommendedIntake.folic_acid * 0.8) {
        deficientNutrients.push('葉酸');
    }

    if (nutritionSummary.calcium < recommendedIntake.calcium * 0.8) {
        deficientNutrients.push('カルシウム');
    }

    return deficientNutrients;
}

// プロフィールから目標栄養素量を計算
function calculateTargetNutrition(profile: any) {
    // MVPではシンプルな実装
    // 将来的には年齢、妊娠週数、身長、体重などから詳細に計算
    return { ...DEFAULT_NUTRITION_TARGETS };
}

// 食事記録から総栄養素量を計算
function calculateTotalNutrition(meals: any[]) {
    const total = {
        calories: 0,
        protein: 0,
        iron: 0,
        folic_acid: 0,
        calcium: 0
    };

    meals.forEach(meal => {
        if (meal.nutrition_data) {
            // 何人前で割るか計算
            const divider = meal.servings || 1;

            total.calories += (meal.nutrition_data.calories || 0) / divider;
            total.protein += (meal.nutrition_data.protein || 0) / divider;
            total.iron += (meal.nutrition_data.iron || 0) / divider;
            total.folic_acid += (meal.nutrition_data.folic_acid || 0) / divider;
            total.calcium += (meal.nutrition_data.calcium || 0) / divider;
        }
    });

    // 値を丸める
    return {
        calories: Math.round(total.calories),
        protein: Math.round(total.protein * 10) / 10,
        iron: Math.round(total.iron * 10) / 10,
        folic_acid: Math.round(total.folic_acid),
        calcium: Math.round(total.calcium)
    };
}

// 達成率の計算
function calculateAchievementRates(total: any, target: any) {
    return {
        calories: Math.round((total.calories / target.calories) * 100),
        protein: Math.round((total.protein / target.protein) * 100),
        iron: Math.round((total.iron / target.iron) * 100),
        folic_acid: Math.round((total.folic_acid / target.folic_acid) * 100),
        calcium: Math.round((total.calcium / target.calcium) * 100)
    };
}

// 不足栄養素の計算
function calculateDeficientNutrients(achievementRates: any) {
    const deficientNutrients = [];
    const THRESHOLD = 90; // 90%未満を不足とみなす

    if (achievementRates.iron < THRESHOLD) deficientNutrients.push('鉄分');
    if (achievementRates.folic_acid < THRESHOLD) deficientNutrients.push('葉酸');
    if (achievementRates.calcium < THRESHOLD) deficientNutrients.push('カルシウム');
    if (achievementRates.protein < THRESHOLD) deficientNutrients.push('タンパク質');

    return deficientNutrients;
} 