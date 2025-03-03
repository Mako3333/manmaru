import { NextResponse } from "next/server";
import { z } from "zod";
import { FoodItem, DetectedFoods } from "@/types/nutrition";
import { createGeminiModel } from "@/lib/langchain/langchain";
import { AIResponseParser } from "@/lib/ai/response-parser";
import { FoodAnalysisError, ErrorCode, createErrorResponse } from "@/lib/errors/food-analysis-error";
import { NutritionDatabase } from "@/lib/nutrition/database";

// リクエスト用のZodスキーマ
const RequestSchema = z.object({
    imageBase64: z.string(),
    mimeType: z.string().optional().default('image/jpeg')
});

// 画像解析のAPIエンドポイント
export async function POST(request: Request) {
    try {
        console.log('画像解析リクエスト受信');
        const body = await request.json();

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
        const { imageBase64, mimeType } = RequestSchema.parse(body);

        // 画像データがない場合はエラー
        if (!imageBase64) {
            throw new FoodAnalysisError(
                '画像データが必要です',
                ErrorCode.MISSING_TEXT,
                '画像データが空です'
            );
        }

        // Gemini Proモデルの初期化（画像処理用）
        const model = createGeminiModel("gemini-2.0-pro-vision", {
            temperature: 0.2,
            maxOutputTokens: 1024
        });

        // プロンプトの構築
        const prompt = `
# 指示
あなたは日本の栄養士AIです。この食事の画像を解析して、含まれている食品を特定してください。

## 出力要件
1. 画像に写っている食品を全て特定してください
2. 各食品の量を推測してください（例: 「ご飯 150g」、「サラダ 100g」）
3. 日本の食品に焦点を当ててください

## 出力形式
以下のJSONフォーマットで出力してください:
{
  "detectedFoods": [
    {"name": "食品名", "quantity": "推測された量", "confidence": 0.9},
    ...
  ]
}

JSONデータのみを出力してください。説明文などは不要です。
`;

        // AIに解析リクエスト（画像付き）
        const requestData = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType, data: imageBase64 } }
                    ]
                }
            ]
        };

        const response = await model.invokeWithImageData(requestData);
        const responseText = response.toString();

        // AIの回答を解析
        const parsedData = AIResponseParser.parseResponse(responseText);

        // detectedFoodsキーをenhancedFoodsキーに変換（互換性のため）
        const compatibleData = parsedData.detectedFoods
            ? { enhancedFoods: parsedData.detectedFoods }
            : parsedData;

        const enhancedData = AIResponseParser.validateAndEnhanceFoodData(compatibleData);

        // 栄養データベースのインスタンスを取得
        const nutritionDb = NutritionDatabase.getInstance();

        // 栄養素を計算
        const nutritionData = await nutritionDb.calculateNutrition(enhancedData.foods);

        // 結果を返却
        return NextResponse.json({
            foods: enhancedData.foods,
            nutrition: nutritionData
        });

    } catch (error) {
        console.error('画像解析エラー詳細:', error);

        if (error instanceof FoodAnalysisError) {
            return NextResponse.json(
                createErrorResponse(error),
                { status: 500 }
            );
        }

        // その他のエラー
        return NextResponse.json(
            createErrorResponse(new FoodAnalysisError(
                '画像解析中にエラーが発生しました',
                ErrorCode.AI_ERROR,
                error
            )),
            { status: 500 }
        );
    }
} 