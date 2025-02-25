import { z } from "zod";

// 栄養素のスキーマ定義
export const NutritionSchema = z.object({
    calories: z.number(),
    protein: z.number(),
    iron: z.number(),
    folic_acid: z.number(),
    calcium: z.number(),
    confidence_score: z.number().optional()
});

export type Nutrition = z.infer<typeof NutritionSchema>;

// 食品項目のスキーマ定義
export const FoodItemSchema = z.object({
    name: z.string(),
    quantity: z.string()
});

export type FoodItem = z.infer<typeof FoodItemSchema>;

// 検出された食品リストのスキーマ
export const DetectedFoodsSchema = z.object({
    foods: z.array(
        z.object({
            name: z.string().describe("検出された食品の名前"),
            quantity: z.string().describe("量の推定（例：一個、100g、小さじ1など）"),
            confidence: z.number().optional().describe("検出の信頼度（0-1）"),
        })
    ),
});

export type DetectedFoods = z.infer<typeof DetectedFoodsSchema>;

// 量のヒューリスティック変換
export function estimateQuantityMultiplier(
    inputQuantity: string,
    standardQuantity: string
): number {
    // 単純な重量比較（グラム単位）
    const inputGrams = extractGrams(inputQuantity);
    const standardGrams = extractGrams(standardQuantity);

    if (inputGrams > 0 && standardGrams > 0) {
        return inputGrams / standardGrams;
    }

    // 調理単位の量比較（大さじ、小さじなど）
    const inputUnit = extractCookingUnit(inputQuantity);
    const standardUnit = extractCookingUnit(standardQuantity);

    if (inputUnit && standardUnit && inputUnit.unit === standardUnit.unit) {
        return inputUnit.amount / standardUnit.amount;
    }

    // その他の場合は保守的に1を返す（標準的な量と同じと仮定）
    return 1;
}

// グラム単位を抽出
function extractGrams(quantity: string): number {
    const match = quantity.match(/(\d+(?:\.\d+)?)\s*(?:g|グラム|ｇ)/i);
    return match ? parseFloat(match[1]) : 0;
}

// 調理単位を抽出
function extractCookingUnit(quantity: string): { unit: string; amount: number } | null {
    // 大さじ、小さじ、カップなどの単位を検出
    const match = quantity.match(/(\d+(?:\.\d+)?)\s*(大さじ|小さじ|カップ|杯|個|切れ|枚)/);
    if (match) {
        return {
            amount: parseFloat(match[1]),
            unit: match[2]
        };
    }
    return null;
} 