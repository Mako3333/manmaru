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
    [key: string]: number; // インデックスシグネチャ
}

// 日次栄養ログの型定義
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

// 食品アイテムの型定義
export interface FoodItem {
    id?: string;
    name: string;
    quantity?: string;
    confidence?: number;
    category?: FoodCategory;
    notes?: string;
}

// 検出された食品リストの型定義
export interface DetectedFoods {
    foods: FoodItem[];
}

// 食事タイプの定義
export enum MealType {
    BREAKFAST = '朝食',
    LUNCH = '昼食',
    DINNER = '夕食',
    SNACK = '間食'
}

// 食品カテゴリーの定義
export enum FoodCategory {
    GRAINS = '穀物',
    VEGETABLES = '野菜',
    FRUITS = '果物',
    PROTEIN = 'たんぱく質',
    DAIRY = '乳製品',
    SEASONINGS = '調味料',
    OTHER = 'その他'
}

// 量の単位の定義
export const QuantityUnit = {
    TABLESPOONS: '大さじ',
    TEASPOONS: '小さじ',
    BOWLS: '杯',
    PIECES: '個',
    GRAMS: 'g',
    MILLILITERS: 'ml',
    SERVINGS: '人前'
} as const;

// 量の単位の型
export type QuantityUnitType = typeof QuantityUnit[keyof typeof QuantityUnit];

// 栄養素名の日本語マッピング
export const nutrientNameMap: Record<string, string> = {
    'iron': '鉄分',
    'folic_acid': '葉酸',
    'calcium': 'カルシウム',
    'protein': 'タンパク質',
    'calories': 'カロリー'
};

// 栄養素の基準値
export const NUTRITION_STANDARDS = {
    CALORIES: {
        MIN: 1800,
        MAX: 2200
    },
    PROTEIN: {
        MIN: 60,
        MAX: 80
    },
    IRON: {
        MIN: 20,
        MAX: 30
    },
    FOLIC_ACID: {
        MIN: 400,
        MAX: 600
    },
    CALCIUM: {
        MIN: 800,
        MAX: 1000
    }
} as const;

// 量の変換テーブル
export const QUANTITY_CONVERSIONS: Record<QuantityUnitType, number> = {
    [QuantityUnit.TABLESPOONS]: 15,  // 大さじ1 = 15g
    [QuantityUnit.TEASPOONS]: 5,     // 小さじ1 = 5g
    [QuantityUnit.BOWLS]: 150,       // 茶碗1杯 = 150g
    [QuantityUnit.PIECES]: 100,      // 1個 = 100g（デフォルト）
    [QuantityUnit.GRAMS]: 1,         // 1g = 1g
    [QuantityUnit.MILLILITERS]: 1,   // 1ml ≈ 1g と仮定
    [QuantityUnit.SERVINGS]: 200     // 1人前 = 200g と仮定
};

// データベースアイテムの型定義
export interface DatabaseFoodItem {
    name: string;
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    standard_quantity: string;
    category?: FoodCategory;
    aliases?: string[];
    notes?: string;
}