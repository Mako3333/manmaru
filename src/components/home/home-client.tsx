"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { NutritionSummary } from './nutrition-summary';
import { ActionCard } from './action-card';
import { AdviceCard } from './advice-card';
import { BottomNavigation } from '../layout/bottom-navigation';
import PregnancyWeekInfo from './pregnancy-week-info';
import { RecommendedRecipes } from './recommended-recipes';
import { Utensils, Loader2, AlertTriangle, Book } from 'lucide-react';
import { StandardizedMealNutrition, NutritionProgress } from '@/types/nutrition';
import { calculateNutritionScore, DEFAULT_NUTRITION_TARGETS } from '@/lib/nutrition/nutrition-display-utils';
import { getJapanDate, calculatePregnancyWeek } from '@/lib/date-utils';
import { OnboardingMessage } from './onboarding-message';
import type { User } from '@supabase/supabase-js';
import { UserProfile } from '@/types/user';
import { ja } from 'date-fns/locale';
import useSWR from 'swr';
import { profileFetcher, targetsFetcher, progressFetcher } from '@/lib/fetchers/home-fetchers';

interface HomeClientProps {
    initialData: {
        profile: UserProfile | null;
        targets: typeof DEFAULT_NUTRITION_TARGETS | null;
        progress: NutritionProgress | null;
    };
    user: User | null;
}

export default function HomeClient({ user, initialData }: HomeClientProps) {
    console.log('[HomeClient] Initial render. User:', user, 'InitialData:', initialData);

    const [currentDate] = useState(getJapanDate());
    console.log('[HomeClient] Current Date:', currentDate);
    const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

    console.log('[HomeClient] SWR Key for profile:', user ? user.id : null);
    const {
        data: profile,
        error: profileError,
        isLoading: isLoadingProfile
    } = useSWR(
        user ? user.id : null,
        profileFetcher,
        {
            fallbackData: initialData.profile,
        }
    );

    useEffect(() => {
        console.log('[HomeClient] Profile fetched (or changed via useEffect):', profile);
        console.log('[HomeClient] Profile due_date (via useEffect):', profile?.due_date);
    }, [profile]);

    console.log('[HomeClient] SWR Key for targets:', profile && profile.due_date ? profile.due_date : null);
    const {
        data: userTargets,
        error: targetsError,
        isLoading: isLoadingTargets
    } = useSWR(
        profile && profile.due_date ? profile.due_date : null,
        targetsFetcher,
        { fallbackData: initialData.targets ?? DEFAULT_NUTRITION_TARGETS }
    );

    console.log('[HomeClient] SWR Key for progress:', user ? [user.id, currentDate] as const : null);
    const {
        data: nutritionProgress,
        error: progressError,
        isLoading: isLoadingProgress
    } = useSWR(
        user ? [user.id, currentDate] as const : null,
        (key) => key ? progressFetcher(key[0], key[1]) : Promise.reject("No user ID or date"),
        { fallbackData: initialData.progress }
    );

    const standardizedNutrition = useMemo(() => {
        if (!nutritionProgress || !userTargets) return null;
        const isDataValid = nutritionProgress !== null;

        console.log('[useMemo] Calculating standardizedNutrition. Progress:', nutritionProgress, 'Targets:', userTargets);

        const formatted: StandardizedMealNutrition = {
            totalCalories: nutritionProgress.actual_calories,
            totalNutrients: [
                { name: 'protein', value: nutritionProgress.actual_protein, unit: 'g' },
                { name: 'iron', value: nutritionProgress.actual_iron, unit: 'mg' },
                { name: 'folic_acid', value: nutritionProgress.actual_folic_acid, unit: 'mcg' },
                { name: 'calcium', value: nutritionProgress.actual_calcium, unit: 'mg' },
                { name: 'vitamin_d', value: nutritionProgress.actual_vitamin_d, unit: 'mcg' },
            ],
            foodItems: [],
            pregnancySpecific: {
                folatePercentage: nutritionProgress.folic_acid_percent,
                ironPercentage: nutritionProgress.iron_percent,
                calciumPercentage: nutritionProgress.calcium_percent,
            },
            reliability: {
                confidence: isDataValid ? 0.8 : 0,
                balanceScore: 0,
                completeness: isDataValid ? 1 : 0,
            }
        };

        const score = calculateNutritionScore(formatted, userTargets);
        formatted.reliability.balanceScore = score;
        console.log('[useMemo] Calculated score:', score);

        return formatted;
    }, [nutritionProgress, userTargets]);

    const isMorningWithNoMeals = useMemo(() => {
        if (!nutritionProgress) return true;
        return ![
            nutritionProgress.actual_calories,
            nutritionProgress.actual_protein,
            nutritionProgress.actual_iron,
            nutritionProgress.actual_folic_acid,
            nutritionProgress.actual_calcium,
            nutritionProgress.actual_vitamin_d
        ].some(val => val > 0);
    }, [nutritionProgress]);

    useEffect(() => {
        const checkOnboarding = () => {
            const hasSeen = localStorage.getItem('hasSeenOnboarding');
            if (!hasSeen) {
                setShowOnboarding(true);
            }
        };
        checkOnboarding();
    }, []);

    const dismissOnboarding = () => {
        setShowOnboarding(false);
        localStorage.setItem('hasSeenOnboarding', 'true');
    };

    const isLoading = isLoadingProfile || isLoadingTargets || isLoadingProgress;
    const error = profileError || targetsError || progressError;

    const pregnancyInfo = useMemo<{ week: number | undefined; days: number | undefined }>(() => {
        if (!profile?.due_date) return { week: undefined, days: undefined };
        return calculatePregnancyWeek(profile.due_date);
    }, [profile?.due_date]);

    if (showOnboarding) {
        return <OnboardingMessage onDismiss={dismissOnboarding} />;
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-[#2E9E6C]" />
            </div>
        );
    }

    if (error) {
        console.error("[HomeClient] Data fetching error:", error);
        let errorMessage = "データの読み込み中にエラーが発生しました。";
        if (profileError) errorMessage += " (プロファイル)";
        if (targetsError) errorMessage += " (目標)";
        if (progressError) errorMessage += " (進捗)";

        return (
            <div className="flex flex-col justify-center items-center h-screen p-4 text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-lg text-red-700 mb-2">エラー</p>
                <p className="text-sm text-gray-600 mb-4">{errorMessage}</p>
                <Button onClick={() => window.location.reload()}>再読み込み</Button>
            </div>
        );
    }

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
                {profile?.due_date && (
                    <PregnancyWeekInfo dueDate={profile.due_date} />
                )}

                {/* ActionCards section MOVED UP */}
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

                {/* NutritionSummary section MOVED DOWN */}
                {userTargets && profile && (
                    <NutritionSummary
                        dailyNutrition={standardizedNutrition}
                        targets={userTargets}
                        isMorningWithNoMeals={isMorningWithNoMeals}
                        profile={profile}
                    />
                )}

                {/* AdviceCard remains after NutritionSummary */}
                {profile && (
                    <AdviceCard date={currentDate} profile={profile} />
                )}

                <RecommendedRecipes />


            </main>

            <BottomNavigation />
        </div>
    );
}

// const getNutrientColor = (color: string) => { ... };

// 未使用の関数をコメントアウト
// function getScoreMessage(score: number): string { ... }
// const getNutrientColor = (percent: number) => { ... };
// function getProgressBarColor(percent: number): string { ... } 