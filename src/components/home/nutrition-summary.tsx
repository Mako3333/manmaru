import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface NutritionSummaryProps {
    data: {
        deficient_nutrients: string[];
        sufficient_nutrients: string[];
        overall_score: number;
    };
}

export const NutritionSummary: React.FC<NutritionSummaryProps> = ({ data }) => {
    // 栄養スコアに基づく色とメッセージ
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-500 from-green-500 to-green-300';
        if (score >= 60) return 'text-yellow-500 from-yellow-500 to-yellow-300';
        return 'text-red-500 from-red-500 to-red-300';
    };

    const getScoreMessage = (score: number) => {
        if (score >= 80) return '良好です';
        if (score >= 60) return '改善の余地があります';
        return '注意が必要です';
    };

    // スコアに基づくバックグラウンドスタイル
    const scoreColor = getScoreColor(data.overall_score);
    const colorClasses = scoreColor.split(' ');
    const textColor = colorClasses[0];
    const gradientColors = `bg-gradient-to-r ${colorClasses[1]} ${colorClasses[2]}`;

    return (
        <div className="bg-white rounded-xl shadow-sm p-4 border border-green-100">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-16 h-16 ${gradientColors} rounded-full flex items-center justify-center`}>
                        <span className="text-white text-xl font-bold">{data.overall_score}</span>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">栄養状態</h3>
                        <p className={`${textColor} font-medium`}>
                            {getScoreMessage(data.overall_score)}
                        </p>
                    </div>
                </div>
            </div>

            {data.deficient_nutrients.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">不足している栄養素</h4>
                    <div className="flex flex-wrap gap-2">
                        {data.deficient_nutrients.map((nutrient, index) => (
                            <span
                                key={index}
                                className="px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-full flex items-center"
                            >
                                {getNutrientIcon(nutrient)} {nutrient}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-4">
                <Button variant="outline" asChild className="w-full">
                    <Link href="/dashboard">
                        詳細を見る <span className="ml-1">→</span>
                    </Link>
                </Button>
            </div>
        </div>
    );
};

// 栄養素に応じたアイコンを返す関数
const getNutrientIcon = (nutrient: string) => {
    const icons: Record<string, string> = {
        '鉄分': '⚙️',
        '葉酸': '🍃',
        'カルシウム': '🥛',
        'タンパク質': '🥩',
        'ビタミンD': '☀️',
        'カロリー': '🔥',
    };

    return icons[nutrient] || '📊';
}; 