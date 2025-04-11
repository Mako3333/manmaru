import { createClient } from '@supabase/supabase-js'
import {
    NutritionData,
    BasicNutritionData,
    NutritionTarget,
    NutritionProgress,
    MealNutrient,
    DailyNutritionLog,
    NutritionAdvice,
    StandardizedMealNutrition,
    Nutrient
} from '@/types/nutrition';
import {
    Meal,
    MealCreateData,
    MealWithNutrients,
    DailyMealSummary
} from '@/types/meal';
import {
    UserProfile,
    ProfileUpdateData,
    WeightLog,
    WeightLogCreateData
} from '@/types/user';
import {
    convertToStandardizedNutrition,
    convertToDbNutritionFormat,
    convertDbFormatToStandardizedNutrition
} from "@/lib/nutrition/nutrition-type-utils";
import { AppError, ErrorCode } from '@/lib/error';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ユーザー関連の関数
// =========================================================

/**
 * ユーザープロファイルを取得する
 * @returns ユーザープロファイル
 */
export const getUserProfile = async (): Promise<UserProfile | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('プロファイル取得エラー:', error);
        return null;
    }
};

/**
 * ユーザープロファイルを更新する
 * @param profileData 更新するプロファイルデータ
 * @returns 更新されたプロファイル
 */
export const updateUserProfile = async (profileData: ProfileUpdateData): Promise<UserProfile | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({
                ...profileData,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', session.user.id)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('プロファイル更新エラー:', error);
        return null;
    }
};

// 食事関連の関数
// =========================================================

/**
 * 食事データを保存し、栄養素データも同時に保存する
 * @param mealData 保存する食事データ
 * @returns 保存された食事データ
 */
export const saveMealWithNutrients = async (mealData: MealCreateData): Promise<Meal | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        console.log('食事データ保存開始:', {
            meal_type: mealData.meal_type,
            meal_date: mealData.meal_date,
            foods: mealData.foods,
            nutrition: mealData.nutrition
        });

        // 栄養データの値が正しいことを確認（NaNや無効な値を修正）
        const sanitizedNutrition: NutritionData = {
            calories: isNaN(mealData.nutrition.calories) ? 0 : Math.max(0, mealData.nutrition.calories),
            protein: isNaN(mealData.nutrition.protein) ? 0 : Math.max(0, mealData.nutrition.protein),
            iron: isNaN(mealData.nutrition.iron) ? 0 : Math.max(0, mealData.nutrition.iron),
            folic_acid: isNaN(mealData.nutrition.folic_acid) ? 0 : Math.max(0, mealData.nutrition.folic_acid),
            calcium: isNaN(mealData.nutrition.calcium) ? 0 : Math.max(0, mealData.nutrition.calcium),
            vitamin_d: isNaN(mealData.nutrition.vitamin_d || 0) ? 0 : Math.max(0, mealData.nutrition.vitamin_d || 0),
            confidence_score: isNaN(mealData.nutrition.confidence_score || 0.8) ? 0.8 : Math.max(0, Math.min(1, mealData.nutrition.confidence_score || 0.8)),
            not_found_foods: []
        };

        // 1. meals テーブルに挿入
        const { data: mealRecord, error: mealError } = await supabase
            .from('meals')
            .insert({
                user_id: session.user.id,
                meal_type: mealData.meal_type,
                meal_date: mealData.meal_date || new Date().toISOString().split('T')[0],
                photo_url: mealData.photo_url || null,
                food_description: { items: mealData.foods },
                nutrition_data: sanitizedNutrition,
                servings: mealData.servings || 1
            })
            .select()
            .single();

        if (mealError) {
            console.error('meals テーブル挿入エラー:', mealError);
            throw mealError;
        }

        console.log('meals テーブル挿入成功:', mealRecord.id);

        // 2. meal_nutrients テーブルに挿入
        const { data: nutrientRecord, error: nutrientError } = await supabase
            .from('meal_nutrients')
            .insert({
                meal_id: mealRecord.id,
                calories: sanitizedNutrition.calories,
                protein: sanitizedNutrition.protein,
                iron: sanitizedNutrition.iron,
                folic_acid: sanitizedNutrition.folic_acid,
                calcium: sanitizedNutrition.calcium,
                vitamin_d: sanitizedNutrition.vitamin_d,
                confidence_score: sanitizedNutrition.confidence_score
            })
            .select();

        if (nutrientError) {
            console.error('meal_nutrients テーブル挿入エラー:', nutrientError);
            throw nutrientError;
        }

        console.log('meal_nutrients テーブル挿入成功:', nutrientRecord);
        return mealRecord;
    } catch (error) {
        console.error('食事データ保存エラー:', error);
        return null;
    }
};

/**
 * 指定した日付の食事データを取得する
 * @param date 取得する日付（YYYY-MM-DD形式）
 * @returns 食事データの配列
 */
export const getMealsByDate = async (date: string): Promise<Meal[]> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data, error } = await supabase
            .from('meals')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('meal_date', date)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('食事データ取得エラー:', error);
        return [];
    }
};

/**
 * 指定した日付の食事データと栄養素データを取得する
 * @param date 取得する日付（YYYY-MM-DD形式）
 * @returns 食事データと栄養素データを含む配列
 */
export const getMealsWithNutrientsByDate = async (date: string): Promise<MealWithNutrients[]> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data, error } = await supabase
            .from('meals')
            .select(`
        *,
        nutrients:meal_nutrients(*)
      `)
            .eq('user_id', session.user.id)
            .eq('meal_date', date)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('食事データ取得エラー:', error);
        return [];
    }
};

// DBのMeal型に StandardizedMealNutrition を追加した一時的な型
interface MealWithStandardizedNutrition extends Meal {
    nutrition: StandardizedMealNutrition | null;
}

// DailyMealSummaryのmealsプロパティの型を更新した一時的な型
interface UpdatedDailyMealSummary extends Omit<DailyMealSummary, 'meals'> {
    meals: MealWithStandardizedNutrition[];
}

/**
 * 指定した期間の食事サマリーを取得する（栄養データはStandardizedMealNutritionに変換）
 * @param startDate 開始日（YYYY-MM-DD形式）
 * @param endDate 終了日（YYYY-MM-DD形式）
 * @returns 食事サマリーの配列 (UpdatedDailyMealSummary[])
 */
export const getMealSummaryByDateRange = async (
    startDate: string,
    endDate: string
): Promise<UpdatedDailyMealSummary[]> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data: mealsData, error } = await supabase
            .from('meals')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('meal_date', startDate)
            .lte('meal_date', endDate)
            .order('meal_date', { ascending: true })
            .order('meal_type', { ascending: true });

        if (error) throw error;

        // mealsData が null または undefined の場合は空配列を返す
        if (!mealsData) {
            return [];
        }

        // DBの型 (JSONB) から StandardizedMealNutrition | null へ変換し、Meal に追加
        const mealsWithStandardizedNutrition: MealWithStandardizedNutrition[] = mealsData.map((meal) => {
            const standardizedNutrition = convertDbFormatToStandardizedNutrition(meal.nutrition_data);
            return {
                ...meal,
                nutrition: standardizedNutrition,
            };
        });

        // 日付ごとに食事をグループ化
        const mealsByDate: { [date: string]: MealWithStandardizedNutrition[] } = {};
        mealsWithStandardizedNutrition.forEach(meal => {
            const dateKey = meal.meal_date; // Use a variable for clarity
            if (!mealsByDate[dateKey]) {
                mealsByDate[dateKey] = [];
            }
            // Add non-null assertion operator '!' to assure TypeScript it's not undefined here
            mealsByDate[dateKey]!.push(meal);
        });

        // 栄養素検索ヘルパー関数
        const findNutrientValue = (nutrients: Nutrient[] | null | undefined, name: string): number => {
            if (!nutrients) return 0;
            const nutrient = nutrients.find(n => n.name === name);
            return nutrient?.value || 0;
        };

        // 日付ごとの食事データを集計
        const summaries: UpdatedDailyMealSummary[] = Object.entries(mealsByDate).map(([date, mealsInDate]) => {
            const total_nutrition: BasicNutritionData = {
                calories: mealsInDate.reduce((sum, meal) => sum + (meal.nutrition?.totalCalories || 0), 0),
                protein: mealsInDate.reduce((sum, meal) => sum + findNutrientValue(meal.nutrition?.totalNutrients, 'たんぱく質'), 0),
                iron: mealsInDate.reduce((sum, meal) => sum + findNutrientValue(meal.nutrition?.totalNutrients, '鉄'), 0),
                folic_acid: mealsInDate.reduce((sum, meal) => sum + findNutrientValue(meal.nutrition?.totalNutrients, '葉酸'), 0),
                calcium: mealsInDate.reduce((sum, meal) => sum + findNutrientValue(meal.nutrition?.totalNutrients, 'カルシウム'), 0),
                vitamin_d: mealsInDate.reduce((sum, meal) => sum + findNutrientValue(meal.nutrition?.totalNutrients, 'ビタミンD'), 0),
                confidence_score: mealsInDate.length > 0
                    ? mealsInDate.reduce((sum, meal) => sum + (meal.nutrition?.reliability?.confidence || 0), 0) / mealsInDate.length
                    : 0
            };

            return {
                date,
                meals: mealsInDate,
                total_nutrition
            };
        });

        return summaries;
    } catch (error) {
        console.error('食事サマリー取得エラー:', error);
        return [];
    }
};

// 栄養関連の関数
// =========================================================

/**
 * トライメスター別の栄養目標値を取得する
 * @param trimester トライメスター（1, 2, 3のいずれか）
 * @returns 栄養目標値
 */
export const getNutritionTargetByTrimester = async (trimester: number): Promise<NutritionTarget | null> => {
    try {
        const { data, error } = await supabase
            .from('nutrition_targets')
            .select('*')
            .eq('trimester', trimester)
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('栄養目標取得エラー:', error);
        return null;
    }
};

/**
 * 指定した日付の栄養目標進捗を取得する
 * @param date 取得する日付（YYYY-MM-DD形式）
 * @returns 栄養目標進捗データ
 */
export const getNutritionProgress = async (date: string): Promise<NutritionProgress | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data, error } = await supabase
            .from('nutrition_goal_prog')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('meal_date', date)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        return data || null;
    } catch (error) {
        console.error('栄養目標進捗取得エラー:', error);
        return null;
    }
};

/**
 * 指定した期間の栄養目標進捗を取得する
 * @param startDate 開始日（YYYY-MM-DD形式）
 * @param endDate 終了日（YYYY-MM-DD形式）
 * @returns 栄養目標進捗データの配列
 */
export const getNutritionProgressByDateRange = async (
    startDate: string,
    endDate: string
): Promise<NutritionProgress[]> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data, error } = await supabase
            .from('nutrition_goal_prog')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('meal_date', startDate)
            .lte('meal_date', endDate)
            .order('meal_date', { ascending: true });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('栄養目標進捗取得エラー:', error);
        return [];
    }
};

/**
 * 日次栄養アドバイスを取得する
 * @param date 取得する日付（YYYY-MM-DD形式）
 * @returns 栄養アドバイスの配列
 */
export const getDailyNutritionAdvice = async (date: string): Promise<NutritionAdvice[]> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data, error } = await supabase
            .from('daily_nutri_advice')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('advice_date', date)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('栄養アドバイス取得エラー:', error);
        return [];
    }
};

/**
 * 栄養アドバイスを既読にする
 * @param adviceId アドバイスID
 * @returns 成功したかどうか
 */
export const markAdviceAsRead = async (adviceId: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('daily_nutri_advice')
            .update({ is_read: true })
            .eq('id', adviceId);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('アドバイス既読更新エラー:', error);
        return false;
    }
};

/**
 * 日次栄養ログを保存または更新する
 * @param logData 栄養ログデータ (DB保存形式: NutritionData)
 * @param date 日付（YYYY-MM-DD形式）
 * @returns 保存されたログデータ
 */
export const saveDailyNutritionLog = async (
    logData: NutritionData,
    date: string,
    aiComment?: string
): Promise<DailyNutritionLog | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        // 既存のログを確認
        const { data: existingLog, error: fetchError } = await supabase
            .from('daily_nutrition_logs')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('log_date', date)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        const logToSave = {
            user_id: session.user.id,
            log_date: date,
            nutrition_data: logData,
            ai_comment: aiComment,
        };

        if (existingLog) {
            // 更新
            const { data, error } = await supabase
                .from('daily_nutrition_logs')
                .update(logToSave)
                .eq('id', existingLog.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            // 新規作成
            const { data, error } = await supabase
                .from('daily_nutrition_logs')
                .insert(logToSave)
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    } catch (error) {
        console.error('日次栄養ログ保存エラー:', error);
        return null;
    }
};

// 体重記録関連の関数
// =========================================================

/**
 * 体重記録を保存する
 * @param weightData 体重記録データ
 * @returns 保存された体重記録
 */
export const saveWeightLog = async (weightData: WeightLogCreateData): Promise<WeightLog | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data, error } = await supabase
            .from('weight_logs')
            .upsert({
                user_id: session.user.id,
                log_date: weightData.log_date || new Date().toISOString().split('T')[0],
                weight: weightData.weight,
                comment: weightData.comment
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('体重記録保存エラー:', error);
        return null;
    }
};

/**
 * 指定した期間の体重記録を取得する
 * @param startDate 開始日（YYYY-MM-DD形式）
 * @param endDate 終了日（YYYY-MM-DD形式）
 * @returns 体重記録の配列
 */
export const getWeightLogsByDateRange = async (
    startDate: string,
    endDate: string
): Promise<WeightLog[]> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data, error } = await supabase
            .from('weight_logs')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('log_date', startDate)
            .lte('log_date', endDate)
            .order('log_date', { ascending: true });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('体重記録取得エラー:', error);
        return [];
    }
};

/**
 * 最新の体重記録を取得する
 * @returns 最新の体重記録
 */
export const getLatestWeightLog = async (): Promise<WeightLog | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new AppError({
                code: ErrorCode.Base.AUTH_ERROR,
                message: 'ログインセッションが無効です',
                userMessage: '認証情報が見つかりません。再度ログインしてください。'
            });
        }

        const { data, error } = await supabase
            .from('weight_logs')
            .select('*')
            .eq('user_id', session.user.id)
            .order('log_date', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        return data || null;
    } catch (error) {
        console.error('体重記録取得エラー:', error);
        return null;
    }
};