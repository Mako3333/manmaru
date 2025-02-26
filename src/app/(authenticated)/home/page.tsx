'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProgressCard } from '@/components/home/progress-card'
import { NutritionSummary } from '@/components/home/nutrition-summary'
import { RecipePreview } from '@/components/home/recipe-preview'
import { DailyRecordCard } from '@/components/home/daily-record-card'
import type { Profile } from '@/lib/utils/profile'
import { DailyNutritionLog, nutrientNameMap } from '@/lib/types/nutrition'

interface NutritionSummaryData {
    deficient_nutrients: string[];
    sufficient_nutrients: string[];
    overall_score: number;
}

interface UserProfileDisplay {
    id: string;
    name: string;
    pregnancy_week: number;
    due_date: string;
    dietary_restrictions: string[];
}

export default function HomePage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const [nutritionSummary, setNutritionSummary] = useState<NutritionSummaryData>({
        deficient_nutrients: ['鉄分', '葉酸', 'カルシウム'],
        sufficient_nutrients: ['タンパク質', 'ビタミンC', '食物繊維'],
        overall_score: 75
    })
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

                // 最新の栄養ログを取得
                const today = new Date().toISOString().split('T')[0]
                const { data: nutritionLog, error: nutritionError } = await supabase
                    .from('daily_nutrition_logs')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('log_date', today)
                    .single()

                // データ構造の確認
                console.log('nutritionLog:', nutritionLog)

                if (!nutritionError && nutritionLog) {
                    // 栄養データが存在する場合は設定
                    const nutritionData = (nutritionLog as DailyNutritionLog).nutrition_data

                    // nutritionDataの構造も確認
                    console.log('nutritionData:', nutritionData)
                    console.log('summary:', nutritionData?.summary)

                    // achievement_ratesが存在するか確認
                    if (nutritionData && nutritionData.summary) {
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
                        Object.entries(nutritionData.summary).forEach(([key, value]) => {
                            achievementRates[key as keyof typeof nutritionData.summary] = Math.min(100, Math.round((value / targets[key as keyof typeof targets]) * 100)) || 0;
                        });

                        // 全体スコアを計算
                        const overallScore = Math.round(
                            Object.values(achievementRates).reduce((sum, val) => sum + val, 0) /
                            Object.keys(achievementRates).length
                        );

                        setNutritionSummary({
                            deficient_nutrients: nutritionData.deficient_nutrients || [],
                            sufficient_nutrients: Object.keys(achievementRates)
                                .filter(key => achievementRates[key] >= 90)
                                .map(n => nutrientNameMap[n] || n),
                            overall_score: overallScore
                        });
                    } else {
                        // デフォルト値を設定
                        setNutritionSummary({
                            deficient_nutrients: ['鉄分', '葉酸', 'カルシウム'],
                            sufficient_nutrients: ['タンパク質', 'ビタミンC', '食物繊維'],
                            overall_score: 75
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-zinc-600">読み込み中...</p>
            </div>
        )
    }

    // プロファイルがない場合は初期設定ページへリダイレクト
    if (!profile) {
        router.push('/profile')
        return null
    }

    // ユーザープロファイルデータの準備
    const userProfile: UserProfileDisplay = {
        id: profile.user_id,
        name: (profile as any).name || 'ユーザー',
        pregnancy_week: profile.pregnancy_week || 24,
        due_date: profile.due_date || '2024-08-15',
        dietary_restrictions: profile.dietary_restrictions || ['アルコール', '生魚']
    }

    return (
        <>
            {/* ヘッダー */}
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-green-600">manmaru</h1>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">こんにちは、{userProfile.name}さん</span>
                    </div>
                </div>
            </header>

            {/* メインコンテンツ */}
            <div className="container mx-auto px-4 py-6 space-y-6">
                {/* プログレスカード */}
                <ProgressCard
                    pregnancyWeek={userProfile.pregnancy_week}
                    dueDate={userProfile.due_date}
                />

                {/* 栄養状態サマリー */}
                <section>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold text-gray-800">栄養状態</h2>
                        <Link href="/dashboard" className="text-sm text-green-600">
                            詳細を見る
                        </Link>
                    </div>
                    <NutritionSummary data={nutritionSummary} />
                </section>

                {/* おすすめレシピ */}
                <section>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold text-gray-800">おすすめレシピ</h2>
                        <Link href="/recipes" className="text-sm text-green-600">
                            もっと見る
                        </Link>
                    </div>
                    <RecipePreview />
                </section>

                {/* 今日の記録 - 食事記録のみに修正 */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">今日の記録</h2>
                    <DailyRecordCard
                        title="食事記録"
                        icon="🍽️"
                        description="今日の食事を記録しましょう"
                        linkHref="/meals/log"
                        color="bg-green-100"
                    />
                </section>
            </div>
        </>
    )
} 