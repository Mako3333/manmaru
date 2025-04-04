//src\lib\services\meal-service.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';
import { validateMealData } from '@/lib/nutrition/nutrition-utils';
import { MealNutrient } from '@/types/nutrition';

/**
 * 食事データの保存リクエスト型
 */
export interface SaveMealRequest {
    user_id: string;
    meal_type: string;
    meal_date: string;
    photo_url?: string;
    food_description?: string;
    nutrition_data?: any;
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
     * @param mealData 食事データ
     * @param nutritionData 栄養データ（省略可）
     * @returns 保存された食事データのID
     */
    static async saveMealWithNutrition(
        supabase: SupabaseClient,
        mealData: SaveMealRequest,
        nutritionData?: SaveMealNutritionRequest
    ): Promise<{ id: string }> {
        try {
            // データ検証
            const { isValid, errors } = this.validateData(mealData, nutritionData);
            if (!isValid) {
                throw new ApiError(
                    `入力データの検証に失敗しました: ${errors.join(', ')}`,
                    ErrorCode.DATA_VALIDATION_ERROR,
                    '入力データが無効です。入力内容を確認してください。',
                    400
                );
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
                    nutrition_data: mealData.nutrition_data,
                    servings: mealData.servings || 1
                })
                .select('id')
                .single();

            if (mealError) {
                throw new ApiError(
                    `食事データの保存に失敗しました: ${mealError.message}`,
                    ErrorCode.DATA_PROCESSING_ERROR,
                    '食事データの保存中にエラーが発生しました。',
                    500,
                    { details: mealError }
                );
            }

            // 栄養データ保存（データがある場合）
            if (nutritionData && savedMeal) {
                const { error: nutrientError } = await supabase
                    .from('meal_nutrients')
                    .insert({
                        meal_id: savedMeal.id,
                        calories: nutritionData.calories,
                        protein: nutritionData.protein,
                        iron: nutritionData.iron,
                        folic_acid: nutritionData.folic_acid,
                        calcium: nutritionData.calcium,
                        vitamin_d: nutritionData.vitamin_d || 0,
                        confidence_score: nutritionData.confidence_score || 0.8
                    });

                // 栄養データの保存に失敗した場合は、食事データも削除（ロールバック）
                if (nutrientError) {
                    console.error('栄養データ保存エラー:', nutrientError);
                    // 食事データをロールバック
                    await supabase.from('meals').delete().eq('id', savedMeal.id);

                    throw new ApiError(
                        `栄養データの保存に失敗しました: ${nutrientError.message}`,
                        ErrorCode.DATA_PROCESSING_ERROR,
                        '栄養データの保存中にエラーが発生しました。',
                        500,
                        { details: nutrientError }
                    );
                }
            }

            return { id: savedMeal.id };
        } catch (error) {
            // ApiErrorはそのまま再スロー
            if (error instanceof ApiError) throw error;

            // その他のエラーはApiErrorにラップ
            throw new ApiError(
                `食事保存中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.DATA_PROCESSING_ERROR,
                '食事データの保存中にエラーが発生しました。',
                500,
                { error }
            );
        }
    }

    /**
     * 入力データの検証
     * @param mealData 
     * @param nutritionData 
     * @returns 検証結果
     */
    private static validateData(
        mealData: SaveMealRequest,
        nutritionData?: SaveMealNutritionRequest
    ): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 必須フィールドの確認
        if (!mealData.user_id) errors.push('ユーザーIDが必要です');
        if (!mealData.meal_date) errors.push('食事日時が必要です');
        if (!mealData.meal_type) errors.push('食事タイプが必要です');

        // 栄養データの確認（存在する場合）
        if (nutritionData) {
            if (typeof nutritionData.calories !== 'number' || nutritionData.calories < 0) {
                errors.push('カロリーは0以上の数値である必要があります');
            }
            if (typeof nutritionData.protein !== 'number' || nutritionData.protein < 0) {
                errors.push('タンパク質は0以上の数値である必要があります');
            }
            if (typeof nutritionData.iron !== 'number' || nutritionData.iron < 0) {
                errors.push('鉄分は0以上の数値である必要があります');
            }
            if (typeof nutritionData.folic_acid !== 'number' || nutritionData.folic_acid < 0) {
                errors.push('葉酸は0以上の数値である必要があります');
            }
            if (typeof nutritionData.calcium !== 'number' || nutritionData.calcium < 0) {
                errors.push('カルシウムは0以上の数値である必要があります');
            }
        }

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
                .select(`
          *,
          meal_nutrients(*)
        `)
                .eq('user_id', userId)
                .eq('meal_date', date)
                .order('created_at', { ascending: false });

            if (mealsError) {
                throw new ApiError(
                    `食事データの取得に失敗しました: ${mealsError.message}`,
                    ErrorCode.DATA_PROCESSING_ERROR,
                    '食事データの取得中にエラーが発生しました。',
                    500
                );
            }

            return meals;
        } catch (error) {
            if (error instanceof ApiError) throw error;

            throw new ApiError(
                `食事データの取得中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.DATA_PROCESSING_ERROR,
                '食事データの取得中にエラーが発生しました。',
                500
            );
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
                    throw new ApiError(
                        `指定された食事データ(ID: ${mealId})が見つかりません`,
                        ErrorCode.DATA_NOT_FOUND,
                        '指定された食事データが見つかりません。',
                        404
                    );
                }

                throw new ApiError(
                    `食事データ取得エラー: ${fetchError.message}`,
                    ErrorCode.DATA_PROCESSING_ERROR,
                    '食事データの取得中にエラーが発生しました。',
                    500
                );
            }

            // 権限チェック
            if (mealData.user_id !== userId) {
                throw new ApiError(
                    `権限エラー: ユーザー(${userId})は食事(${mealId})を削除する権限がありません`,
                    ErrorCode.AUTH_INVALID,
                    'この食事データを削除する権限がありません。',
                    403
                );
            }

            // 関連する栄養データを削除
            const { error: nutrientDeleteError } = await supabase
                .from('meal_nutrients')
                .delete()
                .eq('meal_id', mealId);

            if (nutrientDeleteError) {
                console.error('栄養データ削除エラー:', nutrientDeleteError);
                // エラーが発生したが、食事データの削除は続行する
            }

            // 食事データを削除
            const { error: mealDeleteError } = await supabase
                .from('meals')
                .delete()
                .eq('id', mealId);

            if (mealDeleteError) {
                throw new ApiError(
                    `食事データ削除エラー: ${mealDeleteError.message}`,
                    ErrorCode.DATA_PROCESSING_ERROR,
                    '食事データの削除中にエラーが発生しました。',
                    500
                );
            }

            return true;
        } catch (error) {
            // ApiErrorはそのまま再スロー
            if (error instanceof ApiError) throw error;

            // その他のエラーはApiErrorにラップ
            throw new ApiError(
                `食事削除中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.DATA_PROCESSING_ERROR,
                '食事データの削除中にエラーが発生しました。',
                500,
                { error }
            );
        }
    }
} 