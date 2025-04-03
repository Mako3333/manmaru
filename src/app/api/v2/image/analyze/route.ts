import { NextRequest } from 'next/server';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { FoodInputParser } from '@/lib/food/food-input-parser';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { withErrorHandling } from '@/lib/api/middleware';
import { validateRequestData, validateImageData } from '@/lib/utils/request-validation';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import type { ApiResponse } from '@/types/api';
import { z } from 'zod';
import { convertToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';

/**
 * 画像解析API v2
 * 
 * 食事画像を解析し、新しい栄養計算システムで栄養素を計算します
 */
const requestSchema = z.object({
    image: z.string().min(1, "画像データは必須です"),
});

export const POST = withErrorHandling(async (req: NextRequest): Promise<any> => {
    // リクエストデータを取得
    const requestData = await req.json();

    try {
        // リクエストデータを検証
        const validatedData = requestSchema.parse(requestData);
        const imageData = validatedData.image;
        const startTime = Date.now();

        if (!imageData || !imageData.startsWith('data:image/')) {
            throw new AppError({
                code: ErrorCode.File.INVALID_IMAGE,
                message: '無効な画像形式です',
                details: { reason: '画像データはbase64エンコードされた文字列である必要があります' }
            });
        }

        // Base64画像データからバイナリに変換
        const base64Data = imageData.split(',')[1];
        if (!base64Data) {
            throw new AppError({
                code: ErrorCode.File.INVALID_IMAGE,
                message: 'Base64データの解析に失敗しました',
                details: { reason: '画像データからBase64部分を抽出できませんでした' }
            });
        }
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // AIサービスを取得
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // 画像解析を実行
        const analysisResult = await aiService.analyzeMealImage(imageBuffer);

        // エラーチェック
        if (analysisResult.error) {
            throw new AppError({
                code: ErrorCode.AI.IMAGE_PROCESSING_ERROR,
                message: '画像解析に失敗しました',
                details: {
                    reason: analysisResult.error || '画像解析中にエラーが発生しました',
                    originalError: analysisResult.error
                }
            });
        }

        const foods = analysisResult.parseResult.foods;
        if (!foods || foods.length === 0) {
            throw new AppError({
                code: ErrorCode.AI.PARSING_ERROR,
                message: 'AI応答から食品を検出できませんでした',
                details: { reason: `AI応答: "${analysisResult.rawResponse || '応答なし'}"` }
            });
        }

        // 栄養計算サービスを取得
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);

        // 食品名と量のペアを生成
        const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(foods);

        // 栄養素を計算
        const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);

        // レガシー形式からStandardizedMealNutrition形式に変換
        const standardizedNutrition = convertToStandardizedNutrition(nutritionResult.nutrition);

        // 警告メッセージの設定
        let warningMessage;
        if (nutritionResult.reliability.confidence < 0.7) {
            warningMessage = '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }

        // 結果を返却 (dataプロパティの中身だけを返す)
        return {
            foods: foods,
            nutritionResult: {
                nutrition: standardizedNutrition,
                reliability: nutritionResult.reliability,
                matchResults: nutritionResult.matchResults,
                legacyNutrition: nutritionResult.nutrition // 後方互換性のために保持
            },
            processingTimeMs: analysisResult.processingTimeMs // AI処理時間も返す
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
        // AppErrorはそのままスロー
        if (error instanceof AppError) {
            throw error;
        }
        // その他の予期せぬエラー
        throw new AppError({
            code: ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR, // 栄養計算中のエラーとみなす
            message: '栄養計算中に予期せぬエラーが発生しました',
            details: { originalError: error instanceof Error ? error.message : String(error) },
            originalError: error instanceof Error ? error : undefined
        });
    }
});

/**
 * プリフライトリクエスト対応
 */
export const OPTIONS = withErrorHandling(async () => {
    return { success: true, data: { message: 'OK' } };
}); 