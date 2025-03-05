import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NutritionAdvice } from '@/types/nutrition';
import { AdviceType } from '@/types/nutrition';
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from '@/components/ui/button';

interface AdviceCardProps {
    date: string;
    className?: string;
}

// アドバイスタイプごとの表示情報
const ADVICE_TYPE_INFO: Record<string, { title: string; icon: string; }> = {
    [AdviceType.DAILY]: { title: '栄養バランス', icon: '📝' },
    [AdviceType.DEFICIENCY]: { title: '栄養不足', icon: '⚠️' },
    [AdviceType.MEAL_SPECIFIC]: { title: '食事アドバイス', icon: '🍽️' },
    [AdviceType.WEEKLY]: { title: '週間アドバイス', icon: '📅' }
};

export const AdviceCard: React.FC<AdviceCardProps> = ({ date, className = '' }) => {
    const [advice, setAdvice] = useState<NutritionAdvice | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClientComponentClient();

    const fetchAdvice = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('AdviceCard: 日付パラメータ', date); // デバッグ用ログ

            // セッションの有効性を確認
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.log('AdviceCard: セッションなし'); // デバッグ用ログ
                setLoading(false);
                return;
            }

            console.log('AdviceCard: ユーザーID', session.user.id); // デバッグ用ログ

            // まずSupabaseから既存のアドバイスを取得
            const { data, error: fetchError } = await supabase
                .from('daily_nutri_advice')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('advice_date', date)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            console.log('AdviceCard: データベース取得結果', data, fetchError); // デバッグ用ログ

            // データがある場合はそれを使用
            if (data && !fetchError) {
                setAdvice(data);
                setLoading(false);
                return;
            }

            // データがない場合はAPIから取得
            if (fetchError && fetchError.code === 'PGRST116') {
                console.log('AdviceCard: データベースにデータがないためAPIから取得'); // デバッグ用ログ
                const response = await fetch('/api/nutrition-advice');

                if (!response.ok) {
                    throw new Error('アドバイスの取得に失敗しました');
                }

                const apiData = await response.json();
                console.log('AdviceCard: API取得結果', apiData); // デバッグ用ログ

                if (apiData.success && apiData.advice) {
                    setAdvice({
                        id: apiData.advice.id,
                        user_id: session.user.id,
                        advice_date: date,
                        advice_type: AdviceType.DAILY,
                        advice_summary: apiData.advice.content,
                        is_read: apiData.advice.is_read,
                        created_at: apiData.advice.created_at
                    });
                } else {
                    throw new Error(apiData.error || 'アドバイスの取得に失敗しました');
                }
            } else if (fetchError) {
                throw fetchError;
            }
        } catch (err) {
            console.error('栄養アドバイス取得エラー:', err);
            setError(err instanceof Error ? err.message : '栄養アドバイスの取得に失敗しました');
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
    }, [date, supabase]);

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
                        <p className="text-sm">{error}</p>
                    </div>
                ) : advice ? (
                    <div className="p-3 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">
                        <h3 className="font-semibold text-sm mb-1">{adviceInfo.title}</h3>
                        <p className="text-sm">{advice.advice_summary}</p>
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