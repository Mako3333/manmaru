// 栄養データの型定義
export interface NutritionData {
    overall_score: number;
    deficient_nutrients: string[];
    sufficient_nutrients: string[];
    daily_records: {
        date: string;
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
        score: number;
    }[];
}

export interface NutrientSummary {
    iron: number;
    calcium: number;
    protein: number;
    calories: number;
    folic_acid: number;
    [key: string]: number; // インデックスシグネチャを追加
}

// 日次栄養ログの型定義（実際のデータ構造に合わせて修正）
export interface DailyNutritionLog {
    id: string;
    user_id: string;
    log_date: string;
    nutrition_data: {
        summary: NutrientSummary;
        meals_count: number;
        deficient_nutrients: string[];
    };
    ai_comment?: string;
    created_at: string;
    updated_at: string;
}

// 栄養素名の日本語マッピング
export const nutrientNameMap: Record<string, string> = {
    'iron': '鉄分',
    'folic_acid': '葉酸',
    'calcium': 'カルシウム',
    'protein': 'タンパク質',
    'calories': 'カロリー'
}; 