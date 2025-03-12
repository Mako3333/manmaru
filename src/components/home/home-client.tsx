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
import { ArrowRight, Calendar, Utensils, LineChart, Baby, ExternalLink, ChevronRight, Book } from 'lucide-react';
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
                <div className="container mx-auto max-w-4xl mt-4">

                    <time dateTime={currentDate} className="text-[15px] font-medium opacity-90 mt-1 block">
                        {format(new Date(currentDate), 'yyyy年M月d日（E）', { locale: ja })}
                    </time>
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="flex-grow container mx-auto max-w-4xl px-4 space-y-8">
                {/* 1. 妊娠週数情報カード */}
                <PregnancyWeekInfo className="rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.05)]" />

                {/* 2. 行動喚起カード - 改善版 */}
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

                {/* 3. 栄養状態サマリーカード */}
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