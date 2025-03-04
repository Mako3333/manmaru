/**
 * 基本的な栄養素データ（集計や保存に使用）
 */
export interface BasicNutritionData {
    calories: number;
    protein: number;
    iron: number;        // 鉄分 (mg)
    folic_acid: number;  // 葉酸 (μg)
    calcium: number;     // カルシウム (mg)
    vitamin_d: number;   // ビタミンD (μg)
    confidence_score?: number; // AI分析の信頼度
}

/**
 * 栄養素データの詳細インターフェース
 * 妊婦に重要な栄養素を含む
 */
export interface NutritionData extends BasicNutritionData {
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

/**
 * トライメスター別の栄養摂取目標値
 */
export interface NutritionTarget {
    id: string;
    trimester: number;   // 1, 2, 3のいずれか
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d: number;
    created_at: string;
}

/**
 * 食事ごとの栄養素データ
 */
export interface MealNutrient {
    id: string;
    meal_id: string;
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d: number;
    confidence_score: number;
    created_at: string;
}

/**
 * 栄養目標の進捗状況（ビューから取得）
 */
export interface NutritionProgress {
    user_id: string;
    trimester: number;
    meal_date: string;
    // 目標値
    target_calories: number;
    target_protein: number;
    target_iron: number;
    target_folic_acid: number;
    target_calcium: number;
    target_vitamin_d: number;
    // 実際の摂取量
    actual_calories: number;
    actual_protein: number;
    actual_iron: number;
    actual_folic_acid: number;
    actual_calcium: number;
    actual_vitamin_d: number;
    // 達成率（%）
    calories_percent: number;
    protein_percent: number;
    iron_percent: number;
    folic_acid_percent: number;
    calcium_percent: number;
    vitamin_d_percent: number;
}

/**
 * 日次の栄養ログ
 */
export interface DailyNutritionLog {
    id: string;
    user_id: string;
    log_date: string;
    nutrition_data: NutritionData;
    ai_comment: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * 食品アイテムの型定義
 */
export interface FoodItem {
    id?: string;
    name: string;
    quantity?: string;
    confidence?: number;
    category?: FoodCategory;
    notes?: string;
}

/**
 * 検出された食品リストの型定義
 */
export interface DetectedFoods {
    foods: FoodItem[];
}

/**
 * 食事タイプの定義
 */
export enum MealType {
    BREAKFAST = '朝食',
    LUNCH = '昼食',
    DINNER = '夕食',
    SNACK = '間食'
}

/**
 * 食品カテゴリーの定義
 */
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

/**
 * 栄養アドバイス
 */
export interface NutritionAdvice {
    id: string;
    user_id: string;
    advice_date: string;
    advice_type: AdviceType;
    advice_summary: string;
    advice_detail?: string;
    recommended_foods?: string[];
    is_read: boolean;
    created_at: string;
}

/**
 * 栄養アドバイスの種類
 */
export enum AdviceType {
    DAILY = 'daily',
    DEFICIENCY = 'deficiency',
    MEAL_SPECIFIC = 'meal_specific',
    WEEKLY = 'weekly'
}

// APIレスポンス用の型定義
export interface NutritionAdviceResponse {
    success: boolean;
    advice?: {
        id: string;
        content: string; // UIで表示するコンテンツ (summary or detail)
        recommended_foods?: string[];
        created_at: string;
        is_read: boolean;
    };
    error?: string;
}

// フロントエンド状態管理用の型定義
export interface AdviceState {
    loading: boolean;
    error: string | null;
    advice: {
        content: string;
        recommended_foods?: string[];
    } | null;
}