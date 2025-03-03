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
import NutritionAdvice from '@/components/dashboard/nutrition-advice';
import TabsContainer from '@/components/dashboard/tabs-container';
import MealHistoryList from '@/components/dashboard/meal-history-list';
import DailyNutritionScores from '@/components/dashboard/daily-nutrition-scores';
import WeightChart from '@/components/dashboard/weight-chart';

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
                    .order('log_date', { ascending: false })

                if (nutritionError) throw nutritionError

                // 今日の栄養データを取得
                const todayLog = nutritionLogs.find(log => log.log_date === today.toISOString().split('T')[0])

                // 栄養データの初期値を設定
                const defaultNutritionData: NutritionData = {
                    calories: 0,
                    protein: 0,
                    iron: 0,
                    folic_acid: 0,
                    calcium: 0,
                    vitamin_d: 0,
                    confidence_score: 0,
                    overall_score: 0,
                    deficient_nutrients: [],
                    sufficient_nutrients: [],
                    daily_records: nutritionLogs || []
                }

                // 今日のログがあれば、そのデータを使用
                if (todayLog) {
                    defaultNutritionData.calories = todayLog.calories || 0
                    defaultNutritionData.protein = todayLog.protein || 0
                    defaultNutritionData.iron = todayLog.iron || 0
                    defaultNutritionData.folic_acid = todayLog.folic_acid || 0
                    defaultNutritionData.calcium = todayLog.calcium || 0
                    defaultNutritionData.vitamin_d = todayLog.vitamin_d || 0
                    defaultNutritionData.overall_score = todayLog.overall_score || 0

                    // 不足している栄養素を特定
                    const deficientNutrients = []
                    if (todayLog.protein_score < 70) deficientNutrients.push('protein')
                    if (todayLog.iron_score < 70) deficientNutrients.push('iron')
                    if (todayLog.folic_acid_score < 70) deficientNutrients.push('folic_acid')
                    if (todayLog.calcium_score < 70) deficientNutrients.push('calcium')
                    if (todayLog.vitamin_d_score < 70) deficientNutrients.push('vitamin_d')

                    // 十分な栄養素を特定
                    const sufficientNutrients = []
                    if (todayLog.protein_score >= 70) sufficientNutrients.push('protein')
                    if (todayLog.iron_score >= 70) sufficientNutrients.push('iron')
                    if (todayLog.folic_acid_score >= 70) sufficientNutrients.push('folic_acid')
                    if (todayLog.calcium_score >= 70) sufficientNutrients.push('calcium')
                    if (todayLog.vitamin_d_score >= 70) sufficientNutrients.push('vitamin_d')

                    defaultNutritionData.deficient_nutrients = deficientNutrients
                    defaultNutritionData.sufficient_nutrients = sufficientNutrients
                }

                setNutritionData(defaultNutritionData)
            } catch (error) {
                console.error('データ取得エラー:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [supabase, router])

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

    // タブの定義
    const tabList = [
        { id: 'meal-history', label: '食事履歴' },
        { id: 'nutrition-scores', label: '栄養スコア' },
        { id: 'weight-chart', label: '体重推移' }
    ];

    // タブコンテンツのマッピング
    const contentMap = {
        'meal-history': <MealHistoryList userId={profile.user_id} />,
        'nutrition-scores': <DailyNutritionScores userId={profile.user_id} />,
        'weight-chart': <WeightChart userId={profile.user_id} />
    };

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-green-600">栄養ダッシュボード</h1>
                    <div className="text-lg mt-2">
                        {currentDate && (
                            <time dateTime={currentDate} className="font-medium">
                                {format(new Date(currentDate), 'yyyy年M月d日（E）', { locale: ja })}
                            </time>
                        )}
                    </div>
                </div>
            </div>

            {/* 新しいダッシュボードレイアウト */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* 左側エリア: 栄養アドバイス */}
                <div className="md:col-span-4">
                    <NutritionAdvice date={currentDate} className="mb-6" />
                </div>

                {/* 右側エリア: 栄養チャート */}
                <div className="md:col-span-8">
                    <NutritionChart date={currentDate} />
                </div>
            </div>

            {/* タブコンテナ */}
            <div className="mt-8">
                <TabsContainer
                    tabList={tabList}
                    contentMap={contentMap}
                    defaultTab="meal-history"
                />
            </div>
        </div>
    )
} 