"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ProgressCard } from './progress-card';
import { NutritionSummary } from './nutrition-summary';
import { RecipePreview } from './recipe-preview';
import { DailyRecordCard } from './daily-record-card';
import { BottomNavigation } from '../layout/bottom-navigation';

interface HomeClientProps {
    userProfile: any;
    nutritionSummary: any;
}

export default function HomeClient({ userProfile, nutritionSummary }: HomeClientProps) {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <header className="bg-gradient-to-r from-green-600 to-green-500 text-white p-4 shadow-md">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">manmaru</h1>
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-sm">👤</span>
                    </div>
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="flex-grow container mx-auto px-4 py-6 space-y-6">
                {/* プログレスカード */}
                <ProgressCard
                    pregnancyWeek={userProfile.pregnancy_week}
                    dueDate={userProfile.due_date}
                />

                {/* 栄養状態サマリー */}
                <section>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold text-gray-800">栄養状態</h2>
                        <Link href="/nutrition" className="text-sm text-green-600">
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

                {/* 今日の記録 */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">今日の記録</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <DailyRecordCard
                            title="食事記録"
                            icon="🍽️"
                            description="今日の食事を記録しましょう"
                            linkHref="/meals/log"
                            color="bg-green-100"
                        />
                        <DailyRecordCard
                            title="体調記録"
                            icon="📝"
                            description="体調や気分を記録しましょう"
                            linkHref="/health/log"
                            color="bg-blue-100"
                        />
                    </div>
                </section>
            </main>

            {/* ナビゲーションバー */}
            <BottomNavigation />
        </div>
    );
} 