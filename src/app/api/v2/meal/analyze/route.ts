import { NextRequest } from 'next/server';
import { withAuthAndErrorHandling } from '@/lib/util/api-middleware';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodInputParser, FoodInputParseResult } from '@/lib/food/food-input-parser';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';
import { StandardApiResponse } from '@/types/api';
import { z } from 'zod';

// リクエストの検証スキーマ
const requestSchema = z.object({
    image: z.string().min(1, "画像データは必須です"),
    mealType: z.string().optional(),
    trimester: z.number().int().min(1).max(3).optional()
});

/**
 * 食事画像解析API v2
 * 画像から食品を認識し、栄養素を計算する
 */
export const POST = withAuthAndErrorHandling(async (req: NextRequest): Promise<StandardApiResponse<any>> => {
    // リクエストデータを取得して検証
    const requestData = await req.json();

    try {
        // スキーマ検証
        const validatedData = requestSchema.parse(requestData);
        const imageData = validatedData.image;
        const mealType = validatedData.mealType || '食事';
        const trimester = validatedData.trimester;

        if (!imageData.startsWith('data:image/')) {
            throw new ApiError(
                '無効な画像形式です',
                ErrorCode.DATA_VALIDATION_ERROR,
                '画像データはbase64エンコードされたものである必要があります',
                400
            );
        }

        // 処理時間計測開始
        const startTime = Date.now();

        // AIサービス初期化
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // 画像解析の実行
        const analysisResult = await aiService.analyzeMealImage(imageData);

        if (analysisResult.error) {
            throw new ApiError(
                '画像解析に失敗しました',
                ErrorCode.AI_ANALYSIS_ERROR,
                analysisResult.error || '画像解析中にエラーが発生しました',
                500,
                { originalError: analysisResult.error }
            );
        }

        // 解析結果から食品リストを取得
        const foods = analysisResult.parseResult.foods || [];

        // 食品リストの検証
        if (foods.length === 0) {
            throw new ApiError(
                '食品が検出されませんでした',
                ErrorCode.FOOD_RECOGNITION_ERROR,
                '画像から食品を検出できませんでした。別の画像をお試しください。',
                400
            );
        }

        // 栄養計算の実行
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);

        // 食品名と量の配列に変換
        const nameQuantityPairs = foods.map((item: FoodInputParseResult) => ({
            name: item.foodName,
            quantity: item.quantityText || undefined
        })) as Array<{ name: string; quantity?: string }>;

        // 栄養計算を実行
        const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);

        // 結果を返却
        let warningMessage;
        if (nutritionResult.reliability.confidence < 0.7) {
            warningMessage = '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }

        return {
            success: true,
            data: {
                foods: nameQuantityPairs,
                mealType,
                ...(trimester ? { trimester } : {}),
                nutritionResult,
                recognitionConfidence: analysisResult.parseResult.confidence
            },
            meta: {
                processingTimeMs: Date.now() - startTime,
                ...(warningMessage ? { warning: warningMessage } : {})
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