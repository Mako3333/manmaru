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
    text: z.string().min(1, "テキスト入力は必須です"),
    mealType: z.string().optional(),
    trimester: z.number().int().min(1).max(3).optional()
});

/**
 * 食事テキスト解析API v2
 * テキスト入力から食品を認識し、栄養素を計算する
 */
export const POST = withAuthAndErrorHandling(async (req: NextRequest): Promise<StandardApiResponse<any>> => {
    // リクエストデータを取得して検証
    const requestData = await req.json();

    try {
        // スキーマ検証
        const validatedData = requestSchema.parse(requestData);
        const text = validatedData.text.trim();
        const mealType = validatedData.mealType || '食事';
        const trimester = validatedData.trimester;

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

        let foods: FoodInputParseResult[] = [];

        // 直接解析可能な形式を試みる
        const parsedFoods = FoodInputParser.parseBulkInput(text);

        if (parsedFoods.length > 0) {
            // 直接パースできた場合はその結果を使用
            foods = parsedFoods;
        } else {
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
            foods = analysisResult.parseResult.foods || [];
        }

        // 食品リストの検証
        if (foods.length === 0) {
            throw new ApiError(
                '食品が検出されませんでした',
                ErrorCode.FOOD_RECOGNITION_ERROR,
                'テキストから食品を検出できませんでした。別の入力をお試しください。',
                400
            );
        }

        // 栄養計算の実行
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);

        // 食品名と量の配列に変換
        const nameQuantityPairs = foods.map((item) => ({
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
                originalText: text,
                mealType,
                ...(trimester ? { trimester } : {}),
                nutritionResult
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