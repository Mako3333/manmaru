import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api/middleware';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
// import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory'; // 不要
// import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory'; // 不要
import type { FoodInputParseResult } from '@/lib/food/food-input-parser';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import type { MealAnalysisResult } from '@/types/ai';
import { z } from 'zod';
// import { convertToLegacyNutrition } from '@/lib/nutrition/nutrition-type-utils'; // 不要
import { createSuccessResponse } from '@/lib/api/response';

// リクエストの検証スキーマ
const requestSchema = z.object({
    image: z.string().min(1, "画像データは必須です"),
    mealType: z.string().optional(),
    trimester: z.number().int().min(1).max(3).optional()
});

/**
 * 食事画像解析API v2 (修正版: AI認識のみ)
 * 画像から食品を認識し、AI推定結果を返す
 */
export const POST = withErrorHandling(async (req: NextRequest): Promise<NextResponse> => {
    const requestData = await req.json();

    try {
        const validatedData = requestSchema.parse(requestData);
        const imageData = validatedData.image;
        const mealType = validatedData.mealType || '食事'; // mealType は保持
        const trimester = validatedData.trimester; // trimester も保持

        if (!imageData.startsWith('data:image/')) {
            throw new AppError({
                code: ErrorCode.File.INVALID_IMAGE,
                message: '無効な画像形式です',
                details: { reason: '画像データはbase64エンコードされたものである必要があります' }
            });
        }

        const base64Data = imageData.split(',')[1];
        if (!base64Data) {
            throw new AppError({
                code: ErrorCode.File.INVALID_IMAGE,
                message: 'Base64データの解析に失敗しました',
                details: { reason: '画像データからBase64部分を抽出できませんでした' }
            });
        }
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const startTime = Date.now();
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // AIによる画像解析 (戻り値は MealAnalysisResult 型)
        const analysisResult: MealAnalysisResult = await aiService.analyzeMealImage(imageBuffer);

        // AI解析エラーのチェック
        if (analysisResult.error) {
            throw new AppError({
                code: ErrorCode.AI.IMAGE_PROCESSING_ERROR,
                message: analysisResult.error.message || '画像解析に失敗しました',
                details: { originalError: analysisResult.error.details }
            });
        }

        // レスポンスデータ構築 (AI解析結果を直接使用)
        const responseData = {
            foods: analysisResult.foods || [], // AIが認識した食品リスト
            mealType, // mealType はそのまま渡す
            ...(trimester ? { trimester } : {}), // trimester もそのまま渡す
            recognitionConfidence: analysisResult.confidence, // AIの全体的な信頼度
            aiEstimatedNutrition: analysisResult.estimatedNutrition, // AI推定栄養価
            // nutritionResult フィールドは削除
        };

        const meta = {
            processingTimeMs: Date.now() - startTime,
            analysisSource: 'ai', // ソースはAIのみ
            // 警告メッセージはAI解析結果に依存するか、削除 (一旦削除)
        };

        return createSuccessResponse(responseData, meta);

    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '入力データが無効です',
                details: {
                    reason: error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
                    originalError: error
                }
            });
        }
        throw error;
    }
});

/**
 * プリフライトリクエスト対応
 */
export const OPTIONS = withErrorHandling(async () => {
    return NextResponse.json({ success: true, data: { message: 'OK' } });
}); 