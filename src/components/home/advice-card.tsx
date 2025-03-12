import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { NutritionAdvice } from '@/types/nutrition';
import { AdviceType } from '@/types/nutrition';
import { Loader2, AlertTriangle, Info, Check, RefreshCw } from "lucide-react";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface AdviceCardProps {
    date: string;
    className?: string;
    forceUpdate?: boolean;
}

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
            console.log('AdviceCard: アドバイスデータ受信', data); // レスポンスデータを詳細にロギング

            if (!data.success) {
                throw new Error(data.error || 'アドバイスの取得に失敗しました');
            }

            setAdvice(data);

            console.log('AdviceCard: アドバイス取得成功', {
                type: data.advice_type,
                date: data.advice_date,
                summaryLength: data.advice_summary?.length,
                textLength: data.advice_text?.length
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

    return (
        <div className="h-full relative mt-10">
            {loading ? (
                <Card className="h-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)] rounded-[16px] border-none">
                    <CardContent className="p-5 flex items-center justify-center h-full">
                        <div className="text-center space-y-3">
                            <Loader2 className="h-8 w-8 text-[#2E9E6C] animate-spin mx-auto" />
                            <p className="text-sm text-gray-500">アドバイスを読み込み中...</p>
                        </div>
                    </CardContent>
                </Card>
            ) : error ? (
                <Card className="h-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)] rounded-[16px] border-none">
                    <CardContent className="p-5">
                        <div className="text-center space-y-2">
                            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                            <p className="text-sm text-gray-700">アドバイスを読み込めませんでした</p>
                            <Button variant="outline" size="sm" onClick={fetchAdvice} className="mt-2">
                                再試行
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : advice ? (
                <Card className="h-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)] rounded-[16px] border-none pt-6">
                    {/* 中央上部に配置されたバッジ */}
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                        <div className="h-7 px-4 py-1 bg-gradient-to-r from-[#2E9E6C] to-[#1A6B47] text-white text-xs font-semibold rounded-full flex items-center justify-center shadow-[0_4px_8px_rgba(46,158,108,0.3)]">
                            今日のアドバイス
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
                        </div>
                    </div>

                    <CardContent className="p-6 pt-4">
                        <div className="space-y-4">



                            {/* 引用スタイルのアドバイステキスト */}
                            <div className="bg-[#F0F7F4] rounded-xl p-4 pl-8 relative">
                                {/* 引用符装飾 */}
                                <div className="absolute top-2 left-3 text-[40px] leading-none text-[rgba(46,158,108,0.2)]">
                                    "
                                </div>
                                <p className="text-[15px] text-gray-700 leading-relaxed relative z-1">
                                    {advice.advice_summary || advice.advice_text || "今週の妊娠の段階に合わせたアドバイスです。"}
                                </p>
                            </div>

                            {advice.recommendations && advice.recommendations.length > 0 && (
                                <div className="space-y-2 pt-1">
                                    <h4 className="font-medium text-[15px] text-gray-700">おすすめ対策</h4>
                                    <ul className="space-y-2">
                                        {advice.recommendations.map((rec, idx) => (
                                            <li key={idx} className="flex gap-2 items-start">
                                                <div className="h-5 w-5 rounded-full bg-[#E3F3ED] flex items-center justify-center mt-0.5">
                                                    <Check className="h-3 w-3 text-[#2E9E6C]" />
                                                </div>
                                                <span className="text-[14px] text-gray-700">{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="h-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)] rounded-[16px] border-none">
                    <CardContent className="p-5">
                        <div className="text-center space-y-2">
                            <Info className="h-8 w-8 text-blue-500 mx-auto" />
                            <p className="text-sm text-gray-700">アドバイスは現在ありません</p>
                            <Button variant="outline" size="sm" onClick={fetchAdvice} className="mt-2">
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                アドバイスを取得
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}; 