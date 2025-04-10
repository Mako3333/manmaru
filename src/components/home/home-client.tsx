"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Calendar, Utensils, LineChart, Baby, ExternalLink, Book, X, Loader2, AlertTriangle } from 'lucide-react';
import { StandardizedMealNutrition, NutritionTarget, NutritionProgress } from '@/types/nutrition';
import { calculateNutritionScore, DEFAULT_NUTRITION_TARGETS } from '@/lib/nutrition/nutrition-display-utils';
import { getJapanDate, calculatePregnancyWeek, getTrimesterNumber } from '@/lib/date-utils';
import { OnboardingMessage } from './onboarding-message';
import type { User } from '@supabase/supabase-js';
import { UserProfile } from '@/types/user';
import { ja } from 'date-fns/locale';
import useSWR from 'swr';
import { profileFetcher, targetsFetcher, progressFetcher } from '@/lib/fetchers/home-fetchers';

interface HomeClientProps {
    user: User | null;
}

interface GreetingMessageProps {
    week?: number;
}

interface AdviceCardProps {
    date?: string;
    forceUpdate?: boolean;
    profile?: UserProfile | null | undefined;
}

export default function HomeClient({ user }: HomeClientProps) {
    const router = useRouter();

    const [currentDate] = useState(getJapanDate());
    const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean>(false);
    const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

    const {
        data: profile,
        error: profileError,
        isLoading: isLoadingProfile
    } = useSWR(
        user ? user.id : null,
        profileFetcher
    );

    const {
        data: userTargets,
        error: targetsError,
        isLoading: isLoadingTargets
    } = useSWR(
        profile && profile.due_date ? profile.due_date : null,
        targetsFetcher,
        { fallbackData: DEFAULT_NUTRITION_TARGETS }
    );

    const {
        data: nutritionProgress,
        error: progressError,
        isLoading: isLoadingProgress
    } = useSWR(
        user ? [user.id, currentDate] as const : null,
        (key) => key ? progressFetcher(key[0], key[1]) : Promise.reject("No user ID or date")
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
                setIsFirstTimeUser(true);
                setShowOnboarding(true);
            }
        };
        checkOnboarding();
    }, []);

    const dismissOnboarding = () => {
        setShowOnboarding(false);
        localStorage.setItem('hasSeenOnboarding', 'true');
        setIsFirstTimeUser(false);
    };

    const isLoading = isLoadingProfile || isLoadingTargets || isLoadingProgress;
    const error = profileError || targetsError || progressError;

    const pregnancyInfo: any = useMemo(() => {
        if (!profile?.due_date) return { week: undefined, days: undefined };
        const result = calculatePregnancyWeek(profile.due_date);
        return result || { week: undefined, days: undefined };
    }, [profile?.due_date]);

    const pregnancyWeek = pregnancyInfo.week;
    const pregnancyDays = pregnancyInfo.days;

    const GreetingMessage: React.FC<GreetingMessageProps> = ({ week }) => {
        const timeOfDay = new Date().getHours() < 12 ? 'おはようございます' : 'こんにちは';
        let message = `${timeOfDay}！`;
        if (week !== undefined) {
            message += ` 妊娠${week}週ですね。`;
        }
        return <h1 className="text-xl font-medium">{message}</h1>;
    };

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
        <div className="pb-20">
            <div className="p-4 space-y-4">

                <GreetingMessage week={pregnancyWeek} />

                {profile?.due_date && (
                    <PregnancyWeekInfo dueDate={profile.due_date} />
                )}

                {standardizedNutrition && userTargets && profile && (
                    <NutritionSummary
                        dailyNutrition={standardizedNutrition}
                        targets={userTargets}
                        isMorningWithNoMeals={isMorningWithNoMeals}
                        profile={profile}
                    />
                )}

                <div className="grid grid-cols-2 gap-4">
                    <ActionCard
                        title="食事を記録する"
                        description="今日の食事を記録しましょう"
                        icon={<Utensils />}
                        href="/meals/add"
                    />
                    <ActionCard
                        title="食事履歴"
                        description="過去の記録を見る"
                        icon={<Calendar />}
                        href="/meals/history"
                    />
                </div>

                <AdviceCard date={currentDate} profile={profile} />

                <RecommendedRecipes />

            </div>

            <BottomNavigation />
        </div>
    );
}

// const getNutrientColor = (color: string) => { ... };

// 未使用の関数をコメントアウト
// function getScoreMessage(score: number): string { ... }
// const getNutrientColor = (percent: number) => { ... };
// function getProgressBarColor(percent: number): string { ... } 