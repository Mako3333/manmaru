import { NextRequest } from 'next/server';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { withErrorHandling } from '@/lib/api/middleware';
import { validateRequestData, validateFoodTextInput } from '@/lib/utils/request-validation';
import { FoodInputParser } from '@/lib/food/food-input-parser';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import type { ApiResponse } from '@/types/api';
import { z } from 'zod';
//src\app\api\v2\food\parse\route.ts
/**
 * 食品テキスト解析API v2
 * テキスト入力から食品情報を解析する
 */

// リクエストの検証スキーマ
const requestSchema = z.object({
    text: z.string().min(1, "テキスト入力は必須です")
});

export const POST = withErrorHandling(async (req: NextRequest): Promise<ApiResponse<any>> => {
    // リクエストデータを取得して検証
    const requestData = await req.json();

    try {
        // スキーマ検証
        const validatedData = requestSchema.parse(requestData);
        const text = validatedData.text.trim();

        if (!text) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '空の入力テキストです',
                details: { reason: 'テキスト入力は必須です' }
            });
        }

        // 処理時間計測開始
        const startTime = Date.now();

        // AIサービス初期化
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // テキスト解析の実行
        const analysisResult = await aiService.analyzeMealText(text);

        if (analysisResult.error) {
            throw new AppError({
                code: ErrorCode.AI.ANALYSIS_ERROR,
                message: 'テキスト解析に失敗しました',
                details: {
                    reason: analysisResult.error || 'テキスト解析中にエラーが発生しました',
                    originalError: analysisResult.error
                }
            });
        }

        // 解析結果から食品リストを取得
        const foods = analysisResult.parseResult.foods;

        // 食品リストの検証
        if (!foods || foods.length === 0) {
            throw new AppError({
                code: ErrorCode.Nutrition.FOOD_NOT_FOUND, // FOOD_RECOGNITION_ERROR は Nutrition カテゴリに移動
                message: '食品が検出されませんでした',
                details: { reason: '入力テキストから食品を検出できませんでした。別の入力をお試しください。' }
            });
        }

        // 名前と量のペアを生成
        const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(foods);

        // 成功レスポンスを返却
        return {
            success: true,
            data: {
                foods,
                originalText: text,
                parsedItems: nameQuantityPairs,
                confidence: analysisResult.parseResult.confidence || 0.9,
                processingTimeMs: analysisResult.processingTimeMs
            },
            meta: {
                processingTimeMs: Date.now() - startTime
            }
        };
    } catch (error) {
        // Zodバリデーションエラーの処理
        if (error instanceof z.ZodError) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '入力データが無効です',
                details: {
                    reason: error.errors.map(err => `${err.path}: ${err.message}`).join(', '),
                    originalError: error
                }
            });
        }

        // その他のエラーは上位ハンドラーに委譲
        throw error;
    }
});

/**
 * プリフライトリクエスト対応
 */
export const OPTIONS = withErrorHandling(async () => {
    return { success: true, data: { message: 'OK' } };
}); 