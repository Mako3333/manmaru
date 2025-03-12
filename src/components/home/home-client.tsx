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
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Calendar, Utensils, LineChart, Baby, ExternalLink, ChevronRight } from 'lucide-react';
import { NutritionCalculator } from '@/lib/nutrition/calculator';
import { getJapanDate } from '@/lib/utils/date-utils';

interface HomeClientProps {
    user: any;
}

export default function HomeClient({ user }: HomeClientProps) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // 日本時間の現在日付を取得
    const [currentDate, setCurrentDate] = useState<string>(getJapanDate());
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
            <header className="bg-gradient-to-br from-[#2E9E6C] to-[#237D54] text-white p-6 pb-10 border-b-0 rounded-b-[32px] shadow-[0_4px_20px_rgba(46,158,108,0.25)] mb-8">
                <div className="container mx-auto max-w-4xl flex justify-between items-center">
                    <h1 className="text-[28px] font-extrabold">manmaru</h1>
                    <Link href="/profile">
                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#2E9E6C] font-bold text-xl shadow-md">
                            {profile?.name?.charAt(0) || 'M'}
                        </div>
                    </Link>
                </div>
                <div className="container mx-auto max-w-4xl mt-6">
                    <h2 className="text-[20px] font-semibold">こんにちは、{profile?.name || 'マタニティ'}さん</h2>
                    <time dateTime={currentDate} className="text-[15px] font-medium opacity-90 mt-1 block">
                        {format(new Date(currentDate), 'yyyy年M月d日（E）', { locale: ja })}
                    </time>
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="flex-grow container mx-auto max-w-4xl px-4 space-y-8">
                {/* 1. 妊娠週数情報カード */}
                <PregnancyWeekInfo className="rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.05)]" />

                {/* 4. 行動喚起カード - 改善版 */}
                <div className="mx-0 sm:mx-4 my-8">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <h3 className="font-semibold text-[16px] text-[#6C7A7D]">アクション</h3>
                    </div>
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
                            icon={<Calendar className="h-5 w-5" />}
                            href="/recipes"
                            accentColor="bg-[#6A8CAF]"
                            iconBgColor="bg-[#F0F7F9]"
                        />
                    </div>
                </div>

                {/* 2. 栄養状態サマリーカード */}
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
                                            background: `conic-gradient(#2E9E6C ${nutritionData?.overall_score || 0}%, #EEEEEE ${nutritionData?.overall_score || 0}%)`
                                        }}
                                    >
                                        <div className="absolute top-[5px] left-[5px] right-[5px] bottom-[5px] bg-white rounded-full flex items-center justify-center">
                                            <span className="text-[24px] font-extrabold text-[#363249]">{nutritionData?.overall_score || 0}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[15px] font-medium text-gray-700">
                                        {nutritionData?.overall_score >= 70
                                            ? '良好な栄養状態です！'
                                            : nutritionData?.overall_score >= 50
                                                ? '栄養バランスの改善が必要です'
                                                : '栄養不足が心配されます'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                                    <span className="text-red-600 text-2xl">🍖</span>
                                    <div>
                                        <p className="text-sm font-medium">タンパク質</p>
                                        <div className="flex items-center">
                                            <span className="text-red-600 font-bold">{nutritionData?.protein_percent || 0}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg">
                                    <span className="text-amber-600 text-2xl">🍃</span>
                                    <div>
                                        <p className="text-sm font-medium">葉酸</p>
                                        <div className="flex items-center">
                                            <span className="text-amber-600 font-bold">{nutritionData?.folic_acid_percent || 0}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                                    <span className="text-blue-600 text-2xl">🥛</span>
                                    <div>
                                        <p className="text-sm font-medium">カルシウム</p>
                                        <div className="flex items-center">
                                            <span className="text-blue-600 font-bold">{nutritionData?.calcium_percent || 0}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-lg">
                                    <span className="text-violet-600 text-2xl">🔬</span>
                                    <div>
                                        <p className="text-sm font-medium">ビタミンD</p>
                                        <div className="flex items-center">
                                            <span className="text-violet-600 font-bold">{nutritionData?.vitamin_d_percent || 0}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* 3. アドバイスカード - 修正版 */}
                <AdviceCard date={format(new Date(), 'yyyy-MM-dd')} className="shadow-[0_4px_16px_rgba(0,0,0,0.05)] rounded-[16px]" />



                {/* 5. おすすめレシピカード */}
                <div className="mx-0 sm:mx-4 mb-8">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <h3 className="font-semibold text-[16px] text-[#6C7A7D]">おすすめレシピ</h3>
                        <a href="/recipes" className="text-[#2E9E6C] text-[14px] font-medium">
                            すべて見る
                        </a>
                    </div>
                    <Card className="w-full overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.05)] rounded-[16px] border-none">
                        <CardContent className="p-6">
                            <div className="text-center py-4">
                                <p className="text-gray-500 mb-4">あなたに合ったレシピを準備中です</p>
                                <Button
                                    variant="outline"
                                    className="border-[#2E9E6C] text-[#2E9E6C] hover:bg-[#F0F7F4]"
                                    onClick={() => router.push('/recipes')}
                                >
                                    レシピを探す <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* ナビゲーションバー */}
            <BottomNavigation />
        </div>
    );
} 