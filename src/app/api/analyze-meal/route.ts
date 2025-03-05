import { NextResponse } from 'next/server';
import { z } from "zod";
import { AIModelFactory } from '@/lib/ai/model-factory';
import { AIError, ErrorCode } from '@/lib/errors/ai-error';
import { withErrorHandling, checkApiKey } from '@/lib/errors/error-utils';

// リクエストスキーマ
const requestSchema = z.object({
    image: z.string(),
    mealType: z.string()
});

// テストモード設定
const TEST_MODE = process.env.NODE_ENV === 'development';

/**
 * 食事写真の解析APIエンドポイント
 * Base64エンコードされた画像を受け取り、AI分析結果を返す
 */
async function analyzeMealHandler(request: Request) {
    console.log('API: リクエスト受信');

    // APIキーの確認
    checkApiKey();

    // リクエストボディの解析
    const body = await request.json();

    // スキーマ検証
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
        throw new AIError(
            'リクエスト形式が不正です',
            ErrorCode.VALIDATION_ERROR,
            validationResult.error,
            ['image: Base64エンコードされた画像データ', 'mealType: 食事タイプ']
        );
    }

    const { image, mealType } = validationResult.data;
    console.log(`API: 食事タイプ=${mealType}, 画像データ長=${image?.length || 0}`);

    // テストモードの場合はモックデータを返す
    if (TEST_MODE) {
        console.log('API: テストモード - モックデータを返します');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return NextResponse.json(getMockData(mealType));
    }

    // プロンプト作成
    const prompt = `
    この食事の写真から含まれている食品を識別してください。
    食事タイプは「${mealType}」です。
    
    以下の形式でJSON形式で回答してください:
    {
      "foods": [
        {"name": "食品名", "quantity": "量の目安", "confidence": 信頼度(0.0-1.0)}
      ],
      "nutrition": {
        "calories": カロリー推定値,
        "protein": タンパク質(g),
        "iron": 鉄分(mg),
        "folic_acid": 葉酸(μg),
        "calcium": カルシウム(mg),
        "confidence_score": 信頼度(0.0-1.0)
      }
    }
    
    回答は必ずこのJSONフォーマットのみで返してください。
  `;

    // AIモデルの作成
    const model = AIModelFactory.createVisionModel({
        temperature: 0.1,
        maxOutputTokens: 1024
    });

    // モデル呼び出し
    console.log('API: Gemini API呼び出し');
    const aiResponse = await model.invokeWithImageData!(prompt, image);
    const responseText = aiResponse.toString();
    console.log('API: Gemini応答受信', responseText.substring(0, 100) + '...');

    // JSONレスポンスの抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new AIError(
            'AIからの応答を解析できませんでした',
            ErrorCode.RESPONSE_PARSE_ERROR,
            responseText
        );
    }

    // JSONパース
    try {
        const jsonResponse = JSON.parse(jsonMatch[0]);
        console.log('API: 解析成功', JSON.stringify(jsonResponse).substring(0, 100) + '...');
        return NextResponse.json(jsonResponse);
    } catch (parseError) {
        throw new AIError(
            'AIレスポンスのJSON解析に失敗しました',
            ErrorCode.RESPONSE_PARSE_ERROR,
            { error: parseError, text: jsonMatch[0] }
        );
    }
}

// エラーハンドリングでラップしたハンドラをエクスポート
export const POST = withErrorHandling(analyzeMealHandler);

// モックデータ関数は変更なし
function getMockData(mealType: string) {
    return {
        foods: [
            { name: "ご飯", quantity: "1膳", confidence: 0.95 },
            { name: "味噌汁", quantity: "1杯", confidence: 0.9 },
            { name: "焼き鮭", quantity: "1切れ", confidence: 0.85 },
            { name: "ほうれん草のおひたし", quantity: "小鉢1杯", confidence: 0.8 },
            { name: "納豆", quantity: "1パック", confidence: 0.9 }
        ],
        nutrition: {
            calories: 450,
            protein: 25,
            iron: 2.5,
            folic_acid: 120,
            calcium: 180,
            confidence_score: 0.85
        }
    };
} 