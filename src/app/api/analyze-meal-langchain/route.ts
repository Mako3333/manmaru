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
const modelName = 'gemini-2.0-flash-001'; // 画像認識に適したモデル

/**
 * 互換性のためのリダイレクトハンドラ
 * @deprecated - このAPIは廃止予定です。代わりに /api/analyze-meal を使用してください
 */
export async function POST(request: Request) {
    console.log('リダイレクト: /api/analyze-meal-langchain から /api/analyze-meal へ');

    // 新しいURLを構築
    const url = new URL(request.url);
    const newUrl = new URL('/api/analyze-meal', url.origin);

    // リクエストボディを取得して転送
    const body = await request.json();

    // 新APIへのフェッチ
    const response = await fetch(newUrl.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    // レスポンスをそのまま返す
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
} 