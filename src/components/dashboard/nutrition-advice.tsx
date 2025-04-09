'use client';

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdviceState, AdviceType } from "@/types/nutrition";
import ReactMarkdown from "react-markdown";
import Link from 'next/link';
import { format } from 'date-fns';
import { getJapanDate } from '@/lib/date-utils';

// ★ 追加: APIエラーレスポンスの型定義
interface ApiErrorResponse {
    success: boolean; // falseのはずだが、型のために入れておく
    error?: {
        code?: string;
        message?: string;
        details?: {
            redirect?: string;
            // 他の詳細情報
        };
        // userMessage など AppError の他のプロパティ
    };
    message?: string; // トップレベルのメッセージも考慮
}

interface DetailedNutritionAdviceProps {
    selectedDate?: string;
    onDateSelect?: (date: string) => void;
}

export function DetailedNutritionAdvice({ selectedDate, onDateSelect }: DetailedNutritionAdviceProps) {
    // 1. 状態管理
    const [state, setState] = useState<{
        loading: boolean;
        error: string | null;
        advice: { content: string; recommended_foods: string[] } | null;
        redirect?: string;
    }>({
        loading: true,
        error: null,
        advice: null,
    });

    // アドバイスタイプは固定でDAILYを使用
    const [forceUpdate, setForceUpdate] = useState<boolean>(false);
    const [currentDate, setCurrentDate] = useState<string>(selectedDate || getJapanDate());

    // 日付が変更されたときの処理
    useEffect(() => {
        if (selectedDate) {
            setCurrentDate(selectedDate);
            fetchDetailedAdvice(selectedDate, forceUpdate);
        }
    }, [selectedDate]);

    // 2. データ取得関数
    const fetchDetailedAdvice = async (date = currentDate, force = forceUpdate) => {
        try {
            setState(prev => ({ ...prev, loading: true, error: null }));
            console.log('DetailedNutritionAdvice: データ取得開始', { date, force });

            let apiUrl = `/api/v2/nutrition-advice?type=DAILY_INITIAL&date=${date}`;
            if (force) {
                apiUrl += '&forceRegenerate=true';
            }

            const response = await fetch(apiUrl);
            console.log('DetailedNutritionAdvice: APIレスポンスステータス', response.status);

            if (!response.ok) {
                let errorJson: ApiErrorResponse | null = null;
                const httpErrorMessage = `HTTPエラー: ${response.status}`; // デフォルトメッセージ

                try {
                    // ★ 修正: 型アサーションを追加
                    errorJson = await response.json() as ApiErrorResponse;
                    console.log('DetailedNutritionAdvice: APIエラー JSON', errorJson);
                } catch (jsonError) {
                    console.error('DetailedNutritionAdvice: APIエラーレスポンスのJSONパース失敗', jsonError);
                    // errorJson は null のまま
                }

                // ★ 修正: エラーメッセージを安全に抽出
                const errorMessage = errorJson?.error?.message || // 優先度1: ネストされたエラーメッセージ
                    errorJson?.message ||          // 優先度2: トップレベルメッセージ
                    httpErrorMessage;              // フォールバック: HTTPステータスメッセージ

                // ★ 修正: リダイレクトURLを安全に抽出
                const redirectUrl = errorJson?.error?.details?.redirect;

                // ★ デバッグログ追加: setState直前のエラーメッセージを確認
                console.log('[fetchDetailedAdvice] Setting error state. Type:', typeof errorMessage, 'Value:', errorMessage);

                if (redirectUrl) {
                    setState(prev => ({
                        ...prev,
                        loading: false,
                        error: errorMessage,
                        advice: null,
                        redirect: redirectUrl
                    }));
                } else {
                    // redirect がない場合は、redirect プロパティを含めずに更新
                    // ★ デバッグログ追加: setState直前のエラーメッセージを確認 (elseブロック)
                    console.log('[fetchDetailedAdvice] Setting error state (no redirect). Type:', typeof errorMessage, 'Value:', errorMessage);
                    setState(prev => ({
                        ...prev,
                        loading: false,
                        error: errorMessage,
                        advice: null,
                    }));
                }
                return; // エラーハンドリング後に関数を終了
            }

            // --- response.ok の場合の処理 ---
            const responseData = await response.json();
            console.log('DetailedNutritionAdvice: 取得データ raw', responseData);

            // ★ 修正: successフラグとdata本体の存在を確認し、失敗時は具体的なエラーを設定
            if (!responseData.success || !responseData.data) {
                const apiErrorMessage = responseData.error?.message || responseData.message || "APIから予期しない形式の応答がありました";
                console.error('DetailedNutritionAdvice: API success=false or no data', responseData);
                setState(prev => ({
                    ...prev,
                    loading: false,
                    error: apiErrorMessage,
                    advice: null,
                }));
                return; // ここで処理を終了
            }

            const actualData = responseData.data;

            console.log('DetailedNutritionAdvice: 取得データ (data part)', {
                type: actualData.advice_type,
                date: actualData.advice_date,
                hasAdvice: !!actualData.advice_detail || !!actualData.advice_summary
            }); // デバッグ用ログ

            // 3. アドバイスデータの設定
            setState({
                loading: false,
                error: null,
                advice: {
                    content: actualData.advice_detail || actualData.advice_summary || "",
                    recommended_foods: actualData.recommended_foods || []
                }
            });

            // 4. 既読状態の更新
            if (actualData.id && !actualData.is_read) {
                try {
                    await fetch("/api/v2/nutrition-advice", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: actualData.id })
                    });
                    console.log('DetailedNutritionAdvice: 既読状態更新完了'); // デバッグ用ログ
                } catch (readError) {
                    console.error("既読更新エラー:", readError);
                }
            }

            // 強制更新フラグをリセット
            setForceUpdate(false);
        } catch (err) {
            // fetch自体、または response.ok 後の処理でエラーが発生した場合
            console.error("詳細アドバイス取得/処理エラー:", err);

            // ★ 修正: エラーの種類を判別し、適切なメッセージを設定
            let errorMessageString: string;
            // AppError は src/lib/error からインポートする必要があるが、ここでは仮定
            // import { AppError } from "@/lib/error"; // 必要に応じて追加
            // if (err instanceof AppError) { // AppError クラスが利用可能なら
            //     errorMessageString = err.userMessage || err.message || "アドバイスの読み込み中にエラーが発生しました。";
            // } else
            if (err instanceof Error) { // 通常の Error オブジェクトの場合
                errorMessageString = err.message;
            } else { // その他の場合
                errorMessageString = "詳細アドバイスの読み込み中に予期せぬエラーが発生しました";
            }

            // ★ デバッグログ追加: 最終catchブロックでのsetState直前の値を確認
            console.log('[fetchDetailedAdvice] Setting error state in FINAL CATCH. Type:', typeof errorMessageString, 'Value:', errorMessageString);
            setState(prev => ({
                ...prev,
                loading: false,
                error: errorMessageString,
                advice: null,
            }));

            toast.error(errorMessageString); // トーストにも反映
            setForceUpdate(false); // 強制更新フラグをリセット
        }
    };

    // 5. 初回読み込み
    useEffect(() => {
        console.log('DetailedNutritionAdvice: コンポーネントマウント'); // デバッグ用ログ
        fetchDetailedAdvice();
    }, []);

    // 6. 強制更新ハンドラ
    const handleForceUpdate = () => {
        setForceUpdate(true);
        // 更新中のステータスをセット
        setState(prev => ({ ...prev, loading: true, error: null }));
        fetchDetailedAdvice(currentDate, true);
    };

    // 7. 日付選択ハンドラ
    const handleDateChange = (date: string) => {
        setCurrentDate(date);
        if (onDateSelect) {
            onDateSelect(date);
        }
        fetchDetailedAdvice(date, false);
    };

    // 8. UI描画
    return (
        <Card className="w-full overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg sm:text-xl font-bold">栄養アドバイス</CardTitle>

                <div className="flex items-center space-x-2">
                    {/* 日付表示 */}
                    <div className="text-sm text-gray-500">
                        {format(new Date(currentDate), 'yyyy年MM月dd日')}
                    </div>

                    {/* 更新ボタン - 常に表示するが、ローディング中は無効化 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleForceUpdate}
                        disabled={state.loading}
                        className="h-8 w-8 p-0"
                        title="アドバイスを更新"
                    >
                        <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                        <span className="sr-only">更新</span>
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {state.loading ? (
                    // ローディング表示
                    <div className="flex flex-col justify-center items-center py-8 space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                        <p className="text-sm text-gray-500">栄養アドバイスを更新中...</p>
                    </div>
                ) : state.error ? (
                    <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
                        <p className="text-sm mb-2">{state.error}</p>
                        {state.redirect && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={state.redirect}>
                                    プロフィールページへ移動
                                </Link>
                            </Button>
                        )}
                    </div>
                ) : state.advice ? (
                    // アドバイス表示
                    <div className="space-y-6">
                        {/* 詳細アドバイス - マークダウン対応 */}
                        <div className="p-5 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
                            <div className="text-green-700 prose prose-sm max-w-none prose-headings:text-green-800 prose-headings:font-semibold prose-p:my-2 prose-strong:text-green-800 prose-ul:my-2 prose-li:my-1">
                                <ReactMarkdown>
                                    {state.advice.content}
                                </ReactMarkdown>
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
                        <p className="text-gray-500 mb-4">この日のアドバイスはありません</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleForceUpdate}
                            className="mt-2"
                        >
                            アドバイスを生成する
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
} 