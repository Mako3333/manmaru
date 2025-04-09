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

// 食事データの型定義
interface MealData {
    food_description?: {
        items?: any[];
        nutrition?: Partial<NutritionData>;
    };
    meal_type?: string;
    servings?: number;
    nutrition_data?: Partial<NutritionData>;
}

// 基準栄養素量（一般的な妊婦の目安）
const DEFAULT_NUTRITION_TARGETS: NutritionData = {
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
function calculateDailyNutrition(meals: MealData[]): NutritionData {
    let totalNutrition: NutritionData = {
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
function identifyDeficientNutrients(nutritionSummary: NutritionData): string[] {
    // 妊婦の1日の推奨栄養摂取量（例）
    const recommendedIntake: NutritionData = {
        calories: 2000, // kcal
        protein: 60,    // g
        iron: 27,       // mg
        folic_acid: 400, // μg
        calcium: 1000    // mg
    };

    const deficientNutrients: string[] = [];

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

// 目標栄養量の計算
function calculateTargetNutrition(userPreferences: Record<string, unknown>): NutritionData {
    // ここではデフォルト値を返すが、実際のアプリではユーザーの妊娠週や体重などから計算
    return { ...DEFAULT_NUTRITION_TARGETS };
}

// 合計栄養素の計算
function calculateTotalNutrition(nutritionLogs: Record<string, any>[]): NutritionData {
    let totalNutrition: NutritionData = {
        calories: 0,
        protein: 0,
        iron: 0,
        folic_acid: 0,
        calcium: 0
    };

    // 各ログの栄養素を合計
    nutritionLogs.forEach(log => {
        if (log.nutrition) {
            const nutrition = log.nutrition as Partial<NutritionData>;
            totalNutrition.calories += nutrition.calories || 0;
            totalNutrition.protein += nutrition.protein || 0;
            totalNutrition.iron += nutrition.iron || 0;
            totalNutrition.folic_acid += nutrition.folic_acid || 0;
            totalNutrition.calcium += nutrition.calcium || 0;
        }
    });

    return totalNutrition;
}

// 達成率の計算
function calculateAchievementRates(totalNutrition: NutritionData, targetNutrition: NutritionData): Record<string, number> {
    const rates: Record<string, number> = {};

    // 各栄養素の達成率を計算
    rates.calories = (totalNutrition.calories / targetNutrition.calories) * 100;
    rates.protein = (totalNutrition.protein / targetNutrition.protein) * 100;
    rates.iron = (totalNutrition.iron / targetNutrition.iron) * 100;
    rates.folic_acid = (totalNutrition.folic_acid / targetNutrition.folic_acid) * 100;
    rates.calcium = (totalNutrition.calcium / targetNutrition.calcium) * 100;

    return rates;
}

// 不足栄養素の計算
function calculateDeficientNutrients(achievementRates: Record<string, number>): string[] {
    const deficientNutrients: string[] = [];
    const threshold = 80; // 80%未満を不足とみなす

    // プロパティの存在を確認してからアクセス
    if (achievementRates.calories && achievementRates.calories < threshold) deficientNutrients.push('カロリー');
    if (achievementRates.protein && achievementRates.protein < threshold) deficientNutrients.push('タンパク質');
    if (achievementRates.iron && achievementRates.iron < threshold) deficientNutrients.push('鉄分');
    if (achievementRates.folic_acid && achievementRates.folic_acid < threshold) deficientNutrients.push('葉酸');
    if (achievementRates.calcium && achievementRates.calcium < threshold) deficientNutrients.push('カルシウム');

    return deficientNutrients;
} 