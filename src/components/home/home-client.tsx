"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NutritionSummary } from './nutrition-summary';
import { ActionCard } from './action-card';
import { AdviceCard } from './advice-card';
import { BottomNavigation } from '../layout/bottom-navigation';
import PregnancyWeekInfo from './pregnancy-week-info';
import { RecommendedRecipes } from './recommended-recipes';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Calendar, Utensils, LineChart, Baby, ExternalLink, ChevronRight, Book, X } from 'lucide-react';
import { NutritionCalculator } from '@/lib/nutrition/calculator';
import { getJapanDate } from '@/lib/utils/date-utils';
import { OnboardingMessage } from './onboarding-message';
import { MorningNutritionView } from './morning-nutrition-view';

interface HomeClientProps {
    user: any;
}

// GreetingMessageコンポーネントの型定義
interface GreetingMessageProps {
    week?: number;
    name?: string;
}

export default function HomeClient({ user }: HomeClientProps) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // 日本時間の現在日付を取得
    const [currentDate, setCurrentDate] = useState<string>(getJapanDate());
    const [nutritionData, setNutritionData] = useState<any>(null);
    const router = useRouter();
    const supabase = createClientComponentClient();

    // 状態判定用の状態
    const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean>(false);
    const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
    const [isMorningWithNoMeals, setIsMorningWithNoMeals] = useState<boolean>(false);

    // コンポーネントマウント時に一度だけ初回ユーザー判定
    useEffect(() => {
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
        const isNew = hasSeenOnboarding !== 'true';
        setIsFirstTimeUser(isNew);
        setShowOnboarding(isNew);
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error) {
                    throw error;
                }

                setProfile(data);
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user, supabase]);

    useEffect(() => {
        const fetchNutritionData = async () => {
            if (!user) return;

            try {
                const { data, error } = await supabase
                    .from('nutrition_goal_prog')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('meal_date', currentDate)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('栄養データ取得エラー:', error);
                    return;
                }

                // 栄養データがない場合はデフォルト値を設定
                const defaultData = {
                    calories_percent: 0,
                    protein_percent: 0,
                    iron_percent: 0,
                    folic_acid_percent: 0,
                    calcium_percent: 0,
                    vitamin_d_percent: 0
                };

                // 栄養データを設定し、バランススコアを計算
                const nutritionProgress = data || defaultData;

                // 新しいNutritionCalculatorを使用してスコアを計算
                const overall_score = data
                    ? NutritionCalculator.calculateNutritionScoreFromProgress(data)
                    : 0;

                setNutritionData({
                    ...nutritionProgress,
                    overall_score
                });

                // 食事記録の有無確認
                const hasMealRecords = nutritionProgress &&
                    Object.values(nutritionProgress).some(value =>
                        typeof value === 'number' &&
                        value > 0 &&
                        value !== nutritionProgress.user_id
                    );

                // 食事記録がない場合、朝用表示を有効化
                setIsMorningWithNoMeals(!hasMealRecords);
            } catch (error) {
                console.error('栄養データ取得エラー:', error);
            }
        };

        fetchNutritionData();
    }, [user, currentDate, supabase]);

    // オンボーディングを閉じる処理
    const dismissOnboarding = () => {
        setShowOnboarding(false);
        localStorage.setItem('hasSeenOnboarding', 'true');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin h-12 w-12 border-4 border-green-500 rounded-full border-t-transparent"></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center p-8">
                <h2 className="text-xl font-semibold text-red-500 mb-4">プロフィールが見つかりません</h2>
                <p className="mb-4">プロフィール情報を設定して、パーソナライズされた体験を始めましょう。</p>
                <Button onClick={() => router.push('/profile')}>
                    プロフィール設定へ
                </Button>
            </div>
        );
    }

    // 不足している栄養素を抽出
    const deficientNutrients = nutritionData ? [
        { name: 'カロリー', percent: Math.round(nutritionData.calories_percent * 10) / 10, icon: '🔥', color: 'orange' },
        { name: 'タンパク質', percent: Math.round(nutritionData.protein_percent * 10) / 10, icon: '🍖', color: 'red' },
        { name: '鉄分', percent: Math.round(nutritionData.iron_percent * 10) / 10, icon: '⚙️', color: 'red' },
        { name: '葉酸', percent: Math.round(nutritionData.folic_acid_percent * 10) / 10, icon: '🍃', color: 'green' },
        { name: 'カルシウム', percent: Math.round(nutritionData.calcium_percent * 10) / 10, icon: '🦴', color: 'blue' },
        { name: 'ビタミンD', percent: Math.round(nutritionData.vitamin_d_percent * 10) / 10, icon: '☀️', color: 'purple' }
    ].filter(nutrient => nutrient.percent < 70) : [];

    // 全ての栄養素が0%かどうかを確認
    const allNutrientsZero = nutritionData ?
        nutritionData.calories_percent === 0 &&
        nutritionData.protein_percent === 0 &&
        nutritionData.iron_percent === 0 &&
        nutritionData.folic_acid_percent === 0 &&
        nutritionData.calcium_percent === 0 &&
        nutritionData.vitamin_d_percent === 0 : false;

    // 栄養素の状態に応じた色を取得
    const getNutrientColor = (color: string) => {
        switch (color) {
            case 'red': return { bg: 'bg-red-500', text: 'text-red-600', bgLight: 'bg-red-50' };
            case 'orange': return { bg: 'bg-orange-500', text: 'text-orange-600', bgLight: 'bg-orange-50' };
            case 'yellow': return { bg: 'bg-yellow-500', text: 'text-yellow-600', bgLight: 'bg-yellow-50' };
            case 'green': return { bg: 'bg-emerald-500', text: 'text-emerald-600', bgLight: 'bg-emerald-50' };
            case 'blue': return { bg: 'bg-blue-500', text: 'text-blue-600', bgLight: 'bg-blue-50' };
            case 'purple': return { bg: 'bg-purple-500', text: 'text-purple-600', bgLight: 'bg-purple-50' };
            default: return { bg: 'bg-gray-500', text: 'text-gray-600', bgLight: 'bg-gray-50' };
        }
    };


    return (
        <div className="flex flex-col min-h-screen bg-gray-50 overflow-x-hidden">
            {/* ヘッダー - 有機的な曲線を持つ形状とグラデーション */}
            <header className="relative bg-gradient-to-r from-[#36B37E] via-[#2E9E6C] to-[#36B37E] text-white p-4 pb-12">
                {/* 波紋エフェクト */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                <div className="absolute top-6 right-16 w-16 h-16 bg-white opacity-10 rounded-full"></div>

                <div className="container mx-auto max-w-4xl relative z-10">
                    {/* ヘッダー上部: ロゴ、タイトル、プロフィールアイコン */}
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            {/* ロゴ */}
                            <div className="relative">
                                <Image
                                    src="/logo.png"
                                    alt="manmaruロゴ"
                                    width={45}
                                    height={45}
                                    className="object-contain"
                                />
                            </div>
                            <h1 className="text-[26px] font-bold tracking-tight">
                                manmaru
                            </h1>
                        </div>

                        {/* プロフィールアイコン */}
                        <Link href="/profile/edit">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#2E9E6C] font-bold text-lg">
                                <span>{profile?.name?.charAt(0) || 'M'}</span>
                            </div>
                        </Link>
                    </div>

                    {/* 日付表示 - 右に配置、背景なし */}
                    <div className="flex justify-end my-1">
                        <div className="flex items-center px-1 py-0.5">
                            <time dateTime={currentDate} className="text-[14px]">
                                {format(new Date(currentDate), 'yyyy年M月d日（E）', { locale: ja })}
                            </time>
                        </div>
                    </div>
                </div>

                {/* 下部の有機的な曲線 */}
                <div className="absolute bottom-0 left-0 right-0 h-12 overflow-hidden">
                    <svg className="absolute bottom-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 74">
                        <path
                            d="M456.464 0.0433865C277.158 -1.70575 0 50.0141 0 50.0141V74H1440V50.0141C1440 50.0141 1320.4 31.1925 1243.09 27.0276C1099.33 19.2816 1019.08 53.1981 875.138 50.0141C710.527 46.3727 621.108 1.64949 456.464 0.0433865Z"
                            fill="#f9fafb">
                        </path>
                    </svg>
                </div>
            </header>
            {/* メインコンテンツ */}
            <main className="flex-grow container mx-auto max-w-4xl px-4 pt-6 space-y-8">

                {/* 1. 妊娠週数情報カード */}
                <PregnancyWeekInfo className="rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.05)]" />

                {/* 初回ユーザーオンボーディング */}
                {isFirstTimeUser && showOnboarding && (
                    <OnboardingMessage onDismiss={dismissOnboarding} />
                )}

                {/* 3. 行動喚起カード - 改善版 */}
                <div className="mx-0 sm:mx-4 my-8">
                    <div className="grid grid-cols-2 gap-4">
                        <ActionCard
                            title="食事を記録"
                            description="今日の栄養を分析"
                            icon={<Utensils className="h-5 w-5" />}
                            href="/meals/log"
                            accentColor="bg-[#2E9E6C]"
                            iconBgColor="bg-[#F0F7F4]"
                        />
                        <ActionCard
                            title="レシピを探す"
                            description="不足栄養素を補う"
                            icon={<Book className="h-5 w-5 text-[#ff7878]" />}
                            href="/recipes"
                            accentColor="bg-[#ff7878]"
                            iconBgColor="bg-[#fff1f1]"
                        />
                    </div>
                </div>

                {/* 栄養バランス表示 */}
                {isMorningWithNoMeals ? (
                    <MorningNutritionView profile={profile} />
                ) : (
                    <div className="mx-0 sm:mx-4">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <h3 className="font-semibold text-[16px] text-[#6C7A7D]">栄養バランス</h3>
                            <a href="/dashboard" className="text-[#2E9E6C] text-[14px] font-medium">
                                詳細を見る
                            </a>
                        </div>
                        <Card className="w-full overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.05)] rounded-[16px] border-none p-6">
                            <div className="flex flex-col">
                                <div className="flex items-center mb-4">
                                    <div className="relative w-20 h-20 flex-shrink-0 mr-6">
                                        <div
                                            className="w-full h-full rounded-full flex items-center justify-center"
                                            style={{
                                                background: `conic-gradient(#2E9E6C ${Math.round(nutritionData?.overall_score || 0)}%, #EEEEEE ${Math.round(nutritionData?.overall_score || 0)}%)`
                                            }}
                                        >
                                            <div className="absolute top-[5px] left-[5px] right-[5px] bottom-[5px] bg-white rounded-full flex items-center justify-center">
                                                <span className="text-[24px] font-extrabold text-[#363249]">{Math.round(nutritionData?.overall_score || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[15px] font-medium text-gray-700">
                                            {allNutrientsZero
                                                ? '今日も元気に過ごしましょう！'
                                                : nutritionData?.overall_score >= 70
                                                    ? '良好な栄養状態です！'
                                                    : nutritionData?.overall_score >= 50
                                                        ? '栄養バランスの改善が必要です'
                                                        : '栄養不足が心配されます'}
                                        </p>
                                    </div>
                                </div>

                                {deficientNutrients.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {deficientNutrients.map((nutrient, index) => {
                                            const colorSet = getNutrientColor(nutrient.color);
                                            return (
                                                <div key={index} className={`p-3 ${colorSet.bgLight} rounded-lg`}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`${colorSet.text} text-lg`}>{nutrient.icon}</span>
                                                            <span className="text-sm font-medium">{nutrient.name}</span>
                                                        </div>
                                                        <span className={`text-xs font-bold ${colorSet.text} min-w-[40px] text-right`}>
                                                            {nutrient.percent}%
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${colorSet.bg} rounded-full`}
                                                            style={{ width: `${nutrient.percent}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-2">
                                        <p className="text-gray-500">今日はまだ栄養データがありません</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {/* 今日のアドバイスカード */}
                <AdviceCard profile={profile} />

                {/* 5. おすすめレシピカード */}
                <RecommendedRecipes />
            </main>

            {/* ナビゲーションバー */}
            <BottomNavigation />
        </div>
    );
} 