//src\hooks\useMeals.ts
import { useState } from 'react';
import {
    saveMealWithNutrients,
    getMealsByDate,
    getMealsWithNutrientsByDate,
    getMealSummaryByDateRange
} from '@/lib/supabase/client';
import { Meal, MealCreateData, MealWithNutrients, DailyMealSummary } from '@/types/meal';
import { formatDate } from '@/lib/date-utils';

/**
 * 食事データを管理するためのカスタムフック
 */
export const useMeals = () => {
    const [meals, setMeals] = useState<Meal[]>([]);
    const [mealsWithNutrients, setMealsWithNutrients] = useState<MealWithNutrients[]>([]);
    const [dailySummaries, setDailySummaries] = useState<DailyMealSummary[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * 食事データを保存する
     * @param mealData 保存する食事データ
     * @returns 保存された食事データ
     */
    const saveMeal = async (mealData: MealCreateData): Promise<Meal | null> => {
        setIsLoading(true);
        setError(null);
        try {
            // meal_nutrientsテーブルにも同時に保存するsaveMealWithNutrients関数を使用
            const savedMeal = await saveMealWithNutrients(mealData);

            if (savedMeal) {
                // 保存成功後、最新の食事リストを再取得
                if (mealData.meal_date) {
                    await fetchMealsByDate(mealData.meal_date);
                }
            }

            return savedMeal;
        } catch (err) {
            console.error('食事保存エラー:', err);
            setError('食事データの保存に失敗しました');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 指定した日付の食事データを取得する
     * @param date 取得する日付（YYYY-MM-DD形式）
     */
    const fetchMealsByDate = async (date: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const formattedDate = formatDate(new Date(date));
            const mealsData = await getMealsByDate(formattedDate);
            setMeals(mealsData);
        } catch (err) {
            console.error('食事取得エラー:', err);
            setError('食事データの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 指定した日付の食事データと栄養素データを取得する
     * @param date 取得する日付（YYYY-MM-DD形式）
     */
    const fetchMealsWithNutrientsByDate = async (date: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const formattedDate = formatDate(new Date(date));
            const mealsData = await getMealsWithNutrientsByDate(formattedDate);
            setMealsWithNutrients(mealsData);
        } catch (err) {
            console.error('食事・栄養素取得エラー:', err);
            setError('食事と栄養素データの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 指定した期間の食事データを日付ごとにまとめて取得する
     * @param startDate 開始日（YYYY-MM-DD形式）
     * @param endDate 終了日（YYYY-MM-DD形式）
     */
    const fetchMealSummaryByDateRange = async (startDate: string, endDate: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const formattedStartDate = formatDate(new Date(startDate));
            const formattedEndDate = formatDate(new Date(endDate));
            const summaries = await getMealSummaryByDateRange(formattedStartDate, formattedEndDate);
            setDailySummaries(summaries);
        } catch (err) {
            console.error('食事サマリー取得エラー:', err);
            setError('食事サマリーの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 食事タイプ別に食事データをグループ化する
     * @param mealsData 食事データの配列
     * @returns 食事タイプ別にグループ化された食事データ
     */
    const groupMealsByType = (mealsData: Meal[]) => {
        const grouped: Record<string, Meal[]> = {};

        // 先にすべてのミールタイプのキーを初期化
        const mealTypes = Array.from(new Set(mealsData.map(meal => meal.meal_type)));
        mealTypes.forEach(type => {
            grouped[type] = [];
        });

        // 各ミールをタイプごとに分類
        mealsData.forEach(meal => {
            const mealType = meal.meal_type;
            if (mealType && grouped[mealType]) {
                grouped[mealType].push(meal);
            }
        });

        return grouped;
    };

    return {
        meals,
        mealsWithNutrients,
        dailySummaries,
        isLoading,
        error,
        saveMeal,
        fetchMealsByDate,
        fetchMealsWithNutrientsByDate,
        fetchMealSummaryByDateRange,
        groupMealsByType
    };
};
