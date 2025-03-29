import { NextRequest } from 'next/server';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { withAuthAndErrorHandling, createSuccessResponse } from '@/lib/util/api-middleware';
import { validateRequestData, validateFoodTextInput } from '@/lib/util/request-validation';
import { AIErrorHandler } from '@/lib/ai/ai-error-handler';
import { NutritionErrorHandler } from '@/lib/nutrition/nutrition-error-handler';
import { FoodInputParser } from '@/lib/food/food-input-parser';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';
import { StandardApiResponse } from '@/types/api';
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

export const POST = withAuthAndErrorHandling(async (req: NextRequest): Promise<StandardApiResponse<any>> => {
    // リクエストデータを取得して検証
    const requestData = await req.json();

    try {
        // スキーマ検証
        const validatedData = requestSchema.parse(requestData);
        const text = validatedData.text.trim();

        if (!text) {
            throw new ApiError(
                '空の入力テキストです',
                ErrorCode.DATA_VALIDATION_ERROR,
                'テキスト入力は必須です',
                400
            );
        }

        // 処理時間計測開始
        const startTime = Date.now();

        // AIサービス初期化
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // テキスト解析の実行
        const analysisResult = await aiService.analyzeMealText(text);

        if (analysisResult.error) {
            throw new ApiError(
                'テキスト解析に失敗しました',
                ErrorCode.AI_ANALYSIS_ERROR,
                analysisResult.error || 'テキスト解析中にエラーが発生しました',
                500,
                { originalError: analysisResult.error }
            );
        }

        // 解析結果から食品リストを取得
        const foods = analysisResult.parseResult.foods;

        // 食品リストの検証
        if (!foods || foods.length === 0) {
            throw new ApiError(
                '食品が検出されませんでした',
                ErrorCode.FOOD_RECOGNITION_ERROR,
                '入力テキストから食品を検出できませんでした。別の入力をお試しください。',
                400
            );
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
            const errorMessage = error.errors.map(err => `${err.path}: ${err.message}`).join(', ');
            throw new ApiError(
                '入力データが無効です',
                ErrorCode.DATA_VALIDATION_ERROR,
                errorMessage,
                400,
                { originalError: error }
            );
        }

        // その他のエラーは上位ハンドラーに委譲
        throw error;
    }
});

/**
 * プリフライトリクエスト対応
 */
export const OPTIONS = withAuthAndErrorHandling(async () => {
    return { success: true, data: { message: 'OK' } };
}, false); 