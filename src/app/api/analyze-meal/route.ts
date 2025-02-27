// Next.jsのAPI Route機能を使うためのもの
import { NextResponse } from "next/server";
// 構造化出力パーサー
import { StructuredOutputParser } from "langchain/output_parsers";
// 型検証ライブラリ
import { z } from "zod";
// プロジェクト内の自作ユーティリティーをインポート
import { createGeminiModel, GeminiModel, createImageContent, createMultiModalMessage } from "@/lib/langchain/langchain";
import {
    DetectedFoodsSchema,
    FoodItem,
    Nutrition,
    estimateQuantityMultiplier
} from "@/lib/nutrition/nutritionUtils";

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

// 食事分析APIのエンドポイント
export async function POST(req: Request) {
    try {
        // リクエストボディから画像データと食事タイプを取得
        const { imageBase64, mealType, apiKey } = await req.json();

        // リクエストからAPIキーを取得（テスト用）
        const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;

        if (!geminiApiKey) {
            return Response.json(
                { error: '食事分析中にエラーが発生しました', details: 'GEMINI_API_KEY環境変数が設定されていません' },
                { status: 500 }
            );
        }

        if (!imageBase64) {
            return Response.json({ error: '画像データが必要です' }, { status: 400 });
        }

        // 1. Gemini Visionモデルの初期化
        const model = createGeminiModel("gemini-2.0-flash-001", {
            maxOutputTokens: 2048,
            temperature: 0.2, // 低い温度で決定的な結果に
        });

        // 2. 出力パーサーの定義
        const foodParser = StructuredOutputParser.fromZodSchema(DetectedFoodsSchema);

        // 3. プロンプトの構築 - より詳細な指示を提供
        const prompt = `
      あなたは妊婦の食事を分析する栄養士AIです。
      
      以下の写真に写っている食事を詳細に分析し、含まれる全ての食品とその量を特定してください。
      
      # 注意事項
      - 日本の一般的な食事に含まれる全ての食品を検出してください
      - 調味料やソースも含めてください
      - 量は「茶碗1杯」「大さじ2」「100g」など、可能な限り具体的に記載してください
      - 曖昧な場合は推測せず、一般的な1人前の量を記載してください
      - 食事タイプは「${mealType}」です
      
      ${foodParser.getFormatInstructions()}
    `;

        // 4. 画像から食品を検出
        const message = createMultiModalMessage(prompt, imageBase64);
        const response = await model.invoke([message]);

        // 5. 検出結果を構造化
        const detectedFoods = await foodParser.parse(
            typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content)
        );

        // 6. 栄養素計算（シンプルなRAG実装）
        const nutritionData = await calculateNutrition(detectedFoods.foods);

        return Response.json({
            foods: detectedFoods.foods,
            nutrition: nutritionData
        });
    } catch (error) {
        console.error('Error analyzing meal:', error);
        return Response.json(
            { error: '食事分析中にエラーが発生しました', details: (error as Error).message },
            { status: 500 }
        );
    }
}

// 栄養素計算関数 - より精緻な実装
async function calculateNutrition(foods: FoodItem[]): Promise<Nutrition> {
    // MVPでは簡易版の栄養データベースを使用
    // 将来的にはより大規模なデータベースを使用予定
    const nutritionDb: NutritionDbItem[] = await import('@/data/nutrition_data.json')
        .then(module => module.default)
        .catch(() => {
            console.warn('栄養データベースの読み込みに失敗しました。ダミーデータを使用します。');
            return [];
        });

    let totalNutrition: Nutrition = {
        calories: 0,
        protein: 0,
        iron: 0,
        folic_acid: 0,
        calcium: 0,
        confidence_score: 0.8
    };

    // マッチングの精度を追跡
    let matchedItems = 0;

    // 各食品の栄養素を合計
    for (const food of foods) {
        // 食品名の正規化（空白、記号を削除し小文字に）
        const normalizedFoodName = food.name.toLowerCase().replace(/[^\w\s]/g, '').trim();

        // 最適なマッチを検索（部分一致や類似度を考慮）
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
            const multiplier = estimateQuantityMultiplier(food.quantity, bestMatch.standard_quantity);

            totalNutrition.calories += bestMatch.calories * multiplier;
            totalNutrition.protein += bestMatch.protein * multiplier;
            totalNutrition.iron += bestMatch.iron * multiplier;
            totalNutrition.folic_acid += bestMatch.folic_acid * multiplier;
            totalNutrition.calcium += bestMatch.calcium * multiplier;
        } else {
            console.warn(`栄養データが見つかりませんでした: ${food.name}`);
            // 見つからない場合はデフォルト値を追加（推測）
            totalNutrition.calories += 50; // 少量の汎用的な値を追加
            totalNutrition.protein += 2;
            totalNutrition.iron += 0.2;
            totalNutrition.folic_acid += 5;
            totalNutrition.calcium += 10;
        }
    }

    // 信頼度スコアの計算（マッチした項目の割合）
    totalNutrition.confidence_score = foods.length > 0
        ? Math.min(0.95, Math.max(0.5, matchedItems / foods.length))
        : 0.5;

    // 栄養素の値を適切に丸める
    totalNutrition.calories = Math.round(totalNutrition.calories);
    totalNutrition.protein = Math.round(totalNutrition.protein * 10) / 10;
    totalNutrition.iron = Math.round(totalNutrition.iron * 10) / 10;
    totalNutrition.folic_acid = Math.round(totalNutrition.folic_acid);
    totalNutrition.calcium = Math.round(totalNutrition.calcium);

    return totalNutrition;
} 