import { format } from 'date-fns';
import { AppError, ErrorCode } from "@/lib/error";
import { SupabaseClient } from '@supabase/supabase-js';

// 過去の栄養データレコードのインターフェース
interface PastNutritionRecord {
    date: string;
    overallScore: number;
    nutrients: {
        [key: string]: { percentage: number };
        calories: { percentage: number };
        protein: { percentage: number };
        iron: { percentage: number };
        folic_acid: { percentage: number };
        calcium: { percentage: number };
        vitamin_d: { percentage: number };
    };
}

// getPastNutritionData から返されるレコードの型 (select に基づく)
interface GoalProgRecord {
    meal_date: string;
    calories_percent: number | null;
    protein_percent: number | null;
    iron_percent: number | null;
    folic_acid_percent: number | null;
    calcium_percent: number | null;
    vitamin_d_percent: number | null;
}

// 総合スコア計算関数
function calculateOverallScore(record: unknown): number {
    if (typeof record !== 'object' || record === null) {
        return 0;
    }
    // GoalProgRecord の構造を期待してプロパティにアクセス
    const percentages = [
        (record as GoalProgRecord).calories_percent,
        (record as GoalProgRecord).protein_percent,
        (record as GoalProgRecord).iron_percent,
        (record as GoalProgRecord).folic_acid_percent,
        (record as GoalProgRecord).calcium_percent,
        (record as GoalProgRecord).vitamin_d_percent
    ]
        // null や undefined を除外し、数値のみをフィルタリング
        .filter((val): val is number => typeof val === 'number');

    return percentages.length > 0 ? Math.round(percentages.reduce((sum, val) => sum + val, 0) / percentages.length) : 0;
}

// 過去の栄養データを取得する関数
export async function getPastNutritionData(supabase: SupabaseClient, userId: string, days: number = 3): Promise<PastNutritionRecord[]> {
    const today = new Date();
    const pastDates = [];
    for (let i = 1; i <= days; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        pastDates.push(format(date, 'yyyy-MM-dd'));
    }
    console.log('過去の栄養データを取得: 対象日付', pastDates);

    const { data, error } = await supabase
        .from('nutrition_goal_prog')
        .select<string, GoalProgRecord>(`
            meal_date,
            calories_percent,
            protein_percent,
            iron_percent,
            folic_acid_percent,
            calcium_percent,
            vitamin_d_percent
        `)
        .eq('user_id', userId)
        .in('meal_date', pastDates)
        .order('meal_date', { ascending: false });

    if (error) {
        console.error('過去の栄養データ取得エラー:', error);
        throw new AppError({ code: ErrorCode.Base.API_ERROR, message: '過去の栄養データの取得に失敗しました', originalError: error });
    }
    if (!data || data.length === 0) {
        console.log('過去の栄養データが見つかりません');
        return [];
    }
    console.log(`取得した過去の栄養データ: ${data.length}件`);

    return data.map((record: GoalProgRecord): PastNutritionRecord => ({
        date: record.meal_date,
        overallScore: calculateOverallScore(record),
        nutrients: {
            calories: { percentage: record.calories_percent ?? 0 },
            protein: { percentage: record.protein_percent ?? 0 },
            iron: { percentage: record.iron_percent ?? 0 },
            folic_acid: { percentage: record.folic_acid_percent ?? 0 },
            calcium: { percentage: record.calcium_percent ?? 0 },
            vitamin_d: { percentage: record.vitamin_d_percent ?? 0 }
        }
    }));
}

// 不足栄養素を特定する関数
const nutrientNameMap: { [key: string]: string } = {
    calories: 'カロリー',
    protein: 'タンパク質',
    iron: '鉄分',
    folic_acid: '葉酸',
    calcium: 'カルシウム',
    vitamin_d: 'ビタミンD'
};

export function identifyDeficientNutrients(pastData: PastNutritionRecord[]): string[] {
    if (!pastData || pastData.length === 0) return [];

    const nutrientSums: { [key: string]: number } = {};
    const nutrientCounts: { [key: string]: number } = {};

    pastData.forEach(day => {
        if (day.nutrients) {
            Object.keys(day.nutrients).forEach(key => {
                const percentage = day.nutrients[key]?.percentage;
                if (typeof percentage === 'number') {
                    nutrientSums[key] = (nutrientSums[key] || 0) + percentage;
                    nutrientCounts[key] = (nutrientCounts[key] || 0) + 1;
                }
            });
        }
    });

    const deficientKeys: string[] = [];
    const threshold = 70; // 70%未満を不足と判定

    Object.keys(nutrientSums).forEach(key => {
        const count = nutrientCounts[key] || 0;
        if (count > 0) {
            const sum = nutrientSums[key] || 0;
            const avg = sum / count;
            if (avg < threshold) {
                deficientKeys.push(key);
            }
        }
    });

    return deficientKeys.map(key => nutrientNameMap[key] || key); // 日本語名に変換
} 