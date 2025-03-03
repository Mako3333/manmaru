'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Profile } from '@/lib/utils/profile'
import { NutritionData, DailyNutritionLog, nutrientNameMap } from '@/types/nutrition'
import type { BasicNutritionData } from '@/types/nutrition'

// 新しいダッシュボードコンポーネントをインポート
import NutritionChart from '@/components/dashboard/nutrition-chart';
import PregnancyWeekInfo from '@/components/dashboard/pregnancy-week-info';
import NutritionAdvice from '@/components/dashboard/nutrition-advice';

export default function DashboardPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const [nutritionData, setNutritionData] = useState<NutritionData | null>(null)
    const [currentDate, setCurrentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
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

                // 過去7日間の栄養ログを取得
                const today = new Date()
                const sevenDaysAgo = new Date(today)
                sevenDaysAgo.setDate(today.getDate() - 6)

                const { data: nutritionLogs, error: nutritionError } = await supabase
                    .from('daily_nutrition_logs')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .gte('log_date', sevenDaysAgo.toISOString().split('T')[0])
                    .lte('log_date', today.toISOString().split('T')[0])
                    .order('log_date', { ascending: true })

                if (nutritionError) throw nutritionError

                if (nutritionLogs && nutritionLogs.length > 0) {
                    // 最新の栄養データを使用
                    const latestLog = nutritionLogs[nutritionLogs.length - 1] as DailyNutritionLog

                    // データ構造の確認
                    console.log('latestLog:', latestLog)

                    const nutritionData = latestLog.nutrition_data

                    // nutritionDataの構造も確認
                    console.log('nutritionData:', nutritionData)
                    console.log('calories:', nutritionData?.calories, 'protein:', nutritionData?.protein)

                    // achievement_ratesが存在するか確認
                    if (nutritionData) {
                        // 達成率を計算（仮の実装）
                        const achievementRates: Record<string, number> = {};
                        const targets = {
                            iron: 100,
                            calcium: 1000,
                            protein: 60,
                            calories: 2000,
                            folic_acid: 400
                        };

                        // 各栄養素の達成率を計算
                        const nutrientKeys = ['calories', 'protein', 'iron', 'folic_acid', 'calcium', 'vitamin_d'];
                        nutrientKeys.forEach(key => {
                            const value = Number(nutritionData[key as keyof NutritionData] || 0);
                            achievementRates[key] = Math.min(100, Math.round((value / targets[key as keyof typeof targets]) * 100)) || 0;
                        });

                        // 日々の記録を変換
                        const dailyRecords = nutritionLogs.map((log: DailyNutritionLog) => {
                            const data = log.nutrition_data;
                            // 各日の達成率を計算
                            const dailyRates: Record<string, number> = {};
                            const dailyNutrientKeys = ['calories', 'protein', 'iron', 'folic_acid', 'calcium', 'vitamin_d'];
                            dailyNutrientKeys.forEach(key => {
                                const value = Number(data[key as keyof NutritionData] || 0);
                                dailyRates[key] = Math.min(100, Math.round((value / targets[key as keyof typeof targets]) * 100)) || 0;
                            });

                            // 全体スコアを計算
                            const score = Math.round(
                                Object.values(dailyRates).reduce((sum, val) => sum + val, 0) /
                                Object.keys(dailyRates).length
                            );

                            return {
                                date: log.log_date,
                                calories: data.calories || 0,
                                protein: data.protein || 0,
                                fat: 0, // データにない場合は0
                                carbs: 0, // データにない場合は0
                                score: score
                            };
                        });

                        // 全体スコアを計算
                        const overallScore = Math.round(
                            Object.values(achievementRates).reduce((sum, val) => sum + val, 0) /
                            Object.keys(achievementRates).length
                        );

                        setNutritionData({
                            calories: nutritionData.calories,
                            protein: nutritionData.protein,
                            iron: nutritionData.iron,
                            folic_acid: nutritionData.folic_acid,
                            calcium: nutritionData.calcium,
                            vitamin_d: nutritionData.vitamin_d,
                            overall_score: overallScore,
                            deficient_nutrients: nutritionData.deficient_nutrients || [],
                            sufficient_nutrients: Object.keys(achievementRates)
                                .filter(key => achievementRates[key] >= 90)
                                .map(n => nutrientNameMap[n] || n),
                            daily_records: dailyRecords
                        })
                    } else {
                        // デフォルト値を設定
                        setNutritionData({
                            calories: 1800,
                            protein: 70,
                            iron: 15,
                            folic_acid: 400,
                            calcium: 800,
                            vitamin_d: 10,
                            overall_score: 75,
                            deficient_nutrients: ['鉄分', '葉酸', 'カルシウム'],
                            sufficient_nutrients: ['タンパク質', 'ビタミンC', '食物繊維'],
                            daily_records: [
                                { date: '2023-11-01', calories: 1800, protein: 65, fat: 60, carbs: 220, score: 70 },
                                { date: '2023-11-02', calories: 1900, protein: 70, fat: 55, carbs: 230, score: 75 },
                                { date: '2023-11-03', calories: 1750, protein: 68, fat: 58, carbs: 210, score: 72 },
                                { date: '2023-11-04', calories: 2000, protein: 75, fat: 65, carbs: 240, score: 80 },
                                { date: '2023-11-05', calories: 1850, protein: 72, fat: 60, carbs: 225, score: 78 },
                                { date: '2023-11-06', calories: 1700, protein: 65, fat: 55, carbs: 205, score: 73 },
                                { date: '2023-11-07', calories: 1950, protein: 73, fat: 63, carbs: 235, score: 77 },
                            ]
                        })
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentDate(e.target.value);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-zinc-600">読み込み中...</p>
            </div>
        )
    }

    if (!profile) {
        router.push('/profile')
        return null
    }

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            {/* 日付選択 */}
            <div className="mb-6">
                <label htmlFor="date-selector" className="block text-sm font-medium mb-2">
                    日付を選択:
                </label>
                <input
                    id="date-selector"
                    type="date"
                    value={currentDate}
                    onChange={handleDateChange}
                    className="px-4 py-2 border rounded-md"
                />
                <div className="text-lg mt-2">
                    {currentDate && (
                        <time dateTime={currentDate} className="font-medium">
                            {format(new Date(currentDate), 'yyyy年M月d日（E）', { locale: ja })}
                        </time>
                    )}
                </div>
            </div>

            {/* 新しいダッシュボードコンポーネント */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* 左側エリア: 妊娠週情報 */}
                <div className="md:col-span-4">
                    <PregnancyWeekInfo className="mb-6" />
                    <NutritionAdvice date={currentDate} />
                </div>

                {/* 右側エリア: 栄養チャート */}
                <div className="md:col-span-8">
                    <NutritionChart date={currentDate} />
                </div>
            </div>

            <h1 className="text-xl font-bold text-green-600 mt-8 mb-4">週間栄養サマリー</h1>

            {/* 既存のダッシュボードコンポーネント */}
            <div className="space-y-6">
                {/* 栄養スコア */}
                <section className="bg-white rounded-xl shadow-sm p-4">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">栄養バランススコア</h2>
                    <div className="flex items-center space-x-4">
                        <div className="relative w-24 h-24">
                            <div className="w-full h-full rounded-full bg-gray-200"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl font-bold text-green-600">{nutritionData?.overall_score}</span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-600 mb-2">
                                現在の栄養バランススコアは<span className="font-semibold">{nutritionData?.overall_score}点</span>です。
                            </p>
                            <p className="text-sm text-gray-600">
                                妊娠{profile.pregnancy_week}週目に必要な栄養素をバランスよく摂取できています。
                            </p>
                        </div>
                    </div>
                </section>

                {/* 不足している栄養素 */}
                <section className="bg-white rounded-xl shadow-sm p-4">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">不足している栄養素</h2>
                    <div className="space-y-2">
                        {nutritionData?.deficient_nutrients.map((nutrient, index) => (
                            <div key={index} className="flex items-center space-x-2">
                                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                <span className="text-gray-700">{nutrient}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 十分な栄養素 */}
                <section className="bg-white rounded-xl shadow-sm p-4">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">十分な栄養素</h2>
                    <div className="space-y-2">
                        {nutritionData?.sufficient_nutrients.map((nutrient, index) => (
                            <div key={index} className="flex items-center space-x-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <span className="text-gray-700">{nutrient}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 週間栄養スコア */}
                <section className="bg-white rounded-xl shadow-sm p-4">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">週間栄養スコア</h2>
                    <div className="h-40">
                        {/* ここに実際のグラフコンポーネントを実装 */}
                        <div className="flex h-full items-end space-x-2">
                            {nutritionData?.daily_records.map((record, index) => (
                                <div key={index} className="flex-1 flex flex-col items-center">
                                    <div
                                        className="w-full bg-green-200 rounded-t-sm"
                                        style={{ height: `${record.score}%` }}
                                    ></div>
                                    <span className="text-xs text-gray-500 mt-1">
                                        {new Date(record.date).getDate()}日
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 栄養素摂取量 */}
                <section className="bg-white rounded-xl shadow-sm p-4">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">今日の栄養素摂取量</h2>

                    {nutritionData?.daily_records.slice(-1).map((record, index) => (
                        <div key={index} className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>カロリー</span>
                                    <span>{record.calories} kcal</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>タンパク質</span>
                                    <span>{record.protein} g</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '80%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>脂質</span>
                                    <span>{record.fat} g</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>炭水化物</span>
                                    <span>{record.carbs} g</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: '70%' }}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>
            </div>
        </div>
    )
} 