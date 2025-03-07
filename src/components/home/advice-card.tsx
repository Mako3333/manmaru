import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NutritionAdvice } from '@/types/nutrition';
import { AdviceType } from '@/types/nutrition';
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface AdviceCardProps {
    date: string;
    className?: string;
    forceUpdate?: boolean;
}

// アドバイスタイプごとの表示情報
const ADVICE_TYPE_INFO: Record<string, { title: string; icon: string; }> = {
    [AdviceType.DAILY]: { title: '栄養バランス', icon: '📝' },
    [AdviceType.DEFICIENCY]: { title: '栄養不足', icon: '⚠️' },
    [AdviceType.MEAL_SPECIFIC]: { title: '食事アドバイス', icon: '🍽️' },
    [AdviceType.WEEKLY]: { title: '週間アドバイス', icon: '📅' }
};

export const AdviceCard: React.FC<AdviceCardProps> = ({
    date,
    className = '',
    forceUpdate = false
}) => {
    const [advice, setAdvice] = useState<NutritionAdvice | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClientComponentClient();

    const fetchAdvice = async () => {
        setLoading(true);
        setError('');
        setAdvice(null);

        try {
            // セッション確認
            const { data: { session } } = await supabase.auth.getSession();
            console.log('AdviceCard: セッション確認', !!session); // デバッグ用ログ

            if (!session) {
                throw new Error('ログインが必要です');
            }

            // APIからアドバイスを取得
            console.log('AdviceCard: アドバイス取得開始', { date, forceUpdate });

            // APIリクエストURLの構築
            let apiUrl = `/api/nutrition-advice?date=${date}`;
            if (forceUpdate) {
                apiUrl += '&force=true';
            }

            const response = await fetch(apiUrl);

            if (!response.ok) {
                const errorData = await response.json();

                // リダイレクト情報がある場合
                if (errorData.redirect) {
                    throw new Error(`${errorData.error || 'エラーが発生しました'}: ${errorData.message || ''}`);
                }

                throw new Error(errorData.error || 'アドバイスの取得に失敗しました');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'アドバイスの取得に失敗しました');
            }

            setAdvice(data);

            console.log('AdviceCard: アドバイス取得成功', {
                type: data.advice_type,
                date: data.advice_date,
                summaryLength: data.advice_summary?.length
            });
        } catch (err) {
            console.error('栄養アドバイス取得エラー:', err);
            setError(err instanceof Error ? err.message : 'アドバイスの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (date) {
            fetchAdvice();
        } else {
            console.log('AdviceCard: 日付が指定されていません'); // デバッグ用ログ
            setLoading(false);
        }
    }, [date, forceUpdate]);

    // アドバイス情報
    const adviceInfo = advice ?
        (ADVICE_TYPE_INFO[advice.advice_type] || { title: 'アドバイス', icon: '📝' }) :
        { title: 'アドバイス', icon: '📝' };

    return (
        <Card className={`w-full ${className}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center">
                    <span className="mr-2 text-xl">{adviceInfo.icon}</span>
                    今日のアドバイス
                </CardTitle>

                {!loading && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchAdvice}
                        disabled={loading}
                        className="h-8 w-8 p-0"
                    >
                        <RefreshCw className="h-4 w-4" />
                        <span className="sr-only">更新</span>
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-16">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    </div>
                ) : error ? (
                    <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200">
                        <p className="text-sm mb-2">{error}</p>
                        {error.includes('プロフィールページへ移動') && (
                            <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                                <Link href="/profile">
                                    プロフィールページへ移動
                                </Link>
                            </Button>
                        )}
                    </div>
                ) : advice ? (
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">
                            <p className="text-sm whitespace-pre-line">{advice.advice_summary}</p>
                        </div>


                        <Button
                            variant="outline"
                            className="w-full mt-2"
                            asChild
                        >
                            <Link href="/dashboard">
                                詳細を見る
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <div className="p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200">
                        <p className="text-sm">アドバイスを読み込めませんでした。更新ボタンをクリックしてください。</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}; 