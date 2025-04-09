import React, { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { NutritionAdvice } from '@/types/nutrition';
import { AdviceType } from '@/types/nutrition';
import { Loader2, AlertTriangle, Info, Check, RefreshCw } from "lucide-react";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/types/user';

interface AdviceCardProps {
    date?: string;
    className?: string;
    forceUpdate?: boolean;
    profile?: UserProfile | null | undefined;
}

// 修正: APIレスポンスの型を仮定 (必要に応じて調整)
interface AdviceApiResponse {
    success: boolean;
    data?: NutritionAdvice; // 成功時のデータ
    error?: { // エラー時の情報
        code?: string;
        message?: string;
    };
    // Linter Error Fix: トップレベルの message も考慮 (もし存在するなら)
    message?: string;
}

export const AdviceCard: React.FC<AdviceCardProps> = ({
    date,
    className = '',
    forceUpdate = false,
    profile
}) => {
    const [advice, setAdvice] = useState<NutritionAdvice | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 日付が提供されていない場合は現在の日付を使用
    const currentDate = date || format(new Date(), 'yyyy-MM-dd');

    const fetchAdvice = useCallback(async () => {
        console.log('[AdviceCard] fetchAdvice called');
        setLoading(true);
        setError(null);
        try {
            // APIエンドポイントを構築 (日付をクエリパラメータに追加)
            const apiUrl = `/api/v2/nutrition-advice?type=DAILY_INITIAL&date=${currentDate}&detail=true`; // detail=true を追加して詳細を取得
            console.log(`[AdviceCard] Fetching advice from: ${apiUrl}`);

            const res = await fetch(apiUrl);
            console.log(`[AdviceCard] API Response status: ${res.status}`);

            // デバッグログ追加: レスポンスの生データをログ出力
            const responseText = await res.clone().text(); // clone()しないと後でjson()が読めなくなる
            console.log(`[AdviceCard] Raw response text (status: ${res.status}):`, responseText);

            // レスポンスステータスをチェック
            if (!res.ok) {
                let errorMessage = `APIエラーが発生しました (ステータス: ${res.status})`; // デフォルトメッセージ
                try {
                    // 修正: cloneしたレスポンスではなく、元のレスポンスでjson()を試す
                    const errorData: AdviceApiResponse = await res.json(); // 型注釈を追加
                    console.log('[AdviceCard] Parsed API Error response body:', errorData);
                    // API が返すエラー構造に合わせてメッセージを取得
                    // errorData.error.message が存在すればそれを使う
                    if (errorData?.error?.message) {
                        errorMessage = errorData.error.message;
                    } else if (errorData?.message) { // Linter Error Fix: Optional Chaining
                        errorMessage = errorData.message;
                    }
                } catch (jsonError) {
                    console.error('[AdviceCard] Failed to parse error response JSON:', jsonError);
                    // JSONパース失敗時は、生のテキストをエラーメッセージに含める（もしあれば）
                    if (responseText) {
                        errorMessage += ` - Response body: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`;
                    }
                }
                // 最終的なエラーメッセージで Error を throw
                throw new Error(errorMessage);
            }

            // 修正: レスポンスがOKでも、JSONパースに失敗する可能性に対処
            let data: AdviceApiResponse;
            try {
                data = await res.json(); // 型注釈を追加
                console.log('[AdviceCard] Parsed API Success response data:', data);
            } catch (jsonParseError) {
                console.error('[AdviceCard] Failed to parse success response JSON:', jsonParseError);
                // JSONパース失敗時のエラーメッセージ
                let parseErrorMessage = 'APIからの応答の解析に失敗しました。';
                if (responseText) {
                    parseErrorMessage += ` - Received: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`;
                }
                throw new Error(parseErrorMessage);
            }

            // 修正: APIレスポンスの success フラグと data を確認
            if (data.success && data.data) {
                // data.data が NutritionAdvice の形式に合うか確認
                // 修正: data.data をセット (NutritionAdvice 型のはず)
                setAdvice(data.data);
            } else {
                // APIは成功(2xx)を返したが、レスポンス形式が予期したものと違う場合や success: false の場合
                console.warn('[AdviceCard] API response indicates failure or unexpected format:', data);
                // data.error.message があればそれを使う、なければデフォルトメッセージ
                setError(data.error?.message || '今日のアドバイスはまだありません。食事を記録すると生成されます。');
                setAdvice(null); // アドバイスデータをクリア
            }

        } catch (err: unknown) { // 修正: unknown 型を使用
            const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
            console.error('栄養アドバイス取得エラー:', errorMessage);
            console.error('エラー詳細(err):', err); // デバッグ用に元のエラーオブジェクトも出力
            setError(errorMessage);
            setAdvice(null); // エラー時はアドバイスデータをクリア
        } finally {
            setLoading(false);
            console.log('[AdviceCard] fetchAdvice finished, loading set to false');
        }
    }, [currentDate]); // 依存配列に currentDate を追加

    useEffect(() => {
        fetchAdvice();
    }, [currentDate, forceUpdate, fetchAdvice]);

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
                            {/* エラーメッセージ表示を追加 */}
                            <p className="text-xs text-red-600">{error}</p>
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
                                    {advice.advice_summary || '今日のアドバイス概要はありません。'}
                                </p>
                            </div>

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