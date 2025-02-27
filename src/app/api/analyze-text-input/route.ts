import { NextResponse } from "next/server";
import { z } from "zod";
import {
    FoodItemSchema,
    DetectedFoodsSchema
} from "@/lib/nutrition/nutritionUtils";
import { createGeminiModel } from "@/lib/langchain/langchain";

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

        // 環境変数確認
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY環境変数が設定されていません');
            return new Response(JSON.stringify({
                error: 'API設定エラー'
            }), { status: 500 });
        }

        // リクエストデータの検証
        const { foods } = RequestSchema.parse(body);

        // 食品データがない場合はエラー
        if (!foods || foods.length === 0) {
            return Response.json({ error: '食品データが必要です' }, { status: 400 });
        }

        // APIキーの取得
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            return Response.json(
                { error: '設定エラー', details: 'GEMINI_API_KEY環境変数が設定されていません' },
                { status: 500 }
            );
        }

        // Gemini Proモデルの初期化（テキスト処理用）
        const model = createGeminiModel("gemini-pro", {
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

## 例
入力: 「・りんご 半分, ・サラダ 少し」
出力: 
{
  "enhancedFoods": [
    {"name": "りんご", "quantity": "80g", "confidence": 0.95},
    {"name": "グリーンサラダ", "quantity": "50g", "confidence": 0.8}
  ]
}

JSONデータのみを出力してください。説明文などは不要です。
`;

        // AIに解析リクエスト
        const response = await model.invoke(prompt);
        const responseText = response.content.toString();

        // AIの回答からJSONを抽出
        try {
            // JSON形式を検出（マークダウンコードブロックも処理）
            let jsonStr = responseText;

            // マークダウンのコードブロックからJSON部分を抽出
            const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonBlockMatch && jsonBlockMatch[1]) {
                jsonStr = jsonBlockMatch[1];
            } else {
                // 単純なJSONオブジェクトを探す
                const jsonMatch = responseText.match(/(\{[\s\S]*\})/);
                if (jsonMatch && jsonMatch[1]) {
                    jsonStr = jsonMatch[1];
                }
            }

            // JSONパース
            const jsonData = JSON.parse(jsonStr);

            // enhancedFoodsの存在確認
            if (!jsonData.enhancedFoods || !Array.isArray(jsonData.enhancedFoods)) {
                throw new Error('AIからの応答に有効な食品データがありません');
            }

            // 元のIDを保持して結果を構築
            const result = {
                enhancedFoods: jsonData.enhancedFoods.map((item: any, index: number) => ({
                    id: foods[index]?.id || `food-${index}`,
                    name: item.name,
                    quantity: item.quantity,
                    confidence: item.confidence || 0.8
                }))
            };

            // 結果を返却
            return NextResponse.json(result);

        } catch (error) {
            console.error('JSON解析エラー:', error);
            console.error('AIレスポンス:', responseText);

            return Response.json({
                error: 'AIの応答を解析できませんでした',
                details: 'JSON形式の解析に失敗しました',
                aiResponse: responseText
            }, { status: 500 });
        }

    } catch (error) {
        console.error('テキスト解析エラー詳細:', error);
        return new Response(JSON.stringify({
            error: 'テキスト解析中にエラーが発生しました',
            details: (error as Error).message
        }), { status: 500 });
    }
}