/**
 * 基本的な栄養素データ（集計や保存に使用）
 */
//src\types\nutrition.ts
import { Food, FoodMatchResult, FoodQuantity } from './food';

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

    // 互換性のためのプロパティ（旧NutrientData型互換） -> 削除または修正検討
    // 以下のプロパティは NutritionData (旧型) との互換性のために一時的に残されています。
    // StandardizedMealNutrition への完全移行後は削除される予定です。
    // 新規コードでは使用しないでください。
    energy?: number;               // calories と同じ
    fat?: number;                  // extended_nutrients.fat と同じ
    carbohydrate?: number;         // extended_nutrients.carbohydrate と同じ 
    dietaryFiber?: number;         // extended_nutrients.dietary_fiber と同じ
    sugars?: number;               // extended_nutrients.sugars と同じ
    salt?: number;                 // extended_nutrients.salt と同じ

    // 互換性のための構造化オブジェクト -> 削除または修正検討
    // これらも旧型との互換性のための一時的なものです。
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
 * 栄養目標の進捗状況（ビューから取得）
 */
export interface NutritionProgress {
    user_id: string;
    // trimester: number; // 削除
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
 * 標準化された食事の栄養情報。
 * このインターフェースは、アプリケーション全体で一貫して使用される栄養データの標準形式を定義します。
 * 複数の食品アイテムから構成される一食分の総栄養価、各食品の詳細な栄養情報、
 * 妊婦向けの特記事項、およびデータの信頼性に関する情報を含みます。
 */
export interface StandardizedMealNutrition {
    /**
     * 食事全体の総カロリー (kcal)。
     * foodItems 配列内の各食品のカロリーを合計した値。
     */
    totalCalories: number;

    /**
     * 食事全体の総栄養素リスト。
     * Nutrient インターフェースの配列で、各要素が特定の栄養素（名前、値、単位）を表します。
     * @see Nutrient
     */
    totalNutrients: Nutrient[];

    /**
     * 食事を構成する各食品アイテムの詳細リスト。
     */
    foodItems: {
        /**
         * 食品データベースにおける一意の識別子。
         */
        id: string;
        /**
         * 食品名（例: 「鶏むね肉」、「ほうれん草」）。
         */
        name: string;
        /**
         * この食品アイテム単体の栄養情報。
         * @see FoodItemNutrition
         */
        nutrition: FoodItemNutrition;
        /**
         * 摂取量（数値）。単位は `unit` プロパティで指定されます。
         */
        amount: number;
        /**
         * 摂取量の単位（例: "g", "ml", "個"）。
         */
        unit: string;
        /**
         * この食品アイテムの栄養価分析に対する信頼度スコア (0.0 - 1.0)。
         * AIによる分析やユーザー入力の曖昧さなどを反映します（オプショナル）。
         */
        confidence?: number;
    }[];

    /**
     * 妊婦向けの特定の栄養素に関する追加情報（オプショナル）。
     * 妊娠期間に応じた推奨摂取量に対する充足率などを格納します。
     */
    pregnancySpecific?: {
        /**
         * 葉酸の推奨摂取量に対する充足率 (%)。
         */
        folatePercentage: number;
        /**
         * 鉄分の推奨摂取量に対する充足率 (%)。
         */
        ironPercentage: number;
        /**
         * カルシウムの推奨摂取量に対する充足率 (%)。
         */
        calciumPercentage: number;
    };

    /**
     * この栄養データ全体の信頼性に関する情報。
     */
    reliability: {
        /**
         * 算出された栄養価全体の確信度 (0.0 - 1.0)。
         * 各 foodItems の confidence や、分析手法の不確実性を総合的に評価した値。
         */
        confidence: number;
        /**
         * 栄養バランスの評価スコア (0 - 100)。
         * 主要栄養素（PFCバランスなど）や推奨される栄養パターンに基づいて算出（オプショナル）。
         */
        balanceScore?: number;
        /**
         * 必須栄養素データがどの程度網羅されているかを示す完全性スコア (0.0 - 1.0)。
         * 例えば、必須アミノ酸や特定のビタミン・ミネラルのデータが不足している場合に低くなる（オプショナル）。
         */
        completeness?: number;
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

/**
 * 栄養計算結果の型定義
 */
export interface NutritionCalculationResult {
    nutrition: StandardizedMealNutrition;
    matchResults: any[]; // 食品マッチング結果
    reliability: {
        confidence: number;      // 全体の確信度 (0.0-1.0)
        balanceScore?: number;   // 栄養バランススコア (0-100) (オプショナルに変更)
        completeness?: number;   // データの完全性 (0.0-1.0) (オプショナルに変更)
    };
}

/**
 * 表示用の栄養素データ
 */
export interface NutrientDisplayData {
    name: string;                        // 栄養素名（日本語表示用）
    amount: number;                      // 量
    unit: string;                        // 単位 (g, mg, μg など)
    percentOfDaily: number | undefined;   // 1日の推奨摂取量に対する割合 (%)
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
 * 注意: これらの関数は src/lib/nutrition/nutrition-type-utils.ts に移動しました。
 * 新規開発では、そちらの実装を使用してください。
 * 
 * - parseNutritionFromJson
 * - serializeNutritionToJson
 * - convertToNutrientDisplayData
 */

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
 * 不足している栄養素の詳細情報
 */
export interface NutrientDeficiency {
    nutrientCode: string;      // 内部コード (例: 'iron')
    fulfillmentRatio: number;  // 充足率 (0.0-1.0)
    currentValue: number;      // 現在値
    targetValue: number;       // 目標値
}

/**
 * 栄養素計算結果
 */
export interface NutritionCalculationResult {
    nutrition: StandardizedMealNutrition;
    matchResults: any[]; // 食品マッチング結果
    reliability: {
        confidence: number;      // 全体の確信度 (0.0-1.0)
        balanceScore?: number;   // 栄養バランススコア (0-100) (オプショナルに変更)
        completeness?: number;   // データの完全性 (0.0-1.0) (オプショナルに変更)
    };
}