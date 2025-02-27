import { NextResponse } from "next/server";
import { z } from "zod";
import {
    FoodItemSchema,
    NutritionSchema,
    estimateQuantityMultiplier
} from "@/lib/nutrition/nutritionUtils";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// リクエストの型定義
const RequestSchema = z.object({
    foods: z.array(FoodItemSchema)
});

// 栄養データベースの型定義
interface NutritionDbItem {
    name: string;
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    standard_quantity: string;
}

// 栄養素計算APIエンドポイント
export async function POST(req: Request) {
    try {
        // リクエストデータの検証
        const body = await req.json();
        const validatedData = RequestSchema.parse(body);
        const { foods } = validatedData;

        // 食品データのバリデーション
        if (!foods || foods.length === 0) {
            return Response.json({ error: '食品データが必要です' }, { status: 400 });
        }

        // 栄養計算の実行
        const nutritionData = await calculateNutrition(foods);

        // 結果を返す
        return NextResponse.json({
            nutrition: nutritionData
        });

    } catch (error) {
        console.error('栄養計算エラー:', error);

        // Zodエラーの場合（リクエストデータが不正）
        if (error instanceof z.ZodError) {
            return Response.json({
                error: 'リクエストデータが不正です',
                details: error.errors
            }, { status: 400 });
        }

        // その他のエラー
        return Response.json({
            error: '栄養計算中にエラーが発生しました',
            details: (error as Error).message
        }, { status: 500 });
    }
}

// 栄養素計算関数
async function calculateNutrition(foods: z.infer<typeof FoodItemSchema>[]) {
    // 栄養データベースの読み込み
    const nutritionDb: NutritionDbItem[] = await import('@/data/nutrition_data.json')
        .then(module => module.default)
        .catch(() => {
            console.warn('栄養データベースの読み込みに失敗しました。ダミーデータを使用します。');
            return [];
        });

    // 初期栄養値の設定
    let totalNutrition = {
        calories: 0,
        protein: 0,
        iron: 0,
        folic_acid: 0,
        calcium: 0,
        confidence_score: 0.8
    };

    // マッチングの精度を追跡
    let matchedItems = 0;
    let totalConfidence = 0;

    // 各食品の栄養素を合計
    for (const food of foods) {
        // 食品名の正規化（小文字化、特殊文字削除、空白削除）
        const normalizedFoodName = food.name.toLowerCase().replace(/[^\w\s]/g, '').trim();

        // 類似食品の検索
        const matches = nutritionDb.filter(item => {
            const normalizedItemName = item.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
            return normalizedItemName.includes(normalizedFoodName) ||
                normalizedFoodName.includes(normalizedItemName);
        });

        if (matches.length > 0) {
            matchedItems++;

            // 最も名前が近いアイテムを選択
            const bestMatch = matches.reduce((prev, current) => {
                const prevSimilarity = Math.abs(prev.name.length - normalizedFoodName.length);
                const currentSimilarity = Math.abs(current.name.length - normalizedFoodName.length);
                return prevSimilarity < currentSimilarity ? prev : current;
            });

            // 量に基づいて栄養素を調整
            const multiplier = estimateQuantityMultiplier(food.quantity || "1人前", bestMatch.standard_quantity);

            // 栄養素の加算
            totalNutrition.calories += bestMatch.calories * multiplier;
            totalNutrition.protein += bestMatch.protein * multiplier;
            totalNutrition.iron += bestMatch.iron * multiplier;
            totalNutrition.folic_acid += bestMatch.folic_acid * multiplier;
            totalNutrition.calcium += bestMatch.calcium * multiplier;

            // 信頼度の追跡
            totalConfidence += food.confidence || 0.9;

            console.log(`栄養素マッチング: ${food.name} -> ${bestMatch.name}, 量: ${food.quantity} (${multiplier}倍)`);
        } else {
            console.warn(`栄養データが見つかりませんでした: ${food.name}`);
            // マッチしない場合はデフォルト値を使用
            totalNutrition.calories += 50;
            totalNutrition.protein += 2;
            totalNutrition.iron += 0.2;
            totalNutrition.folic_acid += 5;
            totalNutrition.calcium += 10;

            // 未マッチ時の信頼度は低め
            totalConfidence += 0.5;
        }
    }

    // 信頼度スコアの計算
    totalNutrition.confidence_score = foods.length > 0
        ? Math.min(0.95, Math.max(0.5, (totalConfidence / foods.length) * (matchedItems / foods.length)))
        : 0.5;

    // 栄養素の値を適切に丸める
    totalNutrition.calories = Math.round(totalNutrition.calories);
    totalNutrition.protein = Math.round(totalNutrition.protein * 10) / 10;
    totalNutrition.iron = Math.round(totalNutrition.iron * 10) / 10;
    totalNutrition.folic_acid = Math.round(totalNutrition.folic_acid);
    totalNutrition.calcium = Math.round(totalNutrition.calcium);

    // 計算結果のログ出力
    console.log('栄養計算結果:', totalNutrition);

    return totalNutrition;
}

// 食品名の一致度を計算する関数（将来の拡張用）
function calculateNameSimilarity(name1: string, name2: string): number {
    // 正規化
    const normalizedName1 = name1.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const normalizedName2 = name2.toLowerCase().replace(/[^\w\s]/g, '').trim();

    // 完全一致
    if (normalizedName1 === normalizedName2) return 1.0;

    // 部分一致（含有関係）
    if (normalizedName1.includes(normalizedName2)) return 0.9;
    if (normalizedName2.includes(normalizedName1)) return 0.8;

    // 文字長の近さ（単純な類似度）
    const lengthDiff = Math.abs(normalizedName1.length - normalizedName2.length);
    const maxLength = Math.max(normalizedName1.length, normalizedName2.length);
    if (lengthDiff / maxLength < 0.3) return 0.7;

    // 将来的にはより高度なアルゴリズム（レーベンシュタイン距離など）を実装可能

    return 0.1; // 低い類似度
}