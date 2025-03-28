import { NextRequest } from 'next/server';
import { RecipeService } from '@/lib/services/recipe-service';
import { withAuthAndErrorHandling, createSuccessResponse } from '@/lib/util/api-middleware';
import { validateRequestData } from '@/lib/util/request-validation';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';
import { NutritionErrorHandler } from '@/lib/nutrition/nutrition-error-handler';
import { RecipeIngredient, NutritionData } from '@/types/recipe';

/**
 * レシピURL解析API v2
 * 
 * レシピURLからデータを解析し、新しい栄養計算システムで栄養素を計算します
 */
export const POST = withAuthAndErrorHandling(async (req: NextRequest) => {
    // リクエストデータを取得
    const requestData = await req.json();

    // リクエストデータを検証
    if (!requestData.url || typeof requestData.url !== 'string') {
        throw new Error('URLを指定してください');
    }

    const { url } = requestData;
    const startTime = Date.now();

    try {
        // レシピサービスを使用してURLからレシピデータを解析
        const recipeData = await RecipeService.parseRecipeFromUrl(url);

        // レシピに材料が含まれている場合は新しい栄養計算システムを使用
        if (recipeData.ingredients && recipeData.ingredients.length > 0) {
            // 食品名と量のペアに変換
            const nameQuantityPairs = recipeData.ingredients.map((ing: RecipeIngredient) => ({
                name: ing.name,
                quantity: ing.quantity || '1人前'
            }));

            // 栄養計算サービスを取得
            const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
            const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);
            const matchingService = FoodMatchingServiceFactory.getService();

            // 栄養素を計算
            const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);

            // 警告メッセージの設定
            let warningMessage;
            if (nutritionResult.reliability.confidence < 0.7) {
                warningMessage = '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
            }

            // 結果を栄養素データに反映（NutritionDataの形式に変換）
            // nullishチェックを行い、undefinedの場合はデフォルト値を設定
            const energy = nutritionResult.nutrients.energy ?? 0;
            const protein = nutritionResult.nutrients.protein ?? 0;
            const iron = nutritionResult.nutrients.minerals?.iron ?? 0;
            const folicAcid = nutritionResult.nutrients.vitamins?.folicAcid ?? 0;
            const calcium = nutritionResult.nutrients.minerals?.calcium ?? 0;
            const vitaminD = nutritionResult.nutrients.vitamins?.vitaminD ?? 0;

            // 確実に数値型として設定
            recipeData.nutrition_per_serving = {
                calories: energy,
                protein: protein,
                iron: iron,
                folic_acid: folicAcid,
                calcium: calcium,
                vitamin_d: vitaminD
            };

            // 結果を返却（警告メッセージ付き）
            return createSuccessResponse({
                ...recipeData,
                calculationReliability: nutritionResult.reliability,
                processingTimeMs: Date.now() - startTime
            }, warningMessage);
        }

        // 材料がない場合はそのまま返却
        return createSuccessResponse({
            ...recipeData,
            processingTimeMs: Date.now() - startTime
        });
    } catch (error) {
        // エラーを栄養計算エラーとして処理
        throw NutritionErrorHandler.handleCalculationError(
            error,
            []
        );
    }
});

/**
 * プリフライトリクエスト対応
 */
export const OPTIONS = withAuthAndErrorHandling(async () => {
    return createSuccessResponse({ message: 'OK' });
}, false); 