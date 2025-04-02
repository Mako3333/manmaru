import React, { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronRight } from 'lucide-react';
import { NutritionData, calculateNutritionScore } from '@/lib/nutrition/nutrition-display-utils';

interface NutritionSummaryProps {
    dailyNutrition: NutritionData | null;
}

export function NutritionSummary({ dailyNutrition }: NutritionSummaryProps) {
    const router = useRouter();

    // 栄養バランススコアの計算（共通ユーティリティを使用）
    const nutritionScore = calculateNutritionScore(dailyNutrition);

    // スコアに応じたメッセージ
    const getMessage = (score: number): string => {
        if (score === 0) return "今日も元気に過ごしましょう！";
        if (score < 30) return "食事記録を始めました！";
        if (score < 60) return "バランスよく食べています！";
        return "栄養バランスは良好です！";
    };

    return (
        <Card className="mb-4">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">栄養バランス</CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-sm font-normal text-gray-500 h-auto p-1"
                        onClick={() => router.push('/dashboard')}
                    >
                        詳細を見る
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mr-4 relative">
                        {nutritionScore > 0 && (
                            <div
                                className="absolute inset-0 rounded-full border-4 border-green-500"
                                style={{
                                    clipPath: `polygon(0 0, 100% 0, 100% ${nutritionScore}%, 0% ${nutritionScore}%)`,
                                    opacity: 0.7
                                }}
                            ></div>
                        )}
                        <span className="text-2xl font-bold">{nutritionScore}</span>
                    </div>
                    <p className="text-gray-600">{getMessage(nutritionScore)}</p>
                </div>

                {/* 栄養素グリッド表示 */}
                <div className="grid grid-cols-2 gap-2">
                    {renderNutritionItems(dailyNutrition)}
                </div>
            </CardContent>
        </Card>
    );
}

// 栄養素アイテム表示
function renderNutritionItems(dailyNutrition: NutritionData | null) {
    const items = [
        { key: 'calories_percent', name: 'カロリー', icon: '🔥', color: 'orange' },
        { key: 'protein_percent', name: 'タンパク質', icon: '🥩', color: 'red' },
        { key: 'iron_percent', name: '鉄分', icon: 'Fe', color: 'purple' },
        { key: 'folic_acid_percent', name: '葉酸', icon: '🥬', color: 'green' },
        { key: 'calcium_percent', name: 'カルシウム', icon: '🥛', color: 'blue' },
        { key: 'vitamin_d_percent', name: 'ビタミンD', icon: '☀️', color: 'yellow' }
    ];

    return items.map(item => {
        // キーが存在し、値が数値であることを確認
        const value = dailyNutrition &&
            typeof dailyNutrition[item.key as keyof NutritionData] === 'number'
            ? dailyNutrition[item.key as keyof NutritionData] as number
            : 0;

        const percentValue = Math.round(value);
        const colorClass = getColorForPercent(percentValue);

        return (
            <div key={item.key} className="bg-gray-50 rounded p-2 flex items-center">
                <div className={`w-6 h-6 rounded-full ${getBackgroundColor(item.color)} flex items-center justify-center mr-2`}>
                    <span className={`${getTextColor(item.color)} text-xs`}>{item.icon}</span>
                </div>
                <div className="flex-1">
                    <div className="flex justify-between">
                        <span className="text-sm">{item.name}</span>
                        <span className="text-sm font-medium">
                            {percentValue}%
                        </span>
                    </div>
                    <Progress value={percentValue} className={`h-1 mt-1 ${colorClass}`} />
                </div>
            </div>
        );
    });
}

// パーセント値に基づく色クラスの取得
function getColorForPercent(percent: number): string {
    if (percent >= 80) return "bg-green-500";
    if (percent >= 60) return "bg-yellow-500";
    if (percent > 0) return "bg-orange-500";
    return "bg-gray-300";
}

// アイコン背景色の取得
function getBackgroundColor(color: string): string {
    const colorMap: Record<string, string> = {
        'orange': 'bg-orange-100',
        'red': 'bg-red-100',
        'green': 'bg-green-100',
        'blue': 'bg-blue-100',
        'purple': 'bg-purple-100',
        'yellow': 'bg-yellow-100'
    };

    return colorMap[color] || 'bg-gray-100';
}

// アイコンテキスト色の取得
function getTextColor(color: string): string {
    const colorMap: Record<string, string> = {
        'orange': 'text-orange-600',
        'red': 'text-red-600',
        'green': 'text-green-600',
        'blue': 'text-blue-600',
        'purple': 'text-purple-600',
        'yellow': 'text-yellow-600'
    };

    return colorMap[color] || 'text-gray-600';
} 