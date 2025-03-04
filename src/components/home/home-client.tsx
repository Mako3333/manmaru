"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NutritionSummary } from './nutrition-summary';
import { ActionCard } from './action-card';
import { AdviceCard } from './advice-card';
import { BottomNavigation } from '../layout/bottom-navigation';
import PregnancyWeekInfo from './pregnancy-week-info';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Calendar, Utensils, LineChart, Baby, ExternalLink, ChevronRight } from 'lucide-react';

interface HomeClientProps {
    user: any;
}

export default function HomeClient({ user }: HomeClientProps) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [nutritionData, setNutritionData] = useState<any>(null);
    const router = useRouter();
    const supabase = createClientComponentClient();

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

                setNutritionData(data || {
                    calories_percent: 0,
                    protein_percent: 0,
                    iron_percent: 0,
                    folic_acid_percent: 0,
                    calcium_percent: 0,
                    vitamin_d_percent: 0,
                    overall_score: 0
                });
            } catch (error) {
                console.error('栄養データ取得エラー:', error);
            }
        };

        fetchNutritionData();
    }, [user, currentDate, supabase]);

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
        { name: 'タンパク質', percent: nutritionData.protein_percent, icon: '🥩' },
        { name: '鉄分', percent: nutritionData.iron_percent, icon: '⚙️' },
        { name: '葉酸', percent: nutritionData.folic_acid_percent, icon: '🍃' },
        { name: 'カルシウム', percent: nutritionData.calcium_percent, icon: '🥛' },
        { name: 'ビタミンD', percent: nutritionData.vitamin_d_percent, icon: '☀️' }
    ].filter(nutrient => nutrient.percent < 70) : [];

    // 栄養素の状態に応じた色を取得
    const getNutrientColor = (percent: number) => {
        if (percent < 50) return 'text-red-500';
        if (percent < 70) return 'text-orange-500';
        return 'text-green-500';
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <header className="bg-gradient-to-r from-green-600 to-green-500 text-white p-4 shadow-md">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">manmaru</h1>
                    <Link href="/profile">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="text-sm">👤</span>
                        </div>
                    </Link>
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="flex-grow container mx-auto px-4 py-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-green-600">こんにちは、{profile.name || 'ゲスト'}さん</h1>
                        <div className="text-lg mt-2">
                            <time dateTime={currentDate} className="font-medium">
                                {format(new Date(currentDate), 'yyyy年M月d日（E）', { locale: ja })}
                            </time>
                        </div>
                    </div>
                </div>

                {/* 1. 妊娠週数情報カード */}
                <PregnancyWeekInfo />

                {/* 2. 栄養状態サマリーカード */}
                <Card className="w-full overflow-hidden">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg sm:text-xl font-bold">栄養状態サマリー</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between mb-4">
                            <div className="relative w-24 h-24">
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
                                    <span className="text-2xl font-bold">{nutritionData?.overall_score || 0}</span>
                                </div>
                            </div>
                            <div className="flex-1 ml-6">
                                {deficientNutrients.length > 0 ? (
                                    <div>
                                        <h3 className="font-medium mb-2">不足している栄養素</h3>
                                        <div className="space-y-2">
                                            {deficientNutrients.map((nutrient, index) => (
                                                <div key={index} className="flex items-center">
                                                    <span className="mr-2">{nutrient.icon}</span>
                                                    <span className="mr-2">{nutrient.name}</span>
                                                    <span className={getNutrientColor(nutrient.percent)}>
                                                        {Math.round(nutrient.percent)}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-green-600 font-medium">
                                        すべての栄養素が十分に摂取されています！
                                    </div>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full mt-2 border-green-500 text-green-600 hover:bg-green-50"
                            onClick={() => router.push('/dashboard')}
                        >
                            詳細を見る <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </CardContent>
                </Card>

                {/* 3. アドバイスカード - 修正版 */}
                <AdviceCard />

                {/* 4. 行動喚起カード */}
                <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                        <button
                            onClick={() => router.push('/meals/log')}
                            className="flex items-center justify-between w-full p-6"
                        >
                            <div className="flex items-center">
                                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
                                    <Utensils className="h-6 w-6 text-green-600" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-medium text-lg">食事を記録</h3>
                                    <p className="text-sm text-gray-500">今日の食事内容を記録しましょう</p>
                                </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-400" />
                        </button>
                    </CardContent>
                </Card>

                {/* 5. おすすめレシピカード */}
                <Card className="w-full overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg sm:text-xl font-bold">おすすめレシピ</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-4">
                            <p className="text-gray-500 mb-4">あなたに合ったレシピを準備中です</p>
                            <Button
                                variant="outline"
                                className="border-green-500 text-green-600 hover:bg-green-50"
                                onClick={() => router.push('/recipes')}
                            >
                                レシピを探す <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* ナビゲーションバー */}
            <BottomNavigation />
        </div>
    );
} 