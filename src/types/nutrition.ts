/**
 * 基本的な栄養素データ（集計や保存に使用）
 */
//src\types\nutrition.ts
import { Food } from './food';

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
 * 栄養素データ型定義 - 統一された唯一の型定義
 * 基本栄養素はフラット構造で保持しつつ、拡張性も確保
 */
export interface NutritionData {
    // 基本栄養素（フラット構造でDB互換）
    calories: number;        // カロリー (kcal)
    protein: number;         // タンパク質 (g)
    iron: number;            // 鉄分 (mg)
    folic_acid: number;      // 葉酸 (μg)
    calcium: number;         // カルシウム (mg)
    vitamin_d: number;       // ビタミンD (μg)

    // 拡張カテゴリ（JSONBフィールドに保存可能）
    extended_nutrients?: {
        // 追加の主要栄養素
        fat?: number;              // 脂質 (g)
        carbohydrate?: number;     // 炭水化物 (g)
        dietary_fiber?: number;    // 食物繊維 (g)
        sugars?: number;           // 糖質 (g)
        salt?: number;             // 食塩相当量 (g)

        // ミネラル
        minerals?: {
            sodium?: number;         // ナトリウム (mg)
            potassium?: number;      // カリウム (mg)
            magnesium?: number;      // マグネシウム (mg)
            phosphorus?: number;     // リン (mg)
            zinc?: number;           // 亜鉛 (mg)
            // 将来追加ミネラル
            [key: string]: number | undefined;
        };

        // ビタミン
        vitamins?: {
            vitamin_a?: number;    // ビタミンA (μg)
            vitamin_b1?: number;   // ビタミンB1 (mg)
            vitamin_b2?: number;   // ビタミンB2 (mg)
            vitamin_b6?: number;   // ビタミンB6 (mg)
            vitamin_b12?: number;  // ビタミンB12 (μg)
            vitamin_c?: number;    // ビタミンC (mg)
            vitamin_e?: number;    // ビタミンE (mg)
            vitamin_k?: number;    // ビタミンK (μg)
            choline?: number;      // コリン (mg)
            // 将来追加ビタミン
            [key: string]: number | undefined;
        };

        // 自由に拡張可能な追加カテゴリ
        [category: string]: { [key: string]: number | undefined } | number | undefined;
    };

    // メタデータ
    confidence_score: number;      // AI分析の信頼度 (0.0-1.0)
    not_found_foods?: string[];    // 見つからなかった食品リスト

    // 互換性のためのプロパティ（旧NutrientData型互換）
    energy?: number;               // calories と同じ
    fat?: number;                  // extended_nutrients.fat と同じ
    carbohydrate?: number;         // extended_nutrients.carbohydrate と同じ 
    dietaryFiber?: number;         // extended_nutrients.dietary_fiber と同じ
    sugars?: number;               // extended_nutrients.sugars と同じ
    salt?: number;                 // extended_nutrients.salt と同じ

    // 互換性のための構造化オブジェクト
    minerals?: {
        sodium?: number;
        calcium?: number;
        iron?: number;
        potassium?: number;
        magnesium?: number;
        phosphorus?: number;
        zinc?: number;
    };

    vitamins?: {
        vitaminA?: number;
        vitaminD?: number;
        vitaminE?: number;
        vitaminK?: number;
        vitaminB1?: number;
        vitaminB2?: number;
        vitaminB6?: number;
        vitaminB12?: number;
        vitaminC?: number;
        folicAcid?: number;
    };
}

/**
 * 栄養素データの詳細インターフェース
 * 妊婦に重要な栄養素を含む
 * @deprecated 新しいNutritionData型を使用してください。
 */
export interface OldNutritionData {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d: number;
    confidence_score: number;
    notFoundFoods?: string[];
    // オプショナルプロパティ
    overall_score?: number;
    deficient_nutrients?: string[];
    sufficient_nutrients?: string[];
    daily_records?: any; // 日々の記録データ
    matchedFoods?: Array<{ original: string, matched: string, similarity: number }>;
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

/**
 * データベース内の食品アイテム
 */
export interface DatabaseFoodItem {
    name: string;
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d?: number;
    standard_quantity?: string;
    cooking_method?: string; // 追加：調理法
    category_id?: string;    // 追加：カテゴリーID
    aliases?: string[];      // 追加：別名・類義語リスト
    category?: FoodCategory; // 追加：食品カテゴリー
    id?: string;             // 追加：食品ID
    notes?: string;          // 追加：備考・メモ
}

/**
 * 栄養アドバイス
 */
export interface NutritionAdvice {
    id: number;
    user_id: string;
    advice_date: string;
    advice_type: AdviceType;
    advice_summary: string;
    advice_detail: string;
    recommended_foods: string[];
    created_at: string;
    is_read: boolean;
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

// 食品IDの先頭2桁とカテゴリのマッピング
export const FOOD_ID_CATEGORY_MAP: Record<string, FoodCategory> = {
    '01': FoodCategory.GRAINS,     // 穀物類
    '02': FoodCategory.GRAINS,     // 穀物加工品
    '03': FoodCategory.VEGETABLES, // イモ類
    '04': FoodCategory.PROTEIN,    // 豆類
    '05': FoodCategory.PROTEIN,    // 種実類
    '06': FoodCategory.VEGETABLES, // 野菜類
    '07': FoodCategory.FRUITS,     // 果物類
    '08': FoodCategory.PROTEIN,    // キノコ類
    '09': FoodCategory.VEGETABLES, // 藻類
    '10': FoodCategory.PROTEIN,    // 魚介類
    '11': FoodCategory.PROTEIN,    // 肉類
    '12': FoodCategory.PROTEIN,    // 卵類
    '13': FoodCategory.DAIRY,      // 乳類
    '14': FoodCategory.SEASONINGS, // 油脂類
    '15': FoodCategory.SEASONINGS, // 菓子類
    '16': FoodCategory.SEASONINGS, // 嗜好飲料
    '17': FoodCategory.SEASONINGS, // 調味料・香辛料
    '18': FoodCategory.OTHER       // 調理加工食品類
};

/**
 * 栄養素の単位を定義
 */
export type NutrientUnit = 'g' | 'mg' | 'mcg' | 'kcal' | 'IU' | '%';

/**
 * 個別の栄養素データ
 */
export interface Nutrient {
    name: string;          // 栄養素名（例: たんぱく質、脂質）
    value: number;         // 数値
    unit: NutrientUnit;    // 単位
    percentDailyValue?: number; // 1日の推奨摂取量に対する割合（任意）
}

/**
 * 食品アイテムの栄養データ
 */
export interface FoodItemNutrition {
    calories: number;      // カロリー（kcal）
    nutrients: Nutrient[]; // 栄養素のリスト
    servingSize: {
        value: number;       // 量
        unit: string;        // 単位（例: g, ml, 個）
    };
}

/**
 * 食事全体の標準化された栄養データ
 */
export interface StandardizedMealNutrition {
    totalCalories: number;         // 総カロリー
    totalNutrients: Nutrient[];    // 総栄養素
    foodItems: {
        id: string;                  // 食品ID
        name: string;                // 食品名
        nutrition: FoodItemNutrition; // 食品ごとの栄養データ
        amount: number;              // 摂取量
        unit: string;                // 単位
    }[];
    // 妊婦向け特別データ
    pregnancySpecific?: {
        folatePercentage: number;    // 葉酸摂取割合
        ironPercentage: number;      // 鉄分摂取割合
        calciumPercentage: number;   // カルシウム摂取割合
    };
}

/**
 * 食事記録の標準化されたデータ型
 */
export interface StandardizedMealData {
    user_id: string;
    meal_date: string;           // ISO8601形式の日付文字列
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    meal_items: {
        name: string;
        amount: number;
        unit: string;
        image_url?: string;
    }[];
    nutrition_data: StandardizedMealNutrition; // 標準化された栄養データ
    image_url?: string;           // 食事画像のURL（任意）
    notes?: string;               // メモ（任意）
}

import { FoodQuantity } from './food';

/**
 * 栄養計算の結果を表す型
 */
export interface NutritionCalculationResult {
    // 栄養素データ
    nutrients: NutritionData;

    // 計算の信頼性情報
    reliability: {
        confidence: number;       // 全体の確信度 (0.0-1.0)
        balanceScore: number;     // 栄養バランススコア (0-100)
        completeness: number;     // データの完全性 (0.0-1.0)
    };

    // 食品ごとのマッチング詳細
    matchResults: Array<FoodMatchResult>;
}

/**
 * 栄養素表示用のコンポーネントデータ
 */
export interface NutrientDisplayData {
    name: string;          // 表示名（例: エネルギー、タンパク質）
    amount: number;        // 量
    unit: string;          // 単位（例: kcal, g, mg, μg）
    percentOfDaily?: number; // 1日の推奨摂取量に対する割合
}

/**
 * 栄養素名の表示名マッピング
 */
export const nutrientDisplayNameMap: Record<string, string> = {
    'calories': 'エネルギー',
    'protein': 'タンパク質',
    'iron': '鉄分',
    'folic_acid': '葉酸',
    'calcium': 'カルシウム',
    'vitamin_d': 'ビタミンD',
    'dietary_fiber': '食物繊維',
    'sugars': '糖質',
    'salt': '食塩相当量',
    'sodium': 'ナトリウム',
    'potassium': 'カリウム',
    'magnesium': 'マグネシウム',
    'phosphorus': 'リン',
    'zinc': '亜鉛',
    'vitamin_a': 'ビタミンA',
    'vitamin_b1': 'ビタミンB1',
    'vitamin_b2': 'ビタミンB2',
    'vitamin_b6': 'ビタミンB6',
    'vitamin_b12': 'ビタミンB12',
    'vitamin_c': 'ビタミンC',
    'vitamin_e': 'ビタミンE',
    'vitamin_k': 'ビタミンK',
    'choline': 'コリン',
    // 既存の栄養素マッピングを維持
    ...nutrientNameMap
};

/**
 * 栄養素の単位マッピング
 */
export const nutrientUnitMap: Record<string, string> = {
    'calories': 'kcal',
    'protein': 'g',
    'iron': 'mg',
    'folic_acid': 'μg',
    'calcium': 'mg',
    'vitamin_d': 'μg',
    'dietary_fiber': 'g',
    'sugars': 'g',
    'salt': 'g',
    'sodium': 'mg',
    'potassium': 'mg',
    'magnesium': 'mg',
    'phosphorus': 'mg',
    'zinc': 'mg',
    'vitamin_a': 'μg',
    'vitamin_b1': 'mg',
    'vitamin_b2': 'mg',
    'vitamin_b6': 'mg',
    'vitamin_b12': 'μg',
    'vitamin_c': 'mg',
    'vitamin_e': 'mg',
    'vitamin_k': 'μg',
    'choline': 'mg'
};

/**
 * JSONデータをNutritionData型に変換（DBから取得時）
 */
export function parseNutritionFromJson(jsonData: any): NutritionData {
    return {
        calories: jsonData.calories || 0,
        protein: jsonData.protein || 0,
        iron: jsonData.iron || 0,
        folic_acid: jsonData.folic_acid || 0,
        calcium: jsonData.calcium || 0,
        vitamin_d: jsonData.vitamin_d || 0,
        extended_nutrients: jsonData.extended_nutrients || {},
        confidence_score: jsonData.confidence_score || 0,
        not_found_foods: jsonData.not_found_foods || []
    };
}

/**
 * NutritionDataをJSON形式に変換（DB保存時）
 */
export function serializeNutritionToJson(data: NutritionData): any {
    // DBスキーマに合わせた構造に変換
    return {
        calories: data.calories,
        protein: data.protein,
        iron: data.iron,
        folic_acid: data.folic_acid,
        calcium: data.calcium,
        vitamin_d: data.vitamin_d,
        extended_nutrients: data.extended_nutrients || {},
        confidence_score: data.confidence_score,
        not_found_foods: data.not_found_foods || []
    };
}

/**
 * NutritionDataからUIコンポーネント用の配列に変換
 */
export function convertToNutrientDisplayData(
    data: NutritionData,
    targets?: Record<string, number>
): NutrientDisplayData[] {
    const result: NutrientDisplayData[] = [
        // 基本栄養素
        {
            name: nutrientDisplayNameMap['calories'] || 'エネルギー',
            amount: data.calories,
            unit: nutrientUnitMap['calories'] || 'kcal',
            percentOfDaily: targets?.calories ? data.calories / targets.calories * 100 : undefined
        },
        {
            name: nutrientDisplayNameMap['protein'] || 'タンパク質',
            amount: data.protein,
            unit: nutrientUnitMap['protein'] || 'g',
            percentOfDaily: targets?.protein ? data.protein / targets.protein * 100 : undefined
        },
        {
            name: nutrientDisplayNameMap['iron'] || '鉄分',
            amount: data.iron,
            unit: nutrientUnitMap['iron'] || 'mg',
            percentOfDaily: targets?.iron ? data.iron / targets.iron * 100 : undefined
        },
        {
            name: nutrientDisplayNameMap['folic_acid'] || '葉酸',
            amount: data.folic_acid,
            unit: nutrientUnitMap['folic_acid'] || 'μg',
            percentOfDaily: targets?.folic_acid ? data.folic_acid / targets.folic_acid * 100 : undefined
        },
        {
            name: nutrientDisplayNameMap['calcium'] || 'カルシウム',
            amount: data.calcium,
            unit: nutrientUnitMap['calcium'] || 'mg',
            percentOfDaily: targets?.calcium ? data.calcium / targets.calcium * 100 : undefined
        },
        {
            name: nutrientDisplayNameMap['vitamin_d'] || 'ビタミンD',
            amount: data.vitamin_d,
            unit: nutrientUnitMap['vitamin_d'] || 'μg',
            percentOfDaily: targets?.vitamin_d ? data.vitamin_d / targets.vitamin_d * 100 : undefined
        }
    ];

    // 拡張栄養素の変換
    if (data.extended_nutrients) {
        // 個別栄養素の追加
        const mainNutrients = ['dietary_fiber', 'sugars', 'salt'];
        for (const nutrient of mainNutrients) {
            const value = (data.extended_nutrients as any)[nutrient];
            if (value !== undefined) {
                result.push({
                    name: nutrientDisplayNameMap[nutrient] || nutrient,
                    amount: value,
                    unit: nutrientUnitMap[nutrient] || 'g',
                    percentOfDaily: targets?.[nutrient] ?
                        value / targets[nutrient] * 100 : undefined
                });
            }
        }

        // カテゴリ内栄養素の追加（ミネラル、ビタミンなど）
        for (const [category, nutrients] of Object.entries(data.extended_nutrients)) {
            if (typeof nutrients === 'object' && nutrients !== null) {
                for (const [key, value] of Object.entries(nutrients as object)) {
                    if (typeof value === 'number') {
                        const fullKey = `${category}.${key}`;
                        const displayName = nutrientDisplayNameMap[key] || key;
                        const unit = nutrientUnitMap[key] || 'mg';

                        result.push({
                            name: displayName,
                            amount: value,
                            unit: unit,
                            percentOfDaily: targets?.[key] ? value / targets[key] * 100 : undefined
                        });
                    }
                }
            }
        }
    }

    return result;
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