"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/date-utils';

interface MealRecord {
    id: string;
    user_id: string;
    meal_date: string;
    meal_type: string;
    meal_name: string;
    food_items: string[];
    created_at: string;
}

const MEAL_TYPE_MAP: Record<string, { label: string; icon: string }> = {
    breakfast: { label: '朝食', icon: '🍳' },
    lunch: { label: '昼食', icon: '🍱' },
    dinner: { label: '夕食', icon: '🍽️' },
    snack: { label: '間食', icon: '🍎' }
};

interface MealHistoryListProps {
    userId: string;
}

export default function MealHistoryList({ userId }: MealHistoryListProps) {
    const [meals, setMeals] = useState<MealRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchMeals() {
            try {
                setLoading(true);

                const { data: mealRecords, error } = await supabase
                    .from('meals')
                    .select('*')
                    .eq('user_id', userId)
                    .order('meal_date', { ascending: false })
                    .limit(10);

                if (error) {
                    throw error;
                }

                setMeals(mealRecords || []);
            } catch (error) {
                console.error("Error fetching meal history:", error);
                setError(
                    error instanceof Error
                        ? error.message
                        : "食事履歴の取得に失敗しました。"
                );
            } finally {
                setLoading(false);
            }
        }

        fetchMeals();
    }, [userId]);

    // 日付ごとにグループ化する
    const mealsByDate = meals.reduce((acc: Record<string, MealRecord[]>, meal) => {
        const date = meal.meal_date;
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(meal);
        return acc;
    }, {});

    if (loading) {
        return <div className="text-center p-4">読み込み中...</div>;
    }

    if (error) {
        return <div className="text-center text-red-500 p-4">{error}</div>;
    }

    if (meals.length === 0) {
        return (
            <div className="text-center text-gray-500 p-8">
                <p className="mb-2">食事記録がありません</p>
                <p className="text-sm">食事を記録して、栄養状態を管理しましょう。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {Object.entries(mealsByDate).map(([date, dateMeals]) => (
                <div key={date} className="space-y-2">
                    <h3 className="font-medium text-sm text-gray-500">{date}</h3>
                    <div className="space-y-2">
                        {dateMeals.map((meal) => (
                            <Card key={meal.id} className="overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="flex items-center p-4">
                                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-xl mr-3">
                                            {MEAL_TYPE_MAP[meal.meal_type]?.icon || '🍽️'}
                                        </div>
                                        <div>
                                            <div className="flex items-center">
                                                <span className="font-medium">
                                                    {MEAL_TYPE_MAP[meal.meal_type]?.label || meal.meal_type}
                                                </span>
                                                <span className="text-xs text-gray-500 ml-2">
                                                    {new Date(meal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">{meal.meal_name}</p>
                                            {meal.food_items && meal.food_items.length > 0 && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {meal.food_items.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
} 