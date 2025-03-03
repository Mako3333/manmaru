'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NutritionProgress } from '@/types/nutrition';

// 色定義
const COLORS = {
    deficient: '#ef4444', // 赤: 不足(<70%)
    slightlyDeficient: '#f59e0b', // 黄: やや不足(70-90%)
    optimal: '#22c55e', // 緑: 適正(90-110%)
    slightlyExcessive: '#f97316', // オレンジ: やや過剰(110-130%)
    excessive: '#ef4444', // 赤: 過剰(>130%)
    target: '#3b82f6', // 青: 目標値
};

// 栄養素ごとの日本語名とアイコン
const NUTRIENT_INFO = {
    calories: { name: 'カロリー', unit: 'kcal', icon: '🔥' },
    protein: { name: 'タンパク質', unit: 'g', icon: '🥩' },
    iron: { name: '鉄分', unit: 'mg', icon: '⚙️' },
    folic_acid: { name: '葉酸', unit: 'μg', icon: '🍃' },
    calcium: { name: 'カルシウム', unit: 'mg', icon: '🥛' },
    vitamin_d: { name: 'ビタミンD', unit: 'μg', icon: '☀️' },
};

// NutritionChartコンポーネントのプロップス型定義
export interface NutritionChartProps {
    date: string;
    className?: string;
}

// 達成率に応じた色を返す関数
const getColorByPercentage = (percentage: number): string => {
    if (percentage < 70) return COLORS.deficient;
    if (percentage < 90) return COLORS.slightlyDeficient;
    if (percentage <= 110) return COLORS.optimal;
    if (percentage <= 130) return COLORS.slightlyExcessive;
    return COLORS.excessive;
};

// カスタムツールチップコンポーネント
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const nutrient = payload[0].payload;
        return (
            <div className="bg-white p-3 shadow-md rounded-md border text-sm">
                <p className="font-bold mb-1">{nutrient.name}</p>
                <p className="text-gray-700">
                    目標値: {nutrient.target} {nutrient.unit}
                </p>
                <p className="text-gray-700">
                    実績値: {nutrient.actual} {nutrient.unit}
                </p>
                <p className={`font-bold ${nutrient.percentage < 70 || nutrient.percentage > 130 ? 'text-red-500' : ''}`}>
                    達成率: {nutrient.percentage}%
                </p>
            </div>
        );
    }
    return null;
};

export default function NutritionChart({ date, className }: NutritionChartProps) {
    const [nutritionData, setNutritionData] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClientComponentClient();

    useEffect(() => {
        const fetchNutritionData = async () => {
            try {
                setLoading(true);

                // セッションの有効性を確認
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setError('ログインが必要です。再度ログインしてください。');
                    setLoading(false);
                    return;
                }

                // 栄養データを直接取得
                const { data, error: fetchError } = await supabase
                    .from('nutrition_goal_prog')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('meal_date', date)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    throw fetchError;
                }

                if (!data) {
                    setError('この日付の栄養データが見つかりませんでした');
                    setLoading(false);
                    return;
                }

                const progress = data as NutritionProgress;

                // グラフデータの整形
                const chartData = [
                    {
                        name: NUTRIENT_INFO.calories.name,
                        icon: NUTRIENT_INFO.calories.icon,
                        target: progress.target_calories,
                        actual: progress.actual_calories,
                        percentage: progress.calories_percent,
                        unit: NUTRIENT_INFO.calories.unit
                    },
                    {
                        name: NUTRIENT_INFO.protein.name,
                        icon: NUTRIENT_INFO.protein.icon,
                        target: progress.target_protein,
                        actual: progress.actual_protein,
                        percentage: progress.protein_percent,
                        unit: NUTRIENT_INFO.protein.unit
                    },
                    {
                        name: NUTRIENT_INFO.iron.name,
                        icon: NUTRIENT_INFO.iron.icon,
                        target: progress.target_iron,
                        actual: progress.actual_iron,
                        percentage: progress.iron_percent,
                        unit: NUTRIENT_INFO.iron.unit
                    },
                    {
                        name: NUTRIENT_INFO.folic_acid.name,
                        icon: NUTRIENT_INFO.folic_acid.icon,
                        target: progress.target_folic_acid,
                        actual: progress.actual_folic_acid,
                        percentage: progress.folic_acid_percent,
                        unit: NUTRIENT_INFO.folic_acid.unit
                    },
                    {
                        name: NUTRIENT_INFO.calcium.name,
                        icon: NUTRIENT_INFO.calcium.icon,
                        target: progress.target_calcium,
                        actual: progress.actual_calcium,
                        percentage: progress.calcium_percent,
                        unit: NUTRIENT_INFO.calcium.unit
                    },
                    {
                        name: NUTRIENT_INFO.vitamin_d.name,
                        icon: NUTRIENT_INFO.vitamin_d.icon,
                        target: progress.target_vitamin_d,
                        actual: progress.actual_vitamin_d,
                        percentage: progress.vitamin_d_percent,
                        unit: NUTRIENT_INFO.vitamin_d.unit
                    }
                ];

                setNutritionData(chartData);
                setError(null);

            } catch (err: any) {
                console.error('栄養データ取得エラー:', err);
                // エラーメッセージをわかりやすく表示
                if (err.message && typeof err.message === 'string') {
                    if (err.message.includes('ログインセッション')) {
                        setError('ログインセッションが無効です。再度ログインしてください。');
                    } else {
                        setError(`データ取得エラー: ${err.message}`);
                    }
                } else {
                    setError('栄養データの取得に失敗しました');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchNutritionData();
    }, [date, supabase]);

    // データを正規化して表示用に整形するヘルパー関数
    const normalizeData = (data: any[]) => {
        return data.map(item => ({
            ...item,
            // 値が0の場合は0にする（グラフ描画のため）
            actual: item.actual || 0,
            target: item.target || 0,
            percentage: item.percentage || 0
        }));
    };

    return (
        <Card className={`w-full ${className}`}>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg sm:text-xl font-bold">栄養素摂取状況</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-60">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                ) : error ? (
                    <div className="text-center text-red-500 py-8">{error}</div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            data={normalizeData(nutritionData)}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            barSize={30}
                            layout="vertical"
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value, index) => {
                                    const item = nutritionData[index];
                                    return item ? `${item.icon} ${value}` : value;
                                }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar
                                name="目標値"
                                dataKey="target"
                                fill={COLORS.target}
                                opacity={0.3}
                                radius={[0, 4, 4, 0]}
                            />
                            <Bar
                                name="実績値"
                                dataKey="actual"
                                radius={[0, 4, 4, 0]}
                            >
                                {nutritionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={getColorByPercentage(entry.percentage)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
                {!loading && !error && (
                    <div className="flex flex-wrap justify-center mt-4 gap-2 text-xs sm:text-sm">
                        <div className="flex items-center gap-1">
                            <span className="w-3 h-3 inline-block bg-red-500 rounded-full"></span>
                            <span>不足(&lt;70%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-3 h-3 inline-block bg-amber-500 rounded-full"></span>
                            <span>やや不足(70-90%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-3 h-3 inline-block bg-green-500 rounded-full"></span>
                            <span>適正(90-110%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-3 h-3 inline-block bg-orange-500 rounded-full"></span>
                            <span>やや過剰(110-130%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-3 h-3 inline-block bg-red-500 rounded-full"></span>
                            <span>過剰(&gt;130%)</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
