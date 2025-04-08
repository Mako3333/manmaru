"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/date-utils';

interface WeightRecord {
    id: string;
    user_id: string;
    recorded_date: string;
    weight: number;
    notes?: string;
    created_at: string;
}

interface WeightChartProps {
    userId: string;
}

export default function WeightChart({ userId }: WeightChartProps) {
    const [weightData, setWeightData] = useState<WeightRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [prePregnancyWeight, setPrePregnancyWeight] = useState<number | null>(null);

    useEffect(() => {
        async function fetchWeightData() {
            try {
                setLoading(true);

                // ユーザープロフィールを取得して妊娠前体重を取得
                const { data: profile, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('pre_pregnancy_weight')
                    .eq('id', userId)
                    .single();

                if (profileError) {
                    console.error('プロフィール取得エラー:', profileError);
                } else if (profile) {
                    setPrePregnancyWeight(profile.pre_pregnancy_weight);
                }

                // 体重記録を取得
                const { data: records, error } = await supabase
                    .from('weight_records')
                    .select('*')
                    .eq('user_id', userId)
                    .order('recorded_date', { ascending: true })
                    .limit(30);

                if (error) {
                    throw error;
                }

                setWeightData(records || []);
            } catch (error: any) {
                console.error('体重データの取得エラー:', error.message);
                setError('体重データを取得できませんでした。');
            } finally {
                setLoading(false);
            }
        }

        fetchWeightData();
    }, [userId]);

    // 体重の増加量を計算
    const calculateWeightGain = (currentWeight: number): number => {
        if (!prePregnancyWeight) return 0;
        return parseFloat((currentWeight - prePregnancyWeight).toFixed(1));
    };

    // 日付を短い形式に変換（MM/DD）
    const formatShortDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    // チャートの最大高さ
    const chartHeight = 200;

    // 最小値と最大値を計算
    const minWeight = weightData.length > 0
        ? Math.min(...weightData.map(record => record.weight), prePregnancyWeight || Infinity) - 1
        : prePregnancyWeight ? prePregnancyWeight - 1 : 45;

    const maxWeight = weightData.length > 0
        ? Math.max(...weightData.map(record => record.weight)) + 1
        : prePregnancyWeight ? prePregnancyWeight + 10 : 80;

    const weightRange = maxWeight - minWeight;

    // 体重からY座標を計算
    const getYPosition = (weight: number): number => {
        return chartHeight - ((weight - minWeight) / weightRange) * chartHeight;
    };

    if (loading) {
        return <div className="text-center p-4">読み込み中...</div>;
    }

    if (error) {
        return <div className="text-center text-red-500 p-4">{error}</div>;
    }

    if (weightData.length === 0) {
        return (
            <div className="text-center text-gray-500 p-8">
                <p className="mb-2">体重記録がありません</p>
                <p className="text-sm">定期的に体重を記録して、健康な妊娠を管理しましょう。</p>
            </div>
        );
    }

    // 直近の体重
    const latestWeight = weightData.length > 0 ? weightData[weightData.length - 1]!.weight : 0;
    const weightGain = prePregnancyWeight ? calculateWeightGain(latestWeight) : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h3 className="text-base font-medium">体重記録</h3>
                    <p className="text-sm text-gray-500">最近30日間の体重推移</p>
                </div>
                <div className="flex gap-4">
                    <div className="text-center">
                        <p className="text-sm text-gray-500">現在</p>
                        <p className="text-xl font-semibold">{latestWeight} kg</p>
                    </div>
                    {weightGain !== null && (
                        <div className="text-center">
                            <p className="text-sm text-gray-500">増加量</p>
                            <p className={`text-xl font-semibold ${weightGain > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                                {weightGain > 0 ? '+' : ''}{weightGain} kg
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="relative h-64 border border-gray-200 rounded-lg p-4">
                {/* Y軸ラベル */}
                <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-gray-500 py-2">
                    <span>{maxWeight} kg</span>
                    <span>{Math.round((maxWeight + minWeight) / 2)} kg</span>
                    <span>{minWeight} kg</span>
                </div>

                {/* チャート領域 */}
                <div className="absolute left-12 right-4 top-2 bottom-6">
                    {/* 基準線（妊娠前体重） */}
                    {prePregnancyWeight && (
                        <div
                            className="absolute left-0 right-0 border-t border-dashed border-blue-300"
                            style={{ top: `${getYPosition(prePregnancyWeight)}px` }}
                        >
                            <span className="absolute -top-3 -left-12 text-xs text-blue-500">妊娠前</span>
                        </div>
                    )}

                    {/* 体重線 */}
                    <svg width="100%" height={chartHeight} className="overflow-visible">
                        <polyline
                            points={weightData.map((record, index) => {
                                const x = (index / (weightData.length - 1)) * 100 + '%';
                                const y = getYPosition(record.weight);
                                return `${x},${y}`;
                            }).join(' ')}
                            fill="none"
                            stroke="rgb(34, 197, 94)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* データポイント */}
                        {weightData.map((record, index) => {
                            const x = (index / (weightData.length - 1)) * 100 + '%';
                            const y = getYPosition(record.weight);
                            return (
                                <circle
                                    key={record.id}
                                    cx={x}
                                    cy={y}
                                    r="4"
                                    fill="white"
                                    stroke="rgb(34, 197, 94)"
                                    strokeWidth="2"
                                />
                            );
                        })}
                    </svg>

                    {/* X軸ラベル */}
                    <div className="absolute left-0 right-0 bottom-0 flex justify-between text-xs text-gray-500">
                        {weightData.length > 5 ? (
                            <>
                                <span>{formatShortDate(weightData[0]!.recorded_date)}</span>
                                <span>{formatShortDate(weightData[Math.floor(weightData.length / 2)]!.recorded_date)}</span>
                                <span>{formatShortDate(weightData[weightData.length - 1]!.recorded_date)}</span>
                            </>
                        ) : (
                            weightData.map(record => (
                                <span key={record.id}>{formatShortDate(record.recorded_date)}</span>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* 最近の記録 */}
            <h3 className="text-base font-medium mt-6 mb-3">最近の記録</h3>
            <div className="space-y-2">
                {weightData.slice(-5).reverse().map(record => (
                    <Card key={record.id} className="overflow-hidden">
                        <CardContent className="p-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-gray-500">{formatShortDate(record.recorded_date)}</p>
                                    <p className="font-medium">{record.weight} kg</p>
                                </div>
                                {prePregnancyWeight && (
                                    <div className="text-sm">
                                        <span className={calculateWeightGain(record.weight) > 0 ? 'text-orange-500' : 'text-green-500'}>
                                            {calculateWeightGain(record.weight) > 0 ? '+' : ''}
                                            {calculateWeightGain(record.weight)} kg
                                        </span>
                                    </div>
                                )}
                            </div>
                            {record.notes && (
                                <p className="text-sm text-gray-600 mt-1">{record.notes}</p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
} 