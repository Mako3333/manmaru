'use client';

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdviceState } from "@/types/nutrition";

export function DetailedNutritionAdvice() {
    // 1. 状態管理
    const [state, setState] = useState<AdviceState>({
        loading: true,
        error: null,
        advice: null
    });

    // 2. データ取得関数
    const fetchDetailedAdvice = async () => {
        try {
            setState(prev => ({ ...prev, loading: true, error: null }));
            console.log('DetailedNutritionAdvice: データ取得開始'); // デバッグ用ログ

            // Supabaseから直接データを取得する代わりに、APIを使用
            const response = await fetch("/api/nutrition-advice?detail=true");
            console.log('DetailedNutritionAdvice: APIレスポンス', response.status); // デバッグ用ログ

            if (!response.ok) {
                const errorData = await response.json();
                console.log('DetailedNutritionAdvice: APIエラー', errorData); // デバッグ用ログ
                throw new Error(errorData.error || "詳細アドバイスの取得に失敗しました");
            }

            const data = await response.json();
            console.log('DetailedNutritionAdvice: 取得データ', data); // デバッグ用ログ

            if (!data.success) {
                throw new Error(data.error || "アドバイスの取得に失敗しました");
            }

            // 3. アドバイスデータの設定
            setState({
                loading: false,
                error: null,
                advice: {
                    content: data.advice?.content || data.advice_detail || "",
                    recommended_foods: data.advice?.recommended_foods || data.recommended_foods || []
                }
            });

            // 4. 既読状態の更新
            if (data.id && !data.is_read) {
                try {
                    await fetch("/api/nutrition-advice", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: data.id })
                    });
                    console.log('DetailedNutritionAdvice: 既読状態更新完了'); // デバッグ用ログ
                } catch (readError) {
                    console.error("既読更新エラー:", readError);
                }
            }
        } catch (err) {
            console.error("詳細アドバイス取得エラー:", err);
            setState(prev => ({
                loading: false,
                error: err instanceof Error ? err.message : "詳細アドバイスを読み込めませんでした",
                advice: null
            }));

            toast.error("詳細アドバイスの読み込みに失敗しました");
        }
    };

    // 5. 初回読み込み
    useEffect(() => {
        console.log('DetailedNutritionAdvice: コンポーネントマウント'); // デバッグ用ログ
        fetchDetailedAdvice();
    }, []);

    // 6. UI描画
    return (
        <Card className="w-full overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg sm:text-xl font-bold">栄養アドバイス詳細</CardTitle>

                {/* 更新ボタン */}
                {!state.loading && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchDetailedAdvice}
                        disabled={state.loading}
                        className="h-8 w-8 p-0"
                    >
                        <RefreshCw className="h-4 w-4" />
                        <span className="sr-only">更新</span>
                    </Button>
                )}
            </CardHeader>

            <CardContent>
                {state.loading ? (
                    // ローディング表示
                    <div className="flex justify-center items-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                    </div>
                ) : state.error ? (
                    // エラー表示
                    <div className="text-gray-500 py-4 text-center">
                        <p>{state.error}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchDetailedAdvice}
                            className="mt-4"
                        >
                            再読み込み
                        </Button>
                    </div>
                ) : state.advice ? (
                    // アドバイス表示
                    <div className="space-y-6">
                        {/* 詳細アドバイス */}
                        <div className="p-5 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
                            <div className="text-green-700 whitespace-pre-line">
                                {state.advice.content}
                            </div>
                        </div>

                        {/* 推奨食品リスト */}
                        {state.advice.recommended_foods && state.advice.recommended_foods.length > 0 && (
                            <div className="p-5 rounded-lg border border-green-100 bg-white">
                                <h3 className="text-green-800 font-semibold mb-3">今日のおすすめ食品</h3>
                                <ul className="space-y-2">
                                    {state.advice.recommended_foods.map((food, index) => (
                                        <li key={index} className="flex items-start">
                                            <span className="inline-flex w-6 h-6 rounded-full bg-green-100 text-green-600 flex-shrink-0 items-center justify-center mr-2 mt-0.5 text-sm font-medium">
                                                {index + 1}
                                            </span>
                                            <span className="text-gray-700">{food}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    // データなし表示
                    <div className="text-center py-6">
                        <p className="text-gray-500 mb-4">アドバイスを読み込めませんでした</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchDetailedAdvice}
                            className="mt-2"
                        >
                            再読み込み
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
} 