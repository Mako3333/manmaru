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
import NutritionAdvice from '@/components/dashboard/nutrition-advice';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Calendar, Utensils, LineChart, Baby, ExternalLink } from 'lucide-react';

interface HomeClientProps {
    user: any;
}

export default function HomeClient({ user }: HomeClientProps) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
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

                {/* 妊娠週情報（拡張版） */}
                <PregnancyWeekInfo />

                {/* 栄養アドバイス */}
                <div className="mt-6">
                    <NutritionAdvice date={currentDate} />
                </div>

                {/* 栄養サマリー */}
                <div className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">今日の栄養状態</h2>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-600 hover:bg-green-50"
                            onClick={() => router.push('/dashboard')}
                        >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            詳細を確認
                        </Button>
                    </div>
                    <Card>
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="font-medium">総合スコア</span>
                                        <span className="font-medium text-green-600">75%</span>
                                    </div>
                                    <Progress value={75} className="h-2 bg-gray-200" indicatorClassName="bg-green-500" />
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span>タンパク質</span>
                                            <span className="text-green-600">85%</span>
                                        </div>
                                        <Progress value={85} className="h-1.5 bg-gray-200" indicatorClassName="bg-green-500" />
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span>鉄分</span>
                                            <span className="text-yellow-500">65%</span>
                                        </div>
                                        <Progress value={65} className="h-1.5 bg-gray-200" indicatorClassName="bg-yellow-500" />
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span>カルシウム</span>
                                            <span className="text-red-500">45%</span>
                                        </div>
                                        <Progress value={45} className="h-1.5 bg-gray-200" indicatorClassName="bg-red-500" />
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span>葉酸</span>
                                            <span className="text-green-600">90%</span>
                                        </div>
                                        <Progress value={90} className="h-1.5 bg-gray-200" indicatorClassName="bg-green-500" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* アクションカード */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-0">
                            <button
                                onClick={() => router.push('/meals/log')}
                                className="flex items-center justify-between w-full p-6"
                            >
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-4">
                                        <Utensils className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-medium">食事を記録</h3>
                                        <p className="text-sm text-gray-500">今日の食事内容を記録しましょう</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-5 w-5 text-gray-400" />
                            </button>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-0">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="flex items-center justify-between w-full p-6"
                            >
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                                        <LineChart className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-medium">体重を記録</h3>
                                        <p className="text-sm text-gray-500">定期的な体重管理が大切です</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-5 w-5 text-gray-400" />
                            </button>
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* ナビゲーションバー */}
            <BottomNavigation />
        </div>
    );
} 