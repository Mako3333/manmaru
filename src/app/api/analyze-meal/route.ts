import { NextResponse } from 'next/server';
import { z } from "zod";
import { AIService } from '@/lib/ai/ai-service';
import { withErrorHandling } from '@/lib/errors/error-utils';

// リクエストスキーマ
const requestSchema = z.object({
    image: z.string(),
    mealType: z.string()
});

// テストモード設定
const TEST_MODE = process.env.NODE_ENV === 'development' && process.env.USE_MOCK_DATA === 'true';

/**
 * 食事写真の解析APIエンドポイント
 * Base64エンコードされた画像を受け取り、AI分析結果を返す
 */
async function analyzeMealHandler(request: Request) {
    console.log('API: リクエスト受信');

    // リクエストボディの解析
    const body = await request.json();

    // スキーマ検証
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'validation_error',
                    message: 'リクエスト形式が不正です',
                    details: validationResult.error.issues
                }
            },
            { status: 400 }
        );
    }

    const { image, mealType } = validationResult.data;
    console.log(`API: 食事タイプ=${mealType}, 画像データ長=${image?.length || 0}`);

    // テストモードの場合はモックデータを返す
    if (TEST_MODE) {
        console.log('API: テストモード - モックデータを返します');
        return NextResponse.json(getMockData(mealType));
    }

    // AIサービス呼び出し
    const aiService = AIService.getInstance();
    const result = await aiService.analyzeMeal(image, mealType);

    console.log('API: 解析成功', JSON.stringify(result).substring(0, 100) + '...');
    return NextResponse.json(result);
}

// エラーハンドリングでラップしたハンドラをエクスポート
export const POST = withErrorHandling(analyzeMealHandler);

/**
 * テスト用モックデータ
 */
function getMockData(mealType: string) {
    return {
        foods: [
            { name: "サラダ", quantity: "1人前", confidence: 0.95 },
            { name: "玄米ご飯", quantity: "茶碗1杯", confidence: 0.9 },
            { name: "鮭の塩焼き", quantity: "1切れ", confidence: 0.85 }
        ],
        nutrition: {
            calories: 450,
            protein: 22,
            iron: 2.5,
            folic_acid: 120,
            calcium: 85,
            confidence_score: 0.8
        }
    };
} 