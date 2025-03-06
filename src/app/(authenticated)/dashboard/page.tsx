'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { format, subDays, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Profile } from '@/lib/utils/profile'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';


// 新しいダッシュボードコンポーネントをインポート
import MealHistoryList from '@/components/dashboard/meal-history-list';
import { DetailedNutritionAdvice } from '@/components/dashboard/nutrition-advice';

// 栄養計算ユーティリティをインポート
import { NutritionCalculator } from '@/lib/nutrition/calculator';

// 栄養素アイコンマッピング
const NUTRIENT_ICONS = {
    calories: '🔥',
    protein: '🥩',
    iron: '⚙️',
    folic_acid: '🍃',
    calcium: '🥛',
    vitamin_d: '☀️',
};

export default function DashboardPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const [nutritionData, setNutritionData] = useState<any>(null)
    const [currentDate, setCurrentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [activeTab, setActiveTab] = useState<string>('today');
    const router = useRouter()
    const supabase = createClientComponentClient()

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return

                // プロファイル取得
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .single()

                if (profileError) throw profileError
                setProfile(profileData)

                // 栄養データを取得
                const { data: nutritionProgress, error: nutritionError } = await supabase
                    .from('nutrition_goal_prog')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('meal_date', currentDate)
                    .single();

                if (nutritionError && nutritionError.code !== 'PGRST116') {
                    throw nutritionError;
                }

                // 栄養データがない場合はデフォルト値を設定
                const defaultData = {
                    calories_percent: 0,
                    protein_percent: 0,
                    iron_percent: 0,
                    folic_acid_percent: 0,
                    calcium_percent: 0,
                    vitamin_d_percent: 0,
                    target_calories: 2000,
                    target_protein: 60,
                    target_iron: 27,
                    target_folic_acid: 400,
                    target_calcium: 1000,
                    target_vitamin_d: 10,
                    actual_calories: 0,
                    actual_protein: 0,
                    actual_iron: 0,
                    actual_folic_acid: 0,
                    actual_calcium: 0,
                    actual_vitamin_d: 0
                };

                // 栄養データを設定し、バランススコアを計算
                const data = nutritionProgress || defaultData;

                // 新しいNutritionCalculatorを使用してスコアを計算
                const overall_score = nutritionProgress
                    ? NutritionCalculator.calculateNutritionScoreFromProgress(nutritionProgress)
                    : 0;

                setNutritionData({
                    ...data,
                    overall_score
                });
            } catch (error) {
                console.error('データ取得エラー:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [supabase, router, currentDate])

    // 日付を変更する関数
    const changeDate = (direction: 'prev' | 'next') => {
        const date = new Date(currentDate);
        const newDate = direction === 'prev'
            ? subDays(date, 1)
            : addDays(date, 1);

        // 未来の日付は選択できないようにする
        if (newDate <= new Date()) {
            setCurrentDate(format(newDate, 'yyyy-MM-dd'));
        }
    };

    // 栄養素の状態に応じた色を取得
    const getNutrientColor = (percent: number) => {
        if (percent < 50) return 'text-red-500 bg-red-50';
        if (percent < 70) return 'text-orange-500 bg-orange-50';
        if (percent <= 110) return 'text-green-500 bg-green-50';
        if (percent <= 130) return 'text-orange-500 bg-orange-50';
        return 'text-red-500 bg-red-50';
    };

    // 栄養素の状態に応じたバーの色を取得
    const getNutrientBarColor = (percent: number) => {
        if (percent < 50) return 'bg-red-500';
        if (percent < 70) return 'bg-orange-500';
        if (percent <= 110) return 'bg-green-500';
        if (percent <= 130) return 'bg-orange-500';
        return 'bg-red-500';
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin h-12 w-12 border-4 border-green-500 rounded-full border-t-transparent"></div>
                </div>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-500">エラー</h1>
                    <p className="mt-2">プロフィール情報の取得に失敗しました。</p>
                    <button
                        onClick={() => router.push('/profile')}
                        className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                    >
                        プロフィール設定へ
                    </button>
                </div>
            </div>
        )
    }

    // 栄養素データを配列に変換
    const nutrientData = [
        {
            key: 'calories',
            name: 'カロリー',
            icon: NUTRIENT_ICONS.calories,
            percent: nutritionData?.calories_percent || 0,
            actual: nutritionData?.actual_calories || 0,
            target: nutritionData?.target_calories || 0,
            unit: 'kcal'
        },
        {
            key: 'protein',
            name: 'タンパク質',
            icon: NUTRIENT_ICONS.protein,
            percent: nutritionData?.protein_percent || 0,
            actual: nutritionData?.actual_protein || 0,
            target: nutritionData?.target_protein || 0,
            unit: 'g'
        },
        {
            key: 'iron',
            name: '鉄分',
            icon: NUTRIENT_ICONS.iron,
            percent: nutritionData?.iron_percent || 0,
            actual: nutritionData?.actual_iron || 0,
            target: nutritionData?.target_iron || 0,
            unit: 'mg'
        },
        {
            key: 'folic_acid',
            name: '葉酸',
            icon: NUTRIENT_ICONS.folic_acid,
            percent: nutritionData?.folic_acid_percent || 0,
            actual: nutritionData?.actual_folic_acid || 0,
            target: nutritionData?.target_folic_acid || 0,
            unit: 'μg'
        },
        {
            key: 'calcium',
            name: 'カルシウム',
            icon: NUTRIENT_ICONS.calcium,
            percent: nutritionData?.calcium_percent || 0,
            actual: nutritionData?.actual_calcium || 0,
            target: nutritionData?.target_calcium || 0,
            unit: 'mg'
        },
        {
            key: 'vitamin_d',
            name: 'ビタミンD',
            icon: NUTRIENT_ICONS.vitamin_d,
            percent: nutritionData?.vitamin_d_percent || 0,
            actual: nutritionData?.actual_vitamin_d || 0,
            target: nutritionData?.target_vitamin_d || 0,
            unit: 'μg'
        }
    ];

    // 不足している栄養素と十分な栄養素に分類
    const deficientNutrients = nutrientData.filter(n => n.percent < 70);
    const sufficientNutrients = nutrientData.filter(n => n.percent >= 70);

    return (
        <div className="container mx-auto px-4 py-6">
            {/* 1. 日付選択セクション */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-green-600">栄養ダッシュボード</h1>
                </div>

                <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => changeDate('prev')}
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
                        disabled={new Date(currentDate).setHours(0, 0, 0, 0) >= new Date().setHours(0, 0, 0, 0)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="today">今日</TabsTrigger>
                        <TabsTrigger value="week">週間</TabsTrigger>
                        <TabsTrigger value="month">月間</TabsTrigger>
                    </TabsList>

                    <TabsContent value="today" className="mt-4">
                        {/* 今日のタブコンテンツ */}
                        {/* 2. 栄養摂取状況カード */}
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle className="text-lg">栄養摂取状況</CardTitle>
                                <CardDescription>各栄養素の摂取状況を確認できます</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {nutrientData.map((nutrient) => (
                                        <div key={nutrient.key} className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center">
                                                    <span className="mr-2">{nutrient.icon}</span>
                                                    <span className="font-medium">{nutrient.name}</span>
                                                </div>
                                                <div className="text-sm font-medium">
                                                    <span className={`px-2 py-1 rounded-full ${getNutrientColor(nutrient.percent)}`}>
                                                        {Math.round(nutrient.percent)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                <div
                                                    className={`h-2.5 rounded-full ${getNutrientBarColor(nutrient.percent)}`}
                                                    style={{ width: `${Math.min(nutrient.percent, 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>{nutrient.actual} {nutrient.unit}</span>
                                                <span>{nutrient.target} {nutrient.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3. 栄養バランススコアカード */}
                        <Card className="mb-6">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-bold">栄養バランススコア</CardTitle>
                                <CardDescription>
                                    妊娠期に重要な栄養素の摂取状況に基づいたスコア
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col items-center">
                                    <div className="relative w-40 h-40 mb-4">
                                        <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                                        <svg className="w-full h-full" viewBox="0 0 36 36">
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#E5E7EB"
                                                strokeWidth="3"
                                            />
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#22C55E"
                                                strokeWidth="3"
                                                strokeDasharray={`${nutritionData?.overall_score || 0}, 100`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-3xl font-bold">{nutritionData?.overall_score || 0}</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-gray-600 mb-4">
                                    今日の栄養バランススコアは<span className="font-bold text-green-600">{nutritionData?.overall_score || 0}点</span>です。
                                </p>
                                <p className="text-sm text-gray-500 text-center">
                                    このスコアは妊娠期に重要な栄養素の摂取率から算出されています。
                                </p>
                            </CardContent>
                        </Card>

                        {/* 詳細栄養アドバイス */}
                        <div className="mb-6">
                            <DetailedNutritionAdvice />
                        </div>

                        {/* 食事履歴 */}
                        <div className="mt-6">
                            <h2 className="text-xl font-bold mb-4">食事履歴</h2>
                            <MealHistoryList userId={profile.user_id} />
                        </div>
                    </TabsContent>

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