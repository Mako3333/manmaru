import { NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/api/middleware';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodInputParser, FoodInputParseResult } from '@/lib/food/food-input-parser';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import type { ApiResponse } from '@/types/api';
import type { MealAnalysisResult } from '@/types/ai';
import { z } from 'zod';
import { convertToStandardizedNutrition, convertToLegacyNutrition } from '@/lib/nutrition/nutrition-type-utils';

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
export const POST = withErrorHandling(async (req: NextRequest): Promise<any> => {
    // リクエストデータを取得して検証
    const requestData = await req.json();

    try {
        // スキーマ検証
        const validatedData = requestSchema.parse(requestData);
        const imageData = validatedData.image;
        const mealType = validatedData.mealType || '食事';
        const trimester = validatedData.trimester;

        if (!imageData.startsWith('data:image/')) {
            throw new AppError({
                code: ErrorCode.File.INVALID_IMAGE, // 画像関連のエラーコードに変更
                message: '無効な画像形式です',
                details: { reason: '画像データはbase64エンコードされたものである必要があります' }
            });
        }

        // Base64画像データからバイナリに変換 (image/analyzeからコピー)
        const base64Data = imageData.split(',')[1];
        if (!base64Data) {
            throw new AppError({
                code: ErrorCode.File.INVALID_IMAGE,
                message: 'Base64データの解析に失敗しました',
                details: { reason: '画像データからBase64部分を抽出できませんでした' }
            });
        }
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // 処理時間計測開始
        const startTime = Date.now();

        // AIサービス初期化
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // AIによる画像解析 (戻り値の型を MealAnalysisResult に)
        const analysisResult: MealAnalysisResult = await aiService.analyzeMealImage(imageBuffer);

        // AI解析エラーのチェック
        if (analysisResult.error) {
            throw new AppError({
                code: ErrorCode.AI.IMAGE_PROCESSING_ERROR,
                message: analysisResult.error.message || '画像解析に失敗しました',
                details: { originalError: analysisResult.error.details }
            });
        }

        // 解析結果から食品リストを取得
        const foods = analysisResult.foods || [];

        // 食品リストの検証
        if (foods.length === 0) {
            throw new AppError({
                code: ErrorCode.Nutrition.FOOD_NOT_FOUND,
                message: '食品が検出されませんでした',
                details: { reason: '画像から食品を検出できませんでした。別の画像をお試しください。' }
            });
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

        // 標準形式の栄養データを取得
        const standardizedNutrition = nutritionResult.nutrition;
        // レガシー形式も生成 (後方互換性のため)
        const legacyNutrition = convertToLegacyNutrition(standardizedNutrition);

        // 結果を返却
        let warningMessage;
        if (nutritionResult.reliability.confidence < 0.7) {
            warningMessage = '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }

        return {
            foods: nameQuantityPairs,
            mealType,
            ...(trimester ? { trimester } : {}),
            nutritionResult: {
                nutrition: standardizedNutrition,
                reliability: nutritionResult.reliability,
                matchResults: nutritionResult.matchResults,
                legacyNutrition: legacyNutrition // 生成したレガシー形式を設定
            },
            recognitionConfidence: analysisResult.confidence, // AIの信頼度を使用
            aiEstimatedNutrition: analysisResult.estimatedNutrition, // AI推定栄養素を追加
            ...(warningMessage ? { warning: warningMessage } : {})
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