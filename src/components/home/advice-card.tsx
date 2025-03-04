"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdviceState } from "@/types/nutrition";

export function AdviceCard() {
    // 1. 状態管理
    const [state, setState] = useState<AdviceState>({
        loading: true,
        error: null,
        advice: null
    });

    const router = useRouter();

    // 2. データ取得
    useEffect(() => {
        async function fetchAdvice() {
            try {
                setState(prev => ({ ...prev, loading: true }));

                const response = await fetch("/api/nutrition-advice");

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "アドバイスの取得に失敗しました");
                }

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || "データの取得に失敗しました");
                }

                // 3. アドバイスデータの設定
                setState({
                    loading: false,
                    error: null,
                    advice: data.advice ? {
                        content: data.advice.content,
                        recommended_foods: data.advice.recommended_foods
                    } : null
                });

                // 4. 既読状態の更新
                if (data.advice && data.advice.id && !data.advice.is_read) {
                    try {
                        await fetch("/api/nutrition-advice", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: data.advice.id })
                        });
                    } catch (readError) {
                        console.error("既読更新エラー:", readError);
                        // 非クリティカルなので失敗してもユーザーには表示しない
                    }
                }
            } catch (err) {
                console.error("アドバイス取得エラー:", err);
                setState({
                    loading: false,
                    error: err instanceof Error ? err.message : "アドバイスを読み込めませんでした",
                    advice: null
                });

                // エラー通知（オプション）
                toast.error("アドバイスの読み込みに失敗しました", {
                    description: "しばらくしてからもう一度お試しください"
                });
            }
        }

        fetchAdvice();
    }, []);

    // 5. ダッシュボードへの遷移
    const handleViewDetail = () => {
        router.push("/dashboard?tab=advice");
    };

    // 6. UI描画
    return (
        <Card className="w-full overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg sm:text-xl font-bold">本日の栄養アドバイス</CardTitle>
            </CardHeader>
            <CardContent>
                {/* コンテンツエリア */}
                <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
                    {state.loading ? (
                        // ローディング表示
                        <div className="flex justify-center items-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                        </div>
                    ) : state.error ? (
                        // エラー表示
                        <div className="text-gray-500">
                            <p>{state.error}</p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setState(prev => ({ ...prev, loading: true }))}
                                className="mt-2 text-green-600"
                            >
                                再読み込み
                            </Button>
                        </div>
                    ) : state.advice?.content ? (
                        // アドバイス表示
                        <div className="text-green-700">
                            {state.advice.content}
                        </div>
                    ) : (
                        // データなし表示
                        <p className="text-green-700">
                            今日の栄養バランスは良好です。このまま栄養バランスの良い食事を続けましょう。
                        </p>
                    )}
                </div>
            </CardContent>

            {/* 詳細表示ボタン - エラー時や読み込み中は非表示 */}
            {!state.loading && !state.error && (
                <CardFooter className="flex justify-end pt-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewDetail}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 flex items-center gap-1"
                    >
                        詳しく見る
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
} 