import { NextResponse } from "next/server";
import { StructuredOutputParser } from "langchain/output_parsers";
import { createGeminiModel, createMultiModalMessage } from "@/lib/langchain/langchain";
import {
    DetectedFoods,
    FoodItem,
    MealType
} from "@/types/nutrition";
import { NutritionDatabase } from "@/lib/nutrition/database";
import { FoodAnalysisError, ErrorCode, createErrorResponse } from "@/lib/errors/food-analysis-error";
import { AIResponseParser } from "@/lib/ai/response-parser";

/**
 * 食事分析APIのエンドポイント
 */
export async function POST(req: Request) {
    try {
        // リクエストボディから画像データと食事タイプを取得
        const { imageBase64, mealType, apiKey } = await req.json();

        // リクエストからAPIキーを取得（テスト用）
        const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;

        if (!geminiApiKey) {
            throw new FoodAnalysisError(
                'API設定エラー',
                ErrorCode.MISSING_API_KEY,
                'GEMINI_API_KEY環境変数が設定されていません'
            );
        }

        if (!imageBase64) {
            throw new FoodAnalysisError(
                '画像データが必要です',
                ErrorCode.MISSING_IMAGE,
                '画像データが提供されていません'
            );
        }

        // 1. Gemini Visionモデルの初期化
        const model = createGeminiModel("gemini-pro-vision", {
            maxOutputTokens: 2048,
            temperature: 0.2, // 低い温度で決定的な結果に
        });

        // 2. プロンプトの構築 - より詳細な指示を提供
        const prompt = `
# 指示
あなたは妊婦の食事を分析する栄養士AIです。
以下の写真に写っている食事を詳細に分析し、含まれる全ての食品とその量を特定してください。

# 注意事項
- 日本の一般的な食事に含まれる全ての食品を検出してください
- 調味料やソースも含めてください
- 量は「茶碗1杯」「大さじ2」「100g」など、可能な限り具体的に記載してください
- 曖昧な場合は推測せず、一般的な1人前の量を記載してください
- 食事タイプは「${mealType}」です

# 出力形式
以下のJSONフォーマットで出力してください:
{
  "enhancedFoods": [
    {
      "name": "食品名",
      "quantity": "量",
      "confidence": 0.9
    }
  ]
}

JSONデータのみを出力してください。説明文などは不要です。
`;

        // 3. 画像から食品を検出
        const message = createMultiModalMessage(prompt, imageBase64);
        const response = await model.invoke([message]);
        const responseText = response.content.toString();

        // 4. 検出結果を構造化
        const parsedData = AIResponseParser.parseResponse(responseText);
        const enhancedData = AIResponseParser.validateAndEnhanceFoodData(parsedData);

        // 5. 栄養素計算
        const nutritionDb = NutritionDatabase.getInstance();
        const nutritionData = await nutritionDb.calculateNutrition(enhancedData.enhancedFoods);

        // 6. 結果を返却
        return NextResponse.json({
            foods: enhancedData.enhancedFoods,
            nutrition: nutritionData,
            mealType
        });

    } catch (error) {
        console.error('Error analyzing meal:', error);

        if (error instanceof FoodAnalysisError) {
            return NextResponse.json(
                createErrorResponse(error),
                { status: 500 }
            );
        }

        return NextResponse.json(
            createErrorResponse(new FoodAnalysisError(
                '食事分析中にエラーが発生しました',
                ErrorCode.AI_ERROR,
                error
            )),
            { status: 500 }
        );
    }
}