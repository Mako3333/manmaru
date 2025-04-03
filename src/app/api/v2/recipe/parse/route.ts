import { NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/api/middleware';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import type { ApiResponse } from '@/types/api';
import { z } from 'zod';
import { convertToStandardizedNutrition, convertToLegacyNutrition, createStandardizedMealNutrition } from '@/lib/nutrition/nutrition-type-utils';
import { StandardizedMealNutrition, Nutrient } from '@/types/nutrition';
import { IAIService } from '@/lib/ai/ai-service.interface';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';

// リクエストの検証スキーマ
const requestSchema = z.object({
    url: z.string().url("有効なURLを指定してください").optional(),
    text: z.string().min(1, "テキストを入力してください").optional(),
})
    .refine(data => data.url || data.text, {
        message: "URLまたはテキストのいずれか一方を指定してください",
        path: ["url", "text"], // エラーメッセージを関連付けるパス
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
        const url = validatedData.url?.trim(); // Optional chaining
        const text = validatedData.text?.trim(); // Optional chaining

        // urlもtextもない場合は refine で弾かれるはずだが念のため
        if (!url && !text) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'URLまたはテキストが必要です'
            });
        }

        // 処理時間計測開始
        const startTime = Date.now();

        // AIサービス初期化
        const aiService: IAIService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // レシピ解析の実行 (urlがあればurlを、なければtextを使用)
        let analysisResult;
        if (url) {
            analysisResult = await aiService.parseRecipeFromUrl(url);
        } else if (text) {
            analysisResult = await aiService.analyzeRecipeText(text);
        } else {
            // この分岐には到達しないはず
            throw new AppError({ code: ErrorCode.Base.API_ERROR, message: '解析対象の指定が無効です' });
        }

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
        const recipeTitle = analysisResult.parseResult.title || 'レシピ'; // デフォルト値フォールバック
        const servingsString = analysisResult.parseResult.servings || '1人分'; // デフォルト値フォールバック

        // servingsString から数値を取得 (1人前計算用)
        let servingsNum = 1;
        const match = servingsString.match(/\d+/);
        if (match) {
            const parsed = parseInt(match[0], 10);
            if (!isNaN(parsed) && parsed > 0) {
                servingsNum = parsed;
            }
        }

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

        // レガシー形式からStandardizedMealNutrition形式に変換
        const standardizedNutrition = convertToStandardizedNutrition(nutritionResult.nutrition);

        // 1人前のStandardizedMealNutrition形式を作成
        const standardizedPerServing: StandardizedMealNutrition = {
            totalCalories: standardizedNutrition.totalCalories / servingsNum,
            totalNutrients: standardizedNutrition.totalNutrients.map(nutrient => {
                const newNutrient: Nutrient = {
                    name: nutrient.name,
                    value: nutrient.value / servingsNum,
                    unit: nutrient.unit
                };
                if (nutrient.percentDailyValue !== undefined) {
                    newNutrient.percentDailyValue = nutrient.percentDailyValue / servingsNum;
                }
                return newNutrient;
            }),
            foodItems: standardizedNutrition.foodItems.map(item => {
                const newFoodItem = {
                    id: item.id,
                    name: item.name,
                    amount: item.amount / servingsNum,
                    unit: item.unit,
                    nutrition: {
                        calories: item.nutrition.calories / servingsNum,
                        nutrients: item.nutrition.nutrients.map(nutrient => {
                            const newNutrient: Nutrient = {
                                name: nutrient.name,
                                value: nutrient.value / servingsNum,
                                unit: nutrient.unit
                            };
                            if (nutrient.percentDailyValue !== undefined) {
                                newNutrient.percentDailyValue = nutrient.percentDailyValue / servingsNum;
                            }
                            return newNutrient;
                        }),
                        servingSize: item.nutrition.servingSize
                    }
                };
                return newFoodItem;
            })
        };

        // オプショナルプロパティを別途追加（型エラー回避のため）
        if (standardizedNutrition.pregnancySpecific) {
            standardizedPerServing.pregnancySpecific = {
                folatePercentage: standardizedNutrition.pregnancySpecific.folatePercentage / servingsNum,
                ironPercentage: standardizedNutrition.pregnancySpecific.ironPercentage / servingsNum,
                calciumPercentage: standardizedNutrition.pregnancySpecific.calciumPercentage / servingsNum
            };
        }

        // レガシー形式の1人前データも作成（後方互換性のため）
        const legacyPerServing = {
            calories: nutritionResult.nutrition.calories / servingsNum,
            protein: nutritionResult.nutrition.protein / servingsNum,
            iron: nutritionResult.nutrition.iron / servingsNum,
            folic_acid: nutritionResult.nutrition.folic_acid / servingsNum,
            calcium: nutritionResult.nutrition.calcium / servingsNum,
            vitamin_d: nutritionResult.nutrition.vitamin_d / servingsNum,
            confidence_score: nutritionResult.nutrition.confidence_score,
            ...(nutritionResult.nutrition.extended_nutrients
                ? {
                    extended_nutrients: Object.entries(nutritionResult.nutrition.extended_nutrients).reduce(
                        (acc, [key, value]) => {
                            if (typeof value === 'number') {
                                return { ...acc, [key]: value / servingsNum };
                            } else if (typeof value === 'object' && value !== null) {
                                return {
                                    ...acc,
                                    [key]: Object.entries(value).reduce(
                                        (subAcc, [subKey, subValue]) => ({
                                            ...subAcc,
                                            [subKey]: (subValue as number) / servingsNum
                                        }),
                                        {}
                                    )
                                };
                            }
                            return acc;
                        },
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
                    servings: servingsString, // AIからの解析結果(文字列) or デフォルト値
                    ingredients: ingredients,
                    sourceUrl: url
                },
                nutritionResult: {
                    nutrition: standardizedNutrition,
                    reliability: nutritionResult.reliability,
                    matchResults: nutritionResult.matchResults,
                    legacyNutrition: nutritionResult.nutrition, // 後方互換性のために保持
                    perServing: standardizedPerServing,
                    legacyPerServing: legacyPerServing // 後方互換性のために保持
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