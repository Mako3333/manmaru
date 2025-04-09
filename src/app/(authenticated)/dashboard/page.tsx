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
import { StandardizedMealNutrition, NutritionProgress } from '@/types/nutrition';
import { Progress } from '@/components/ui/progress';

// 新しいダッシュボードコンポーネントをインポート
import { DetailedNutritionAdvice } from '@/components/dashboard/nutrition-advice';

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
    const [activeTab, setActiveTab] = useState('today')
    const [, _setNutritionData] = useState<StandardizedMealNutrition | null>(null); // 初期値を null に変更
    const [nutritionProgress, setNutritionProgress] = useState<NutritionProgress | null>(null)
    const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets>(DEFAULT_NUTRITION_TARGETS)
    const [nutritionScore, setNutritionScore] = useState(0)
    const router = useRouter()
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        const fetchData = async () => {
            setLoadingProfile(true); // データ取得開始時にローディング状態にする
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) {
                    router.push('/login'); // セッションがない場合はログインページへ
                    return;
                }

                // プロファイル取得
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .single()

                const userTargets = { ...DEFAULT_NUTRITION_TARGETS }; // 先に初期化
                if (profileError) {
                    console.error('プロファイル取得エラー:', profileError);
                    setProfile(null);
                } else {
                    setProfile(profileData);
                    // --- 目標値設定 ---
                    // TODO: ユーザーの妊娠週数や状態に応じて目標値を調整するロジック
                    // 例: if (profileData.trimester === 1) { userTargets.folic_acid = 640; }
                    setNutritionTargets(userTargets); // ここでセット
                }


                // 栄養データを取得 (nutrition_goal_prog から)
                const { data: nutritionProgressData, error: nutritionError } = await supabase
                    .from('nutrition_goal_prog') // テーブル名確認
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('meal_date', currentDate) // yyyy-MM-dd 形式
                    .single();

                console.log("Fetched nutrition_goal_prog for date:", currentDate, "Data:", nutritionProgressData, "Error:", nutritionError); // デバッグログ

                if (nutritionError && nutritionError.code !== 'PGRST116') { // PGRST116 はデータなしエラー
                    throw nutritionError;
                }

                if (nutritionProgressData) {
                    setNutritionProgress(nutritionProgressData); // レガシーデータも保持（必要なら）

                    // --- 栄養スコア計算 ---
                    // NutritionProgress データと調整後の目標値 (`userTargets`) でスコア計算
                    const score = calculateNutritionScore(nutritionProgressData, userTargets); // NutritionProgress型を渡す
                    console.log("Calculated Nutrition Score:", score); // デバッグログ
                    setNutritionScore(score);

                    // --- 標準化データへの変換 (任意) ---
                    // 必要であれば、ここで convertToStandardizedNutrition を使用して変換
                    // try {
                    //     const standardizedNutrition = convertToStandardizedNutrition(nutritionProgressData); // この関数の実装次第
                    //     _setNutritionData(standardizedNutrition); // 更新関数を呼び出す
                    //     console.log("Standardized Nutrition Data:", standardizedNutrition);
                    // } catch (conversionError) {
                    //     console.error("Error converting to standardized nutrition data:", conversionError);
                    //     _setNutritionData(null); // 更新関数を呼び出す
                    // }

                } else {
                    // データがない場合
                    console.log("No nutrition data found for date:", currentDate); // デバッグログ
                    setNutritionProgress(null);
                    _setNutritionData(null); // 更新関数を呼び出す
                    setNutritionScore(0); // スコアも 0
                }
            } catch (error) {
                console.error('データ取得または処理エラー:', error)
                // エラー状態をユーザーに通知するUIを追加検討
                setNutritionProgress(null);
                _setNutritionData(null); // 更新関数を呼び出す
                setNutritionScore(0);
            } finally {
                setLoadingProfile(false)
            }
        }

        fetchData()
    }, [supabase, router, currentDate]); // nutritionTargets を依存配列から削除（無限ループ回避のため、目標値設定は初回 or プロファイル変更時が適切）

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


    // 表示用栄養素リストを生成
    // nutritionProgress を元に生成する
    const nutrientItems: NutrientDisplayItem[] = Object.entries(NUTRIENT_DISPLAY_MAP).map(([name, key]) => {
        const actualKey = `actual_${key}` as keyof NutritionProgress;
        const targetKey = `target_${key}` as keyof NutritionProgress;
        const percentKey = `${key}_percent` as keyof NutritionProgress; // percent も取得しておく

        // Parse values from nutritionProgress, defaulting to 0 if null, undefined or NaN
        const actualRaw = nutritionProgress?.[actualKey];
        const targetRaw = nutritionProgress?.[targetKey];
        const percentRaw = nutritionProgress?.[percentKey];

        const actual = typeof actualRaw === 'number' ? actualRaw : (parseFloat(String(actualRaw)) || 0);
        let target = typeof targetRaw === 'number' ? targetRaw : (parseFloat(String(targetRaw)) || 0);
        let percent = typeof percentRaw === 'number' ? percentRaw : (parseFloat(String(percentRaw)) || 0);

        // If target is still 0 from progress, try getting from default targets
        if (target === 0) {
            target = nutritionTargets[key] ?? 0;
        }

        // Recalculate percent if it's 0 (or was null/invalid) from progress but can be calculated now
        // Ensure target is not zero before division
        if (target > 0 && percent === 0 && actual > 0) {
            percent = Math.round((actual / target) * 100);
        }


        // 単位を決定 (nutritionTargets のキーから推測、または固定マップ)
        let unit = 'g'; // デフォルト
        if (key === 'calories') unit = 'kcal';
        else if (key === 'iron' || key === 'calcium') unit = 'mg';
        else if (key === 'folic_acid' || key === 'vitamin_d') unit = 'μg';

        return {
            name,
            key,
            icon: NUTRIENT_ICONS[key] || '❓', // マッピングにない場合のデフォルトアイコン
            percent: percent, // Now guaranteed to be a number
            actual: actual,   // Now guaranteed to be a number
            target: target,   // Now guaranteed to be a number
            unit: unit,
        };
    });


    // 不足栄養素リストとサマリーメッセージを生成 (70%未満を不足としてフィルタリング)
    const deficientNutrients = getDeficientNutrients(nutrientItems, 70); // 70% 未満を不足と定義
    const { title: scoreTitle, description: scoreDescription } = getScoreMessage(nutritionScore, deficientNutrients);


    return (
        <div className="container mx-auto px-4 py-6">
            {/* 1. 日付選択セクション (変更なし) */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-green-600">栄養ダッシュボード</h1>
                    {/* 必要ならここに「詳細を見る」などを配置 */}
                </div>
                {/* 日付選択UI (変更なし) */}
                <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => changeDate('prev')}
                        aria-label="前の日へ"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-center">
                        <time dateTime={currentDate} className="text-lg font-medium">
                            {format(new Date(currentDate), 'yyyy年M月d日（E）', { locale: ja })}
                        </time>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => changeDate('next')}
                        disabled={format(new Date(currentDate), 'yyyy-MM-dd') === format(getJapanDate(), 'yyyy-MM-dd')} // getJapanDate()と比較
                        aria-label="次の日へ"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                {/* タブ (変更なし) */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="today">今日</TabsTrigger>
                        <TabsTrigger value="week">週間</TabsTrigger>
                        <TabsTrigger value="month">月間</TabsTrigger>
                    </TabsList>

                    <TabsContent value="today" className="mt-4">
                        {/* --- 栄養バランスカード (スコア表示とサマリーメッセージ) --- */}
                        <Card className="mb-6">
                            <CardHeader className="pb-4 pt-5"> {/* padding調整 */}
                                <div className="flex justify-between items-center mb-3">
                                    <CardTitle className="text-lg font-bold">栄養バランス</CardTitle>
                                    <Button variant="link" size="sm" onClick={() => {/* TODO: 詳細ページへの遷移実装 */ }} className="text-green-600">
                                        詳細を見る
                                    </Button>
                                </div>
                                {/* サマリーメッセージ */}
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-16 h-16 relative"> {/* 円グラフを少し小さく */}
                                        {/* 円グラフ SVG */}
                                        <svg className="w-full h-full" viewBox="0 0 36 36">
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                // 円グラフの背景色を薄いグレーに
                                                stroke="#E5E7EB" // Tailwind gray-200
                                                strokeWidth="3" // 線の太さ
                                            />
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                // スコアに応じた色に変更も可能
                                                stroke={nutritionScore >= 60 ? "#22C55E" : (nutritionScore >= 40 ? "#F97316" : "#EF4444")} // 緑・オレンジ・赤
                                                strokeWidth="3"
                                                strokeDasharray={`${nutritionScore}, 100`} // スコアに応じて円弧を描画
                                                strokeLinecap="round" // 線の端を丸く
                                                transform="rotate(-90 18 18)" // 12時の位置から開始
                                            />
                                        </svg>
                                        {/* スコア表示を中央に */}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            {/* スコアが0の場合でも表示するように修正 */}
                                            <span className="text-2xl font-bold">{nutritionScore ?? 0}</span>
                                            {/* % 単位を削除 (スコアは点数) */}
                                            {/* <span className="text-xs ml-0.5">%</span> */}
                                        </div>
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <p className="font-semibold text-base">{scoreTitle}</p>
                                        <p className="text-sm text-gray-600 mt-1">{scoreDescription}</p>
                                    </div>
                                </div>
                            </CardHeader>
                            {/* --- 栄養摂取状況グリッド --- */}
                            <CardContent>
                                <div className="grid grid-cols-3 gap-x-4 gap-y-5"> {/* 3列グリッド */}
                                    {nutrientItems.map((nutrient) => (
                                        <div key={nutrient.key} className="flex flex-col items-center text-center space-y-1">
                                            {/* アイコン背景 */}
                                            <div className={`w-10 h-10 mb-1 rounded-full flex items-center justify-center ${getNutrientColor(nutrient.percent).split(' ')[1] ?? 'bg-gray-100'}`}>
                                                {nutrient.icon}
                                            </div>
                                            {/* 栄養素名と達成率 */}
                                            <p className="text-sm font-medium">{nutrient.name}</p>
                                            <p className={`text-base font-bold ${getNutrientColor(nutrient.percent).split(' ')[0] ?? 'text-gray-700'}`}>
                                                {Math.round(nutrient.percent)}%
                                            </p>
                                            {/* プログレスバー */}
                                            <div className="w-full px-1">
                                                <Progress
                                                    value={Math.min(nutrient.percent, 100)}
                                                    className={`h-1.5 ${getNutrientBarColor(nutrient.percent)}`}
                                                />
                                            </div>
                                            {/* 実績値と目標値 (オプション表示) */}
                                            <p className="text-xs text-gray-500 mt-0">
                                                {nutrient.actual}{nutrient.unit} / {nutrient.target}{nutrient.unit}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>


                        {/* 詳細栄養アドバイス (変更なし) */}
                        <div className="mb-6">
                            <DetailedNutritionAdvice
                                selectedDate={currentDate}
                                onDateSelect={(date) => setCurrentDate(date)}
                            />
                        </div>

                    </TabsContent>

                    {/* 週間・月間タブ (変更なし) */}
                    <TabsContent value="week" className="mt-4">
                        <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed rounded-lg bg-gray-50">
                            <Clock className="h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-700">実装中</h3>
                            <p className="text-sm text-gray-500 text-center mt-2">
                                週間レポート機能は現在開発中です。<br />
                                次回のアップデートをお待ちください。
                            </p>
                        </div>
                    </TabsContent>
                    <TabsContent value="month" className="mt-4">
                        <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed rounded-lg bg-gray-50">
                            <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-700">実装中</h3>
                            <p className="text-sm text-gray-500 text-center mt-2">
                                月間レポート機能は現在開発中です。<br />
                                次回のアップデートをお待ちください。
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
} 