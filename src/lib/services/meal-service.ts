//src\lib\services\meal-service.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { validateMealData } from '@/lib/nutrition/nutrition-utils';
import { StandardizedMealNutrition, NutritionData } from '@/types/nutrition';
import { convertToDbNutritionFormat, convertDbFormatToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';

/**
 * 食事データの保存リクエスト型
 */
export interface SaveMealRequest {
    user_id: string;
    meal_type: string;
    meal_date: string;
    photo_url?: string;
    food_description?: string;
    nutrition_data?: StandardizedMealNutrition;
    servings?: number;
}

/**
 * 食事データの栄養情報型
 */
export interface SaveMealNutritionRequest {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d?: number;
    confidence_score?: number;
}

/**
 * 食事サービスクラス
 * 食事データの保存と取得を管理
 */
export class MealService {
    /**
     * 食事データと栄養データをトランザクション的に保存
     * @param supabase Supabaseクライアント
     * @param mealData 食事データ (nutrition_dataはStandardizedMealNutrition型)
     * @returns 保存された食事データのID
     */
    static async saveMealWithNutrition(
        supabase: SupabaseClient,
        mealData: SaveMealRequest
    ): Promise<{ id: string }> {
        try {
            // データ検証
            const { isValid, errors } = this.validateData(mealData);
            if (!isValid) {
                throw new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: `入力データの検証に失敗しました: ${errors.join(', ')}`,
                    userMessage: '入力データが無効です。入力内容を確認してください。',
                    details: { validationErrors: errors }
                });
            }

            // StandardizedMealNutritionをDB保存用のフォーマットに変換
            let dbNutritionData = null;
            if (mealData.nutrition_data) {
                // nutrition_dataが存在することを確認
                if (
                    typeof mealData.nutrition_data !== 'object' ||
                    !mealData.nutrition_data ||
                    typeof mealData.nutrition_data.totalCalories !== 'number' ||
                    !Array.isArray(mealData.nutrition_data.totalNutrients) ||
                    !Array.isArray(mealData.nutrition_data.foodItems) ||
                    typeof mealData.nutrition_data.reliability !== 'object' ||
                    typeof mealData.nutrition_data.reliability.confidence !== 'number'
                ) {
                    throw new AppError({
                        code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                        message: 'nutrition_dataがStandardizedMealNutrition形式ではありません',
                        userMessage: '栄養データの形式が正しくありません。',
                        details: { providedData: mealData.nutrition_data }
                    });
                }

                // DB保存用のフォーマットに変換
                dbNutritionData = convertToDbNutritionFormat(mealData.nutrition_data);

                // 変換結果の確認
                if (!dbNutritionData) {
                    throw new AppError({
                        code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                        message: 'nutrition_dataのDB形式への変換に失敗しました',
                        userMessage: '栄養データの処理中にエラーが発生しました。',
                        details: { originalData: mealData.nutrition_data }
                    });
                }
            }

            // 食事データ保存
            const { data: savedMeal, error: mealError } = await supabase
                .from('meals')
                .insert({
                    user_id: mealData.user_id,
                    meal_type: mealData.meal_type,
                    meal_date: mealData.meal_date,
                    photo_url: mealData.photo_url,
                    food_description: mealData.food_description,
                    nutrition_data: dbNutritionData,
                    servings: mealData.servings || 1
                })
                .select('id')
                .single();

            if (mealError) {
                throw new AppError({
                    code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                    message: `食事データの保存に失敗しました: ${mealError.message}`,
                    userMessage: '食事データの保存中にデータベースエラーが発生しました。',
                    originalError: mealError,
                    details: { dbError: mealError }
                });
            }

            return { id: savedMeal.id };
        } catch (error) {
            if (error instanceof AppError) {
                // すでに AppError の場合はそのままスロー
                throw error;
            }

            console.error('Unexpected error in saveMealWithNutrition:', error);
            // AppError でない場合は UNKNOWN_ERROR としてラップしてスロー
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: `食事保存中に予期せぬエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: '食事データの保存中に予期しない問題が発生しました。',
                originalError: error instanceof Error ? error : undefined,
                details: { originalError: error }
            });
        }
    }

    /**
     * 入力データの検証
     * @param mealData 
     * @returns 検証結果
     */
    private static validateData(
        mealData: SaveMealRequest
    ): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 必須フィールドの確認
        if (!mealData.user_id) errors.push('ユーザーIDが必要です');
        if (!mealData.meal_date) errors.push('食事日時が必要です');
        if (!mealData.meal_type) errors.push('食事タイプが必要です');

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 特定のユーザーの食事を日付で取得
     * @param supabase Supabaseクライアント
     * @param userId ユーザーID
     * @param date 日付（YYYY-MM-DD形式）
     * @returns その日の食事リスト
     */
    static async getMealsByDate(
        supabase: SupabaseClient,
        userId: string,
        date: string
    ) {
        try {
            // 指定日の食事データを取得
            const { data: meals, error: mealsError } = await supabase
                .from('meals')
                .select(`*`)
                .eq('user_id', userId)
                .eq('meal_date', date)
                .order('created_at', { ascending: false });

            if (mealsError) {
                throw new AppError({
                    code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                    message: `食事データの取得に失敗しました: ${mealsError.message}`,
                    userMessage: '食事データの取得中にデータベースエラーが発生しました。',
                    originalError: mealsError,
                    details: { dbError: mealsError }
                });
            }

            // 栄養データを標準化フォーマットに変換
            if (meals && meals.length > 0) {
                return meals.map(meal => {
                    if (meal.nutrition_data) {
                        // DB形式からStandardizedMealNutrition形式に変換
                        const standardizedNutrition = convertDbFormatToStandardizedNutrition(meal.nutrition_data);
                        return {
                            ...meal,
                            nutrition_data: standardizedNutrition
                        };
                    }
                    return meal;
                });
            }

            return meals;
        } catch (error) {
            if (error instanceof AppError) {
                // すでに AppError の場合はそのままスロー
                throw error;
            }

            console.error('Unexpected error in getMealsByDate:', error);
            // AppError でない場合は UNKNOWN_ERROR としてラップしてスロー
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: `食事データの取得中に予期せぬエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: '食事データの取得中に予期しない問題が発生しました。',
                originalError: error instanceof Error ? error : undefined,
                details: { originalError: error }
            });
        }
    }

    /**
     * 食事データを削除する
     * @param supabase Supabaseクライアント
     * @param mealId 食事ID
     * @param userId ユーザーID
     * @returns 削除が成功したかどうか
     */
    static async deleteMeal(
        supabase: SupabaseClient,
        mealId: string,
        userId: string
    ): Promise<boolean> {
        try {
            // 対象の食事データを取得して権限チェック
            const { data: mealData, error: fetchError } = await supabase
                .from('meals')
                .select('id, user_id')
                .eq('id', mealId)
                .single();

            if (fetchError) {
                if (fetchError.code === 'PGRST116') { // データが見つからない
                    throw new AppError({
                        code: ErrorCode.Base.DATA_NOT_FOUND,
                        message: `指定された食事データ(ID: ${mealId})が見つかりません`,
                        userMessage: '指定された食事データが見つかりません。',
                        details: { mealId }
                    });
                }
                throw new AppError({
                    code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                    message: `食事データの取得に失敗しました: ${fetchError.message}`,
                    userMessage: '食事データの取得中にデータベースエラーが発生しました。',
                    originalError: fetchError,
                    details: { dbError: fetchError }
                });
            }

            // 権限チェック
            if (!mealData || mealData.user_id !== userId) {
                throw new AppError({
                    code: ErrorCode.Base.AUTH_ERROR,
                    message: `食事データの削除権限がありません(ID: ${mealId}, 要求元ユーザー: ${userId})`,
                    userMessage: 'この食事データを削除する権限がありません。',
                    details: { mealId, requestUserId: userId, actualUserId: mealData?.user_id }
                });
            }

            // データ削除
            const { error: deleteError } = await supabase
                .from('meals')
                .delete()
                .eq('id', mealId);

            if (deleteError) {
                throw new AppError({
                    code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                    message: `食事データの削除に失敗しました: ${deleteError.message}`,
                    userMessage: '食事データの削除中にデータベースエラーが発生しました。',
                    originalError: deleteError,
                    details: { dbError: deleteError }
                });
            }

            return true;
        } catch (error) {
            if (error instanceof AppError) {
                // すでに AppError の場合はそのままスロー
                throw error;
            }

            console.error('Unexpected error in deleteMeal:', error);
            // AppError でない場合は UNKNOWN_ERROR としてラップしてスロー
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: `食事データの削除中に予期せぬエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: '食事データの削除中に予期しない問題が発生しました。',
                originalError: error instanceof Error ? error : undefined,
                details: { originalError: error }
            });
        }
    }
} 