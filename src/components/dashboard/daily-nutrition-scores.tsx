"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { addDaysToDate, formatDate } from '@/lib/date-utils';

interface NutritionScore {
    date: string;
    score: number;
    nutrients: {
        [key: string]: {
            score: number;
            percentage: number;
        };
    };
}

interface DailyNutritionScoresProps {
    userId: string;
}

export default function DailyNutritionScores({ userId }: DailyNutritionScoresProps) {
    const [scores, setScores] = useState<NutritionScore[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchNutritionScores() {
            try {
                setLoading(true);

                // 過去7日間の日付を取得
                const dates = Array.from({ length: 7 }, (_, i) => {
                    return formatDate(addDaysToDate(-i));
                });

                // 日付ごとに栄養データを取得
                const scorePromises = dates.map(async (date) => {
                    const { data, error } = await supabase
                        .from('nutrition_goal_prog')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('meal_date', date)
                        .single();

                    if (error && error.code !== 'PGRST116') {
                        console.error(`${date}の栄養データ取得エラー:`, error);
                        return null;
                    }

                    if (!data) {
                        // データがない場合は空のスコアを返す
                        return {
                            date,
                            score: 0,
                            nutrients: {
                                calories: { score: 0, percentage: 0 },
                                protein: { score: 0, percentage: 0 },
                                iron: { score: 0, percentage: 0 },
                                folic_acid: { score: 0, percentage: 0 },
                                calcium: { score: 0, percentage: 0 },
                                vitamin_d: { score: 0, percentage: 0 }
                            }
                        };
                    }

                    // 栄養素ごとのスコアと達成率を計算
                    const nutrients: Record<string, { score: number; percentage: number }> = {};
                    let totalScore = 0;

                    const nutritionKeys = ['calories', 'protein', 'iron', 'folic_acid', 'calcium', 'vitamin_d'];

                    nutritionKeys.forEach(key => {
                        if (data[key]) {
                            const percentage = Math.min(100, (data[key].current / data[key].goal) * 100);
                            // スコアは0〜10の範囲で、達成率に応じて計算
                            const score = Math.round(percentage / 10);

                            nutrients[key] = {
                                score,
                                percentage
                            };

                            totalScore += score;
                        } else {
                            nutrients[key] = { score: 0, percentage: 0 };
                        }
                    });

                    // 総合スコアは栄養素スコアの平均（0〜10）
                    const overallScore = Math.round(totalScore / nutritionKeys.length);

                    return {
                        date,
                        score: overallScore,
                        nutrients
                    };
                });

                const scoreResults = await Promise.all(scorePromises);
                setScores(scoreResults.filter(Boolean) as NutritionScore[]);

            } catch (error) {
                console.error("Error fetching daily scores:", error);
                setError(
                    error instanceof Error
                        ? error.message
                        : "スコア履歴の取得に失敗しました。"
                );
            } finally {
                setLoading(false);
            }
        }

        fetchNutritionScores();
    }, [userId]);

    // スコアに基づいて色を取得
    const getScoreColor = (score: number) => {
        if (score >= 8) return 'bg-green-500';
        if (score >= 6) return 'bg-green-400';
        if (score >= 4) return 'bg-yellow-400';
        if (score >= 2) return 'bg-orange-400';
        return 'bg-red-400';
    };

    // 曜日を取得
    const getDayOfWeek = (dateString: string) => {
        const date = new Date(dateString);
        return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    };

    // 日付を短い形式に変換（MM/DD）
    const formatShortDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    if (loading) {
        return <div className="text-center p-4">読み込み中...</div>;
    }

    if (error) {
        return <div className="text-center text-red-500 p-4">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <h3 className="text-base font-medium">過去7日間の栄養スコア</h3>

            <div className="grid grid-cols-7 gap-2 mb-4">
                {scores.map((dayScore) => (
                    <div key={dayScore.date} className="text-center">
                        <div className="text-xs text-gray-500 mb-1">{getDayOfWeek(dayScore.date)}</div>
                        <div className="text-xs text-gray-500 mb-2">{formatShortDate(dayScore.date)}</div>
                        <div className="relative mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <div className={`absolute inset-0 rounded-full ${getScoreColor(dayScore.score)} opacity-20`}></div>
                            <span className="text-xl font-semibold">{dayScore.score}</span>
                        </div>
                    </div>
                ))}
            </div>

            <h3 className="text-base font-medium mt-6 mb-3">栄養素別の達成状況</h3>

            {/* 最新日のデータを使用 */}
            {scores.length > 0 && scores[0]?.nutrients && (
                <div className="space-y-3">
                    {Object.entries(scores[0].nutrients).map(([nutrient, data]) => {
                        const nutrientNames: Record<string, string> = {
                            calories: 'カロリー',
                            protein: 'タンパク質',
                            iron: '鉄分',
                            folic_acid: '葉酸',
                            calcium: 'カルシウム',
                            vitamin_d: 'ビタミンD'
                        };

                        return (
                            <div key={nutrient} className="bg-white rounded-lg p-3 shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">{nutrientNames[nutrient] || nutrient}</span>
                                    <span className="text-sm">{Math.round(data.percentage)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                    <div
                                        className={`h-2 rounded-full ${getScoreColor(data.score)}`}
                                        style={{ width: `${data.percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
} 