/**
 * 基本食品データ
 */
export interface BasicFood {
    id: string;           // 英語ベースの識別子 (例: "rice-white")
    name: string;         // 表示名 (例: "白米")
    category: string;     // カテゴリ (例: "穀類-米")
    aliases: string[];    // 別名リスト (例: ["精白米", "ごはん"])
    standard_quantity: string; // 標準量 (例: "100g")
}

/**
 * 食品の栄養素データ
 */
export interface FoodNutrition {
    calories: number;     // カロリー (kcal)
    protein: number;      // タンパク質 (g)
    iron: number;         // 鉄分 (mg)
    folic_acid: number;   // 葉酸 (μg)
    calcium: number;      // カルシウム (mg)
    vitamin_d: number;    // ビタミンD (μg)
    confidence?: number;  // 栄養データの信頼度
}

/**
 * 完全な食品データ
 */
export interface Food extends BasicFood, FoodNutrition { }

/**
 * 食品量データ
 */
export interface FoodQuantity {
    value: number;        // 数値
    unit: string;         // 単位 (例: "g", "個", "大さじ")
}

/**
 * 食事に含まれる食品アイテム
 */
export interface MealFoodItem {
    foodId: string;       // 食品ID
    food: Food;           // 食品データ
    quantity: FoodQuantity; // 量
    confidence: number;   // 確信度スコア (0.0-1.0)
    originalInput?: string; // 元の入力文字列
}

/**
 * マッチング結果データ
 */
export interface FoodMatchResult {
    food: Food;           // マッチした食品
    matchedFood: Food;    // マッチした食品（互換性維持用）
    similarity: number;   // 類似度スコア (0.0-1.0)
    confidence: number;   // 確信度スコア (0.0-1.0)
    originalInput: string; // 元の入力文字列
    inputName: string;    // 入力された食品名
}

/**
 * 確信度レベル定義
 */
export enum ConfidenceLevel {
    HIGH = 'high',        // 高確信度 (0.85以上)
    MEDIUM = 'medium',    // 中確信度 (0.7-0.85)
    LOW = 'low',          // 低確信度 (0.5-0.7)
    VERY_LOW = 'very_low' // 非常に低い確信度 (0.35-0.5)
} 