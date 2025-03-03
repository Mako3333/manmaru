import { NextResponse } from "next/server";
import { z } from "zod";
import {
    FoodItem,
    DetectedFoods
} from "@/types/nutrition";
import { createGeminiModel } from "@/lib/langchain/langchain";
import { AIResponseParser } from "@/lib/ai/response-parser";
import { FoodAnalysisError, ErrorCode, createErrorResponse } from "@/lib/errors/food-analysis-error";
import { NutritionDatabase } from "@/lib/nutrition/database";

// リクエスト用のZodスキーマ
const RequestSchema = z.object({
    foods: z.array(z.object({
        id: z.string().optional(),
        name: z.string(),
        quantity: z.string().optional(),
        confidence: z.number().optional()
    }))
});

// テキスト入力解析のAPIエンドポイント
export async function POST(request: Request) {
    try {
        console.log('テキスト解析リクエスト受信');
        const body = await request.json();
        console.log('リクエストボディ:', body);

        // APIキーの取得と検証
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            throw new FoodAnalysisError(
                'API設定エラー',
                ErrorCode.MISSING_API_KEY,
                'GEMINI_API_KEY環境変数が設定されていません'
            );
        }

        // リクエストデータの検証
        const { foods } = RequestSchema.parse(body);

        // 食品データがない場合はエラー
        if (!foods || foods.length === 0) {
            throw new FoodAnalysisError(
                '食品データが必要です',
                ErrorCode.MISSING_TEXT,
                '入力データが空です'
            );
        }

        // Gemini Proモデルの初期化（テキスト処理用）
        const model = createGeminiModel("gemini-2.0-flash-001", {
            temperature: 0.2,
            maxOutputTokens: 1024
        });

        // 食品リストをテキスト形式に変換
        const foodsText = foods.map(food =>
            `・${food.name}${food.quantity ? ` ${food.quantity}` : ''}`
        ).join('\n');

        // プロンプトの構築
        const prompt = `
# 指示
あなたは日本の栄養士AIです。以下の食事リストを解析して、データベース検索に適した形式に変換してください。

## 入力データ
${foodsText}

## 出力要件
1. 各食品を標準的な日本語の食品名に変換してください
2. 量が曖昧または不明確な場合は、一般的な分量を推測して具体化してください
   例: 「サラダ」→「グリーンサラダ 100g」、「りんご」→「りんご 150g（中1個）」
3. 以下の量の表現は具体的な数値に変換してください
   - 「少し」→ 適切なグラム数（例: 10-30g）
   - 「一杯」→ 適切な量（例: ご飯なら150g、スープなら200ml）
   - 「一切れ」→ 食品に適した量（例: パンなら40g、ケーキなら80g）

## 出力形式
以下のJSONフォーマットで出力してください:
{
  "enhancedFoods": [
    {"name": "標準化された食品名", "quantity": "標準化された量", "confidence": 0.9},
    ...
  ]
}

JSONデータのみを出力してください。説明文などは不要です。
`;

        // AIに解析リクエスト
        const response = await model.invoke(prompt);
        const responseText = response.content.toString();

        // AIの回答を解析
        const parsedData = AIResponseParser.parseResponse(responseText);
        const enhancedData = AIResponseParser.validateAndEnhanceFoodData(parsedData);

        // 栄養データベースのインスタンスを取得
        const nutritionDb = NutritionDatabase.getInstance();

        // 栄養素を計算
        const nutritionData = await nutritionDb.calculateNutrition(enhancedData.enhancedFoods);

        // 結果を返却
        return NextResponse.json({
            enhancedFoods: enhancedData.enhancedFoods,
            nutrition: nutritionData
        });

    } catch (error) {
        console.error('テキスト解析エラー詳細:', error);

        if (error instanceof FoodAnalysisError) {
            return NextResponse.json(
                createErrorResponse(error),
                { status: 500 }
            );
        }

        // その他のエラー
        return NextResponse.json(
            createErrorResponse(new FoodAnalysisError(
                'テキスト解析中にエラーが発生しました',
                ErrorCode.AI_ERROR,
                error
            )),
            { status: 500 }
        );
    }
}