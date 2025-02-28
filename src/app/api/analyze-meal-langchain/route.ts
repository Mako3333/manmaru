import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createImageContent } from '@/lib/utils/image-utils';
import { z } from "zod";

// 出力スキーマの定義
const outputSchema = z.object({
    foods: z.array(
        z.object({
            name: z.string().describe("食品の名前"),
            quantity: z.string().describe("量の目安（例：1杯、100g）"),
            confidence: z.number().min(0).max(1).describe("認識の信頼度（0.0～1.0）")
        })
    ),
    nutrition: z.object({
        calories: z.number().describe("カロリー（kcal）"),
        protein: z.number().describe("タンパク質（g）"),
        iron: z.number().describe("鉄分（mg）"),
        folic_acid: z.number().describe("葉酸（μg）"),
        calcium: z.number().describe("カルシウム（mg）"),
        confidence_score: z.number().min(0).max(1).describe("栄養情報の信頼度（0.0～1.0）")
    })
});

// Google AI APIキーの設定
const apiKey = process.env.GEMINI_API_KEY || '';

// モデルの設定
const genAI = new GoogleGenerativeAI(apiKey);
const modelName = 'gemini-1.5-pro'; // 画像認識に適したモデル

export async function POST(request: Request) {
    try {
        // リクエストボディからデータを取得
        const body = await request.json();
        const { image, mealType } = body;

        // 画像データの確認
        if (!image) {
            return NextResponse.json(
                { error: '画像データが含まれていません' },
                { status: 400 }
            );
        }

        // Gemini APIのためのコンテンツ準備
        const imageContent = createImageContent(image);

        // Gemini モデルの設定
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.2,
                topK: 32,
                topP: 0.95,
            },
        });

        // スキーマ情報を文字列化
        const schemaDescription = JSON.stringify(outputSchema.shape, null, 2);

        // プロンプトの作成
        const prompt = `
      この食事の写真から含まれている食品を識別し、栄養情報を推定してください。
      食事タイプは「${mealType}」です。
      
      以下のスキーマに従ってJSON形式で回答してください:
      ${schemaDescription}
      
      回答は必ずこのJSONフォーマットのみで返してください。
    `;

        // Gemini APIを呼び出し
        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: imageContent }
                    ]
                }
            ]
        });

        const response = result.response;
        const responseText = response.text();

        // JSONレスポンスの抽出（レスポンスからJSONを見つける）
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('APIからの応答を解析できませんでした');
        }

        const jsonResponse = JSON.parse(jsonMatch[0]);

        // スキーマに対して検証
        const validationResult = outputSchema.safeParse(jsonResponse);

        if (!validationResult.success) {
            console.error('スキーマ検証エラー:', validationResult.error);
            return NextResponse.json(
                { error: 'APIレスポンスの形式が不正です', details: validationResult.error.format() },
                { status: 500 }
            );
        }

        return NextResponse.json(validationResult.data);
    } catch (error) {
        console.error('画像解析エラー:', error);
        return NextResponse.json(
            { error: '画像の解析に失敗しました' },
            { status: 500 }
        );
    }
} 