//src\hooks\useNutrition.ts
import { useState, useEffect } from 'react';
import {
    getNutritionProgress,
    getNutritionProgressByDateRange,
    getNutritionTargetByTrimester
} from '@/lib/supabase/client';
import { NutritionProgress, NutritionTarget, BasicNutritionData } from '@/types/nutrition';
import { formatDate, getDateRange } from '@/lib/date-utils';

/**
 * 栄養データを管理するためのカスタムフック
 */
export const useNutrition = () => {
    const [dailyProgress, setDailyProgress] = useState<NutritionProgress | null>(null);
    const [weeklyProgress, setWeeklyProgress] = useState<NutritionProgress[]>([]);
    const [nutritionTarget, setNutritionTarget] = useState<NutritionTarget | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * 指定した日付の栄養目標進捗を取得する
     * @param date 日付（YYYY-MM-DD形式）
     */
    const fetchDailyProgress = async (date: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const formattedDate = formatDate(new Date(date));
            const progress = await getNutritionProgress(formattedDate);
            setDailyProgress(progress);

            // 栄養目標がまだ取得されていない場合、トライメスターに基づいて取得
            if (progress && !nutritionTarget) {
                fetchNutritionTarget(progress.trimester);
            }
        } catch (err) {
            console.error('栄養進捗取得エラー:', err);
            setError('栄養データの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 指定した期間の栄養目標進捗を取得する
     * @param startDate 開始日（YYYY-MM-DD形式）
     * @param endDate 終了日（YYYY-MM-DD形式）
     */
    const fetchWeeklyProgress = async (startDate: string, endDate: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const formattedStartDate = formatDate(new Date(startDate));
            const formattedEndDate = formatDate(new Date(endDate));
            const progress = await getNutritionProgressByDateRange(formattedStartDate, formattedEndDate);
            setWeeklyProgress(progress);
        } catch (err) {
            console.error('週間栄養進捗取得エラー:', err);
            setError('週間栄養データの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 今週の栄養目標進捗を取得する
     */
    const fetchCurrentWeekProgress = async () => {
        const today = new Date();
        const { startDate, endDate } = getDateRange(today, 'week');
        await fetchWeeklyProgress(startDate, endDate);
    };

    /**
     * トライメスター別の栄養目標値を取得する
     * @param trimester トライメスター（1, 2, 3のいずれか）
     */
    const fetchNutritionTarget = async (trimester: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const target = await getNutritionTargetByTrimester(trimester);
            setNutritionTarget(target);
        } catch (err) {
            console.error('栄養目標取得エラー:', err);
            setError('栄養目標の取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 栄養素の不足を判定する
     * @param progress 栄養進捗データ
     * @returns 不足している栄養素の配列
     */
    const getDeficientNutrients = (progress: NutritionProgress): string[] => {
        if (!progress) return [];

        const deficientNutrients: string[] = [];

        // 70%未満を不足と判定
        if (progress.iron_percent < 70) deficientNutrients.push('iron');
        if (progress.folic_acid_percent < 70) deficientNutrients.push('folic_acid');
        if (progress.calcium_percent < 70) deficientNutrients.push('calcium');
        if (progress.vitamin_d_percent < 70) deficientNutrients.push('vitamin_d');
        if (progress.protein_percent < 70) deficientNutrients.push('protein');

        return deficientNutrients;
    };

    /**
     * 栄養バランススコアを計算する（0-100）
     * @param progress 栄養進捗データ
     * @returns 栄養バランススコア
     */
    const calculateNutritionScore = (progress: NutritionProgress): number => {
        if (!progress) return 0;

        // 各栄養素の達成率を平均化（100%を超える場合は100%とする）
        const percentages = [
            Math.min(progress.calories_percent, 100),
            Math.min(progress.protein_percent, 100),
            Math.min(progress.iron_percent, 100),
            Math.min(progress.folic_acid_percent, 100),
            Math.min(progress.calcium_percent, 100),
            Math.min(progress.vitamin_d_percent, 100)
        ];

        const sum = percentages.reduce((acc, val) => acc + val, 0);
        return Math.round(sum / percentages.length);
    };

    /**
     * 栄養素ごとの目標達成率を取得する
     * @param progress 栄養進捗データ
     * @returns 栄養素ごとの目標達成率
     */
    const getNutrientPercentages = (progress: NutritionProgress) => {
        if (!progress) return null;

        return {
            calories: progress.calories_percent,
            protein: progress.protein_percent,
            iron: progress.iron_percent,
            folic_acid: progress.folic_acid_percent,
            calcium: progress.calcium_percent,
            vitamin_d: progress.vitamin_d_percent
        };
    };

    return {
        dailyProgress,
        weeklyProgress,
        nutritionTarget,
        isLoading,
        error,
        fetchDailyProgress,
        fetchWeeklyProgress,
        fetchCurrentWeekProgress,
        fetchNutritionTarget,
        getDeficientNutrients,
        calculateNutritionScore,
        getNutrientPercentages
    };
};
