"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NutritionSummary } from './nutrition-summary';
import { ActionCard } from './action-card';
import { AdviceCard } from './advice-card';
import { BottomNavigation } from '../layout/bottom-navigation';
import PregnancyWeekInfo from './pregnancy-week-info';
import { RecommendedRecipes } from './recommended-recipes';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Calendar, Utensils, LineChart, Baby, ExternalLink, Book, X } from 'lucide-react';
import { StandardizedMealNutrition, NutritionTarget, NutritionProgress } from '@/types/nutrition';
import { calculateNutritionScore, DEFAULT_NUTRITION_TARGETS } from '@/lib/nutrition/nutrition-display-utils';
import { getJapanDate, calculatePregnancyWeek, getTrimesterNumber } from '@/lib/date-utils';
import { OnboardingMessage } from './onboarding-message';
import type { User } from '@supabase/supabase-js';
import { UserProfile } from '@/types/user';
import { ja } from 'date-fns/locale';

// NutritionTargets 型 (DEFAULT_NUTRITION_TARGETS の型)
// calculateNutritionScore や NutritionSummary が期待する形式
type NutritionTargets = typeof DEFAULT_NUTRITION_TARGETS;

interface HomeClientProps {
    user: User | null;
}

// GreetingMessageコンポーネントの型定義
interface GreetingMessageProps {
    week?: number;
    name?: string;
}

interface AdviceCardProps {
    date?: string;
    forceUpdate?: boolean;
    profile?: UserProfile | null | undefined;
}

export default function HomeClient({ user }: HomeClientProps) {
    const router = useRouter();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentDate] = useState(getJapanDate());
    const [nutritionProgress, setNutritionProgress] = useState<NutritionProgress | null>(null);
    const [standardizedNutrition, setStandardizedNutrition] = useState<StandardizedMealNutrition | null>(null);
    const [isMorningWithNoMeals, setIsMorningWithNoMeals] = useState<boolean>(false);
    const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean>(false);
    const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
    const [userTargets, setUserTargets] = useState<NutritionTargets>(DEFAULT_NUTRITION_TARGETS);
    const [error, setError] = useState<string | null>(null);

    // コンポーネントマウント時に一度だけ初回ユーザー判定
    useEffect(() => {
        const checkOnboarding = () => {
            const hasSeen = localStorage.getItem('hasSeenOnboarding');
            if (!hasSeen) {
                setIsFirstTimeUser(true);
                setShowOnboarding(true);
            }
        };
        checkOnboarding();
    }, []);

    const fetchProfile = useCallback(async () => {
        console.log('[fetchProfile] Start');
        if (!user) {
            console.log('[fetchProfile] No user, setting loading false');
            setLoading(false);
            return;
        }
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle<UserProfile>();

            if (profileError) {
                throw profileError;
            }
            console.log('[fetchProfile] Success, profile data:', profileData);
            setProfile(profileData);
        } catch (error) {
            console.error('[fetchProfile] Error:', error);
        } finally {
            console.log('[fetchProfile] End');
        }
    }, [user, supabase]);

    // fetchProfile の useEffect
    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const fetchNutritionData = useCallback(async () => {
        console.log('[fetchNutritionData] Start');
        if (!user) {
            console.log('[fetchNutritionData] No user, skipping');
            setLoading(false);
            return;
        }
        if (profile === null || profile === undefined) {
            console.log('[fetchNutritionData] Profile not loaded yet, waiting...');
            if (profile === null) {
                setUserTargets(DEFAULT_NUTRITION_TARGETS);
                console.log('[fetchNutritionData] Profile is null, using default targets.');
            } else {
                return;
            }
        } else {
            try {
                // トライメスター計算: due_date が存在するか確認
                if (profile?.due_date) {
                    const week = calculatePregnancyWeek(profile.due_date);
                    const currentTrimester = getTrimesterNumber(week);

                    console.log(`[fetchNutritionData] Fetching targets for trimester: ${currentTrimester}`);
                    // DB から NutritionTarget 型 (id, trimester などを含む) で取得
                    const { data: targetData, error: targetError } = await supabase
                        .from('nutrition_targets')
                        .select('*')
                        .eq('trimester', currentTrimester)
                        .maybeSingle<NutritionTarget>(); // DB の行の型

                    if (targetError) {
                        console.error('[fetchNutritionData] Error fetching targets:', targetError);
                        setUserTargets(DEFAULT_NUTRITION_TARGETS); // エラー時はデフォルト
                    } else if (targetData) {
                        // DBから取得したデータ (NutritionTarget) から必要な目標値のみを抽出
                        // して、NutritionTargets 型のオブジェクトを作成
                        const extractedTargets: NutritionTargets = {
                            calories: targetData.calories ?? DEFAULT_NUTRITION_TARGETS.calories,
                            protein: targetData.protein ?? DEFAULT_NUTRITION_TARGETS.protein,
                            iron: targetData.iron ?? DEFAULT_NUTRITION_TARGETS.iron,
                            folic_acid: targetData.folic_acid ?? DEFAULT_NUTRITION_TARGETS.folic_acid,
                            calcium: targetData.calcium ?? DEFAULT_NUTRITION_TARGETS.calcium,
                            vitamin_d: targetData.vitamin_d ?? DEFAULT_NUTRITION_TARGETS.vitamin_d,
                            // 必要に応じて他の栄養素も追加
                        };
                        setUserTargets(extractedTargets);
                        console.log('[fetchNutritionData] User targets extracted and set:', extractedTargets);
                    } else {
                        setUserTargets(DEFAULT_NUTRITION_TARGETS); // データがない場合はデフォルト
                        console.log('[fetchNutritionData] No specific targets found for trimester, using default.');
                    }
                } else {
                    // due_date がない場合もデフォルト目標値を使用
                    setUserTargets(DEFAULT_NUTRITION_TARGETS);
                    console.log('[fetchNutritionData] No due_date found in profile, using default targets.');
                }
            } catch (error) {
                console.error('[fetchNutritionData] Error processing targets:', error);
                setUserTargets(DEFAULT_NUTRITION_TARGETS);
            }
        }

        console.log('[fetchNutritionData] Setting loading true');
        setLoading(true);

        const defaultProgressData = {
            user_id: user?.id ?? '',
            meal_date: currentDate,
            target_calories: DEFAULT_NUTRITION_TARGETS.calories,
            actual_calories: 0,
            calories_percent: 0,
            target_protein: DEFAULT_NUTRITION_TARGETS.protein,
            actual_protein: 0,
            protein_percent: 0,
            target_iron: DEFAULT_NUTRITION_TARGETS.iron,
            actual_iron: 0,
            iron_percent: 0,
            target_folic_acid: DEFAULT_NUTRITION_TARGETS.folic_acid,
            actual_folic_acid: 0,
            folic_acid_percent: 0,
            target_calcium: DEFAULT_NUTRITION_TARGETS.calcium,
            actual_calcium: 0,
            calcium_percent: 0,
            target_vitamin_d: DEFAULT_NUTRITION_TARGETS.vitamin_d,
            actual_vitamin_d: 0,
            vitamin_d_percent: 0
        };

        try {
            console.log(`[fetchNutritionData] Fetching data for date: ${currentDate}`);
            const { data, error } = await supabase
                .from('nutrition_goal_prog')
                .select('*')
                .eq('user_id', user.id)
                .eq('meal_date', currentDate)
                .maybeSingle<NutritionProgress>();

            if (error) {
                throw error;
            }
            console.log('[fetchNutritionData] DB response data:', data);

            const progressData: NutritionProgress = data || defaultProgressData;

            const formattedNutritionData: StandardizedMealNutrition = {
                totalCalories: progressData.actual_calories,
                totalNutrients: [
                    { name: 'protein', value: progressData.actual_protein, unit: 'g' },
                    { name: 'iron', value: progressData.actual_iron, unit: 'mg' },
                    { name: 'folic_acid', value: progressData.actual_folic_acid, unit: 'mcg' },
                    { name: 'calcium', value: progressData.actual_calcium, unit: 'mg' },
                    { name: 'vitamin_d', value: progressData.actual_vitamin_d, unit: 'mcg' },
                ],
                foodItems: [],
                pregnancySpecific: {
                    folatePercentage: progressData.folic_acid_percent,
                    ironPercentage: progressData.iron_percent,
                    calciumPercentage: progressData.calcium_percent,
                },
                reliability: {
                    confidence: data ? 0.8 : 0,
                    balanceScore: 0,
                    completeness: data ? 1 : 0
                }
            };
            console.log('[fetchNutritionData] Formatted data for score calculation:', formattedNutritionData);

            const score = calculateNutritionScore(formattedNutritionData, userTargets);
            console.log('[fetchNutritionData] Calculated Score:', score);
            formattedNutritionData.reliability.balanceScore = score;

            setNutritionProgress(progressData);
            setStandardizedNutrition(formattedNutritionData);

            const hasMealRecords = Object.entries(progressData).some(([key, value]) =>
                key.startsWith('actual_') && typeof value === 'number' && value > 0
            );
            setIsMorningWithNoMeals(!hasMealRecords);
            console.log('[fetchNutritionData] Success');

        } catch (error) {
            console.error('[fetchNutritionData] Error:', error);
            setNutritionProgress(defaultProgressData);
            setStandardizedNutrition(null);
            setIsMorningWithNoMeals(new Date().getHours() < 12);
        } finally {
            console.log('[fetchNutritionData] Setting loading false');
            setLoading(false);
            console.log('[fetchNutritionData] End');
        }
    }, [user, profile, currentDate, supabase, userTargets]);

    // fetchNutritionData の useEffect
    useEffect(() => {
        if (profile !== undefined) {
            fetchNutritionData();
        }
    }, [profile, fetchNutritionData]);

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

    if (profile === null && !loading) {
        return (
            <div className="text-center p-8">
                <h2 className="text-xl font-semibold text-orange-500 mb-4">ようこそ！</h2>
                <p className="mb-4">まずはプロフィール情報を設定して、パーソナライズされた体験を始めましょう。</p>
                <Button onClick={() => router.push('/profile/edit')}>
                    プロフィール設定へ
                </Button>
            </div>
        );
    }

    if (profile && !profile.due_date && !loading) {
        return (
            <div className="text-center p-8">
                <h2 className="text-xl font-semibold text-orange-500 mb-4">出産予定日を設定しましょう</h2>
                <p className="mb-4">出産予定日を設定すると、週数に応じた情報が表示されます。</p>
                <Button onClick={() => router.push('/profile/edit')}>
                    プロフィール設定へ
                </Button>
            </div>
        );
    }

    // 不足している栄養素を抽出
    const deficientNutrients = nutritionProgress ? [
        { name: 'カロリー', percent: nutritionProgress.calories_percent, icon: '🔥', color: 'orange' },
        { name: 'タンパク質', percent: nutritionProgress.protein_percent, icon: '🍖', color: 'red' },
        { name: '鉄分', percent: nutritionProgress.iron_percent, icon: '⚙️', color: 'red' },
        { name: '葉酸', percent: nutritionProgress.folic_acid_percent, icon: '🍃', color: 'green' },
        { name: 'カルシウム', percent: nutritionProgress.calcium_percent, icon: '🦴', color: 'blue' },
        { name: 'ビタミンD', percent: nutritionProgress.vitamin_d_percent, icon: '☀️', color: 'purple' }
    ].filter(nutrient => nutrient.percent < 70) : [];

    // 全ての栄養素が0%かどうかを確認
    const allNutrientsZero = nutritionProgress ?
        nutritionProgress.calories_percent === 0 &&
        nutritionProgress.protein_percent === 0 &&
        nutritionProgress.iron_percent === 0 &&
        nutritionProgress.folic_acid_percent === 0 &&
        nutritionProgress.calcium_percent === 0 &&
        nutritionProgress.vitamin_d_percent === 0 : false;

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

    console.log('[Render] Loading state:', loading);
    console.log('[Render] Profile state:', profile);
    console.log('[Render] NutritionProgress state:', nutritionProgress);
    console.log('[Render] StandardizedNutrition state:', standardizedNutrition);

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
                                <span>{user?.email?.charAt(0)?.toUpperCase() || '?'}</span>
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
                {profile && profile.due_date && <PregnancyWeekInfo dueDate={profile.due_date} className="rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.05)]" />}

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

                {/* 栄養バランス表示 - 統合版 */}
                {profile && standardizedNutrition && userTargets ? (
                    <NutritionSummary
                        dailyNutrition={standardizedNutrition}
                        targets={userTargets}
                        isMorningWithNoMeals={isMorningWithNoMeals}
                        profile={profile}
                    />
                ) : null}

                {/* 今日のアドバイスカード */}
                {profile && (
                    <AdviceCard date={currentDate} profile={profile} />
                )}

                {/* 5. おすすめレシピカード */}
                <RecommendedRecipes />
            </main>

            {/* ナビゲーションバー */}
            <BottomNavigation />
        </div>
    );
}

// 未使用の関数をコメントアウト
// function getScoreMessage(score: number): string { ... }
// const getNutrientColor = (percent: number) => { ... };
// function getProgressBarColor(percent: number): string { ... } 