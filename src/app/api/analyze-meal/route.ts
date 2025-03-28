import { NextResponse } from 'next/server';
import { z } from "zod";
import { AIService } from '@/lib/ai/ai-service';
import { withApiErrorHandling } from '@/lib/errors/error-handler';
import {
    ApiError,
    ValidationError,
    AiAnalysisError,
    ErrorCode
} from '@/lib/errors/app-errors';
//src\app\api\analyze-meal\route.ts
// リクエストスキーマ
const requestSchema = z.object({
    image: z.string().min(1, "画像データが必要です"),
    mealType: z.string().min(1, "食事タイプが必要です")
});

// テストモード設定
const TEST_MODE = process.env.NODE_ENV === 'development' && process.env.USE_MOCK_DATA === 'true';

/**
 * 食事写真の解析APIエンドポイント
 * Base64エンコードされた画像を受け取り、AI分析結果を返す
 */
async function analyzeMealHandler(request: Request) {
    console.log('API: 食事解析リクエスト受信');

    // リクエストボディの解析
    let body: any;
    try {
        body = await request.json();
    } catch (error) {
        throw new ApiError(
            'リクエストボディのJSONパースに失敗しました',
            ErrorCode.DATA_VALIDATION_ERROR,
            '無効なリクエスト形式です',
            400,
            { originalError: error }
        );
    }

    // スキーマ検証
    try {
        const validationResult = requestSchema.parse(body);
        const { image, mealType } = validationResult;
        console.log(`API: 食事タイプ=${mealType}, 画像データ長=${image?.length || 0}`);

        // テストモードの場合はモックデータを返す
        if (TEST_MODE) {
            console.log('API: テストモード - モックデータを返します');
            return NextResponse.json({
                success: true,
                data: getMockData(mealType)
            });
        }

        // AIサービス呼び出し
        const aiService = AIService.getInstance();

        try {
            const result = await aiService.analyzeMeal(image, mealType);
            console.log('API: 解析成功', JSON.stringify(result).substring(0, 100) + '...');

            return NextResponse.json({
                success: true,
                data: result
            });
        } catch (aiError) {
            console.error('API: AI解析エラー', aiError);

            // AI固有のエラー処理
            throw new AiAnalysisError(
                '食事画像の解析中にエラーが発生しました',
                '画像が不鮮明か認識できない場合は別の画像を試してください',
                ErrorCode.AI_ANALYSIS_FAILED,
                aiError,
                [
                    '画像が鮮明であることを確認してください',
                    '別の角度からの写真を試してください',
                    '手動入力も可能です'
                ],
                aiError instanceof Error ? aiError : undefined
            );
        }
    } catch (validationError) {
        if (validationError instanceof z.ZodError) {
            // Zodバリデーションエラーを変換
            const issues = validationError.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
            throw new ValidationError(
                `リクエスト形式が不正です: ${issues}`,
                'リクエストデータ',
                ErrorCode.DATA_VALIDATION_ERROR,
                validationError.errors,
                ['有効な画像データと食事タイプを指定してください'],
                validationError
            );
        }

        // その他のエラーは再スロー
        throw validationError;
    }
}

// エラーハンドリングでラップしたハンドラをエクスポート
export const POST = withApiErrorHandling(analyzeMealHandler);

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