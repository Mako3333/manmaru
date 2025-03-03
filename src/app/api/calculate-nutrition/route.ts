import { NextResponse } from "next/server";
import { z } from "zod";
import { FoodItemSchema } from "@/lib/nutrition/nutritionUtils";
import { NutritionDatabase } from "@/lib/nutrition/database";

// リクエストの型定義
const RequestSchema = z.object({
    foods: z.array(FoodItemSchema)
});

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

        // NutritionDatabaseのインスタンスを取得
        const nutritionDb = NutritionDatabase.getInstance();

        // 栄養計算を実行
        const nutritionData = await nutritionDb.calculateNutrition(foods);

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