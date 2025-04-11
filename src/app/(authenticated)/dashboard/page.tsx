'use client'

/**
 * ダッシュボードページ
 * 
 * TODO: 栄養データと計算に関する改善点
 * -----------------------------------------------
 * 1. 型の標準化:
 *   - 現在の NutritionData インターフェースを、ドキュメント「栄養データ型標準化ガイドライン」に従って
 *     StandardizedMealNutrition 型に移行することを検討する
 *   - 型変換には src/lib/nutrition/nutrition-utils.ts 内の変換関数を使用する
 *
 * 2. エラーハンドリング:
 *   - AppError クラスと ErrorCode を使用して、一貫性のあるエラー処理を実装する
 *   - 特に API 呼び出しとデータフェッチングでのエラーハンドリングを強化する
 *
 * 3. 栄養計算ロジック:
 *   - 栄養計算は新システムの NutritionService を使用するように更新する
 *   - 直接的な計算ロジックはコンポーネント内に実装せず、専用サービスを利用する
 */

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { format, subDays, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Profile } from '@/lib/utils/profile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';
import { getJapanDate } from '@/lib/date-utils';
import {
    calculateNutritionScore,
    getNutrientColor,
    getNutrientBarColor,
    NutritionTargets,
    DEFAULT_NUTRITION_TARGETS,
} from '@/lib/nutrition/nutrition-display-utils';
import { StandardizedMealNutrition, NutritionProgress, Nutrient } from '@/types/nutrition';
import { Progress } from '@/components/ui/progress';
import useSWR from 'swr';
import { targetsFetcher } from '@/lib/fetchers/home-fetchers';

// 新しいダッシュボードコンポーネントをインポート
import { DetailedNutritionAdvice } from '@/components/dashboard/nutrition-advice';
// NutritionSummaryコンポーネントをインポート
import { NutritionSummary } from '@/components/home/nutrition-summary';
// NutritionChartコンポーネントをインポート
import NutritionChart from '@/components/dashboard/nutrition-chart';

// 栄養素アイコンマッピング (修正 - SVGや適切なアイコンコンポーネント利用を推奨)
const NUTRIENT_ICONS: Record<string, React.ReactNode> = {
    calories: <span className="text-xl">🔥</span>, // 例: emoji or icon component
    protein: <span className="text-xl">🥩</span>,
    iron: <span className="text-xl">⚙️</span>,
    folic_acid: <span className="text-xl">🍃</span>,
    calcium: <span className="text-xl">🦴</span>, // 骨アイコンに変更
    vitamin_d: <span className="text-xl">☀️</span>,
};

// 栄養素名 -> キー のマッピング (表示用)
const NUTRIENT_DISPLAY_MAP: Record<string, keyof NutritionTargets> = {
    'カロリー': 'calories',
    'タンパク質': 'protein',
    '鉄分': 'iron',
    '葉酸': 'folic_acid',
    'カルシウム': 'calcium',
    'ビタミンD': 'vitamin_d',
};

// 不足している栄養素を特定するヘルパー関数
const getDeficientNutrients = (nutrientItems: NutrientDisplayItem[], threshold = 70): string[] => {
    return nutrientItems
        .filter(item => item.percent < threshold)
        .map(item => item.name);
};

// 栄養スコアに応じたメッセージを取得するヘルパー関数
const getScoreMessage = (score: number, deficientNutrients: string[]): { title: string, description: string } => {
    let title = "";
    let description = "";

    if (score >= 80) {
        title = "素晴らしい栄養バランスです！";
        description = "この調子で健康的な食生活を続けましょう。";
    } else if (score >= 60) {
        title = "まずまずの栄養バランスです";
        description = "全体的にバランスは取れていますが、さらに改善の余地があります。";
    } else {
        title = "栄養バランスの改善が必要です";
        description = "特に不足している栄養素に注意しましょう。";
    }

    if (deficientNutrients.length > 0 && score < 90) { // スコアが高くても不足があれば言及（閾値は調整可能）
        description += ` 特に ${deficientNutrients.join('・')} が不足気味です。`;
    } else if (deficientNutrients.length === 0 && score < 80) {
        description += " 全体的な摂取量を意識してみましょう。";
    }


    return { title, description };
};

// 表示用の栄養素データ型
interface NutrientDisplayItem {
    name: string;
    key: keyof NutritionTargets;
    icon: React.ReactNode;
    percent: number;
    actual: number; // Changed from number | null to number
    target: number;
    unit: string;
}

export default function DashboardPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loadingProfile, setLoadingProfile] = useState(true)
    const [currentDate, setCurrentDate] = useState(getJapanDate())
    const [nutritionData, setNutritionData] = useState<StandardizedMealNutrition | null>(null);
    const [nutritionScore, setNutritionScore] = useState(0)
    const router = useRouter()
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // ★ 追加: SWR を使ってプロファイルを取得
    const { data: swrProfile, error: profileError } = useSWR(
        'userProfile', // キーは任意だが、ユーザーIDを使うのが一般的
        async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return null;
            const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single();
            if (error) throw error;
            return profileData as Profile | null;
        },
        {
            onSuccess: (data) => {
                setProfile(data); // 取得成功時に useState にも反映 (互換性のため)
                setLoadingProfile(false);
            },
            onError: (error) => {
                console.error('プロファイル取得エラー (SWR):', error);
                setProfile(null);
                setLoadingProfile(false);
            }
        }
    );

    // ★ 追加: SWR を使って目標値を取得
    const { data: nutritionTargets, error: targetsError } = useSWR(
        // プロファイルが取得でき、出産予定日があればそれをキーにする
        swrProfile?.due_date ? ['targets', swrProfile.due_date] : null,
        ([_, dueDate]) => targetsFetcher(dueDate),
        { fallbackData: DEFAULT_NUTRITION_TARGETS } // フォールバックデータ設定
    );

    // NutritionProgressからStandardizedMealNutritionへの変換関数
    const convertProgressToStandardized = (progress: NutritionProgress): StandardizedMealNutrition => {
        // 主要な栄養素をNutrient配列に変換
        const totalNutrients: Nutrient[] = [
            { name: 'protein', value: progress.actual_protein, unit: 'g' },
            { name: 'iron', value: progress.actual_iron, unit: 'mg' },
            { name: 'folic_acid', value: progress.actual_folic_acid, unit: 'mcg' },
            { name: 'calcium', value: progress.actual_calcium, unit: 'mg' },
            { name: 'vitamin_d', value: progress.actual_vitamin_d, unit: 'mcg' }
        ];

        // StandardizedMealNutrition形式に変換
        return {
            totalCalories: progress.actual_calories,
            totalNutrients: totalNutrients,
            foodItems: [], // 詳細な食品データは表示しないので空配列
            reliability: {
                confidence: 1.0, // DBからのデータなので信頼度は高い
                completeness: 1.0
            }
        };
    };

    useEffect(() => {
        // ★ 修正: useEffect 内のプロファイル取得ロジックを削除 (SWRに移行)
        // ★ 修正: useEffect 内の目標値設定ロジックを削除 (SWRに移行)

        // 栄養データの取得とスコア計算は useEffect 内で行う (currentDateに依存するため)
        const fetchNutritionAndCalculateScore = async () => {
            // SWRでプロファイル取得が完了しているか確認
            if (loadingProfile) return;
            // セッション確認 (SWR内でも確認しているが念のため)
            const { data: { session } } = await supabase.auth.getSession();
            if (!session || !profile) { // profile もチェック
                // setLoadingProfile(false) は不要になるか、SWRのonErrorで処理
                return; // ログインしていない、またはプロファイルがない場合は処理中断
            }

            try {
                // 栄養データを取得 (nutrition_goal_prog から)
                const { data: nutritionProgressData, error: nutritionError } = await supabase
                    .from('nutrition_goal_prog')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('meal_date', currentDate)
                    .single();

                if (nutritionError && nutritionError.code !== 'PGRST116') {
                    throw nutritionError;
                }

                if (nutritionProgressData) {
                    const progressData = nutritionProgressData as NutritionProgress;
                    // setNutritionProgress(progressData); // state管理が不要なら削除
                    const standardizedNutrition = convertProgressToStandardized(progressData);
                    setNutritionData(standardizedNutrition);

                    // --- 栄養スコア計算 (SWRで取得した nutritionTargets を使用) ---
                    if (nutritionTargets) { // nutritionTargets が取得できているか確認
                        const score = calculateNutritionScore(standardizedNutrition, nutritionTargets);
                        console.log("Calculated Nutrition Score with SWR targets:", score, "Targets:", nutritionTargets);
                        setNutritionScore(score);
                    } else {
                        // 目標値がまだ取得できていない場合の処理（例：デフォルト値で計算するか、スコアを0にする）
                        console.warn("Nutrition targets not yet available for score calculation.");
                        const score = calculateNutritionScore(standardizedNutrition, DEFAULT_NUTRITION_TARGETS);
                        setNutritionScore(score);
                        // setNutritionScore(0);
                    }

                } else {
                    // データがない場合
                    setNutritionData(null);
                    setNutritionScore(0);
                }
            } catch (error) {
                console.error('栄養データ取得またはスコア計算エラー:', error);
                setNutritionData(null);
                setNutritionScore(0);
            }
        };

        fetchNutritionAndCalculateScore();
        // ★ 修正: 依存配列に nutritionTargets と loadingProfile を追加
    }, [supabase, router, currentDate, profile, nutritionTargets, loadingProfile]);

    // 日付を変更する関数 (変更なし)
    const changeDate = (direction: 'prev' | 'next') => {
        const date = new Date(currentDate);
        // 日本時間考慮のため getJapanDate() から取得した日付を使うのが望ましいが、
        // UTCで比較しても日付の前後関係は変わらないため、ここでは簡易的に Date を使用
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 時刻部分をリセット

        const newDate = direction === 'prev'
            ? subDays(date, 1)
            : addDays(date, 1);

        // 未来の日付は選択できないようにする
        newDate.setHours(0, 0, 0, 0);

        if (newDate <= today) {
            const formattedDate = format(newDate, 'yyyy-MM-dd');
            setCurrentDate(formattedDate);
        }
    };


    // ローディング表示 (変更なし)
    if (loadingProfile) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin h-12 w-12 border-4 border-green-500 rounded-full border-t-transparent"></div>
                </div>
            </div>
        )
    }

    // プロファイルなしエラー表示 (変更なし)
    if (!profile) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-500">エラー</h1>
                    <p className="mt-2">プロフィール情報の取得に失敗しました。</p>
                    <p className="text-sm text-gray-500">再度ログインするか、プロフィール情報をご確認ください。</p>
                    <button
                        onClick={() => router.push('/profile/edit')} // プロフィール編集ページへ
                        className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                    >
                        プロフィール設定へ
                    </button>
                </div>
            </div>
        )
    }

    // ダッシュボードのメインコンテンツ
    return (
        <div className="container mx-auto py-6">
            <div className="flex flex-col space-y-4">
                {/* 日付選択 */}
                <Card className="mb-4">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-center">
                            <Button
                                onClick={() => changeDate('prev')}
                                variant="outline"
                                size="icon"
                                disabled={loadingProfile}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center">
                                <Calendar className="mr-2 h-4 w-4 text-gray-500" />
                                <span className="font-medium">
                                    {format(new Date(currentDate), 'yyyy年M月d日 (eee)', { locale: ja })}
                                </span>
                            </div>
                            <Button
                                onClick={() => changeDate('next')}
                                variant="outline"
                                size="icon"
                                disabled={
                                    loadingProfile ||
                                    format(new Date(currentDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                                }
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 栄養バランス */}
                <div className="mb-6">
                    <NutritionSummary
                        dailyNutrition={nutritionData}
                        targets={nutritionTargets || DEFAULT_NUTRITION_TARGETS}
                        isMorningWithNoMeals={!nutritionData || nutritionScore === 0}
                        showDetails={true}
                    />
                </div>

                {/* 栄養摂取状況グラフ */}
                <div className="mb-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>栄養摂取状況</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {nutritionData && nutritionScore > 0 ? (
                                <NutritionChart date={currentDate} />
                            ) : (
                                <div className="h-64 flex items-center justify-center text-gray-500">
                                    この日の栄養データがありません
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* 栄養アドバイス (AIアドバイス) */}
                <div className="mb-6">
                    <DetailedNutritionAdvice
                        selectedDate={currentDate}
                    />
                </div>
            </div>
        </div>
    );
} 