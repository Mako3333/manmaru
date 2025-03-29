import { NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/api/middleware';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import type { ApiResponse } from '@/types/api';
import { z } from 'zod';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';

// リクエストの検証スキーマ
const requestSchema = z.object({
    url: z.string().url("有効なURLを指定してください"),
});

/**
 * レシピ解析API v2
 * レシピURLからレシピデータを解析し、栄養素を計算する
 */
export const POST = withErrorHandling(async (req: NextRequest): Promise<ApiResponse<any>> => {
    // リクエストデータを取得して検証
    const requestData = await req.json();

    try {
        // スキーマ検証
        const validatedData = requestSchema.parse(requestData);
        const url = validatedData.url.trim();

        // 処理時間計測開始
        const startTime = Date.now();

        // AIサービス初期化
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // レシピ解析の実行
        const analysisResult = await aiService.analyzeRecipeText(url);

        if (analysisResult.error) {
            throw new AppError({
                code: ErrorCode.AI.ANALYSIS_ERROR,
                message: 'レシピ解析に失敗しました',
                details: {
                    reason: analysisResult.error || 'レシピ解析中にエラーが発生しました',
                    originalError: analysisResult.error
                }
            });
        }

        // 解析結果から食品リストを取得
        const ingredients = analysisResult.parseResult.foods || [];
        const recipeTitle = 'レシピ'; // デフォルトタイトル
        const servings = 1; // デフォルトの人数

        // 材料リストの検証
        if (ingredients.length === 0) {
            throw new AppError({
                code: ErrorCode.Nutrition.FOOD_NOT_FOUND,
                message: '材料が検出されませんでした',
                details: { reason: 'レシピから材料を検出できませんでした。別のレシピをお試しください。' }
            });
        }

        // 栄養計算の実行
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);

        // 食品名と量の配列に変換
        const nameQuantityPairs = ingredients.map((item: FoodInputParseResult) => ({
            name: item.foodName,
            quantity: item.quantityText || undefined
        })) as Array<{ name: string; quantity?: string }>;

        // 材料から栄養計算を実行
        const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);

        // 1人前の栄養素量を計算
        const perServing = {
            calories: nutritionResult.nutrition.calories / servings,
            protein: nutritionResult.nutrition.protein / servings,
            iron: nutritionResult.nutrition.iron / servings,
            folic_acid: nutritionResult.nutrition.folic_acid / servings,
            calcium: nutritionResult.nutrition.calcium / servings,
            vitamin_d: nutritionResult.nutrition.vitamin_d / servings,
            ...(nutritionResult.nutrition.extended_nutrients
                ? {
                    extended_nutrients: Object.entries(nutritionResult.nutrition.extended_nutrients).reduce(
                        (acc, [key, value]) => ({ ...acc, [key]: (value as number) / servings }),
                        {}
                    )
                }
                : {})
        };

        // 結果を返却
        let warningMessage;
        if (nutritionResult.reliability.confidence < 0.7) {
            warningMessage = '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }

        return {
            success: true,
            data: {
                recipe: {
                    title: recipeTitle,
                    servings: servings,
                    ingredients: ingredients,
                    sourceUrl: url
                },
                nutritionResult: {
                    ...nutritionResult,
                    perServing
                }
            },
            meta: {
                processingTimeMs: Date.now() - startTime,
                ...(warningMessage ? { warning: warningMessage } : {})
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