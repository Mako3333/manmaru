import React, { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronRight } from 'lucide-react';

interface NutritionSummaryProps {
    data: {
        overall_score: number;
        deficient_nutrients: string[];  // 元の型に戻す
    };
}

interface NutrientData {
    name: string;
    current: number;
    target: number;
    unit: string;
    percentOfTarget: number;
}

const getNutrientIcon = (nutrientName: string): ReactNode => {
    // 栄養素に応じたアイコンを返す関数
    const icons: Record<string, string> = {
        '鉄分': '⚙️',
        '葉酸': '🍃',
        'カルシウム': '🥛',
        'タンパク質': '🥩',
        'ビタミンD': '☀️',
        'カロリー': '🔥',
    };

    return icons[nutrientName] || '📊';
};

const getScoreMessage = (score: number): string => {
    if (score >= 80) return '優れています';
    if (score >= 60) return '良好です';
    return '改善が必要です';
};

export const NutritionSummary = ({ data }: NutritionSummaryProps) => {
    // サンプルデータ（本来はpropsから受け取るデータを加工して使用）
    const mockNutrients: NutrientData[] = [
        { name: 'タンパク質', current: 45, target: 60, unit: 'g', percentOfTarget: 75 },
        { name: '鉄分', current: 7, target: 10, unit: 'mg', percentOfTarget: 70 },
        { name: '葉酸', current: 300, target: 400, unit: 'μg', percentOfTarget: 75 },
        { name: 'カルシウム', current: 600, target: 1000, unit: 'mg', percentOfTarget: 60 },
    ];

    // APIから受け取った栄養素名をNutrientData型に変換
    const nutrients: NutrientData[] = data.deficient_nutrients.length > 0
        ? data.deficient_nutrients.map(nutrientName => {
            const mockMatch = mockNutrients.find(n => n.name === nutrientName) || mockNutrients[0];
            return {
                name: nutrientName,
                current: mockMatch.current,
                target: mockMatch.target,
                unit: mockMatch.unit,
                percentOfTarget: mockMatch.percentOfTarget
            };
        })
        : mockNutrients;

    const score = data.overall_score;

    return (
        <Card className="w-full overflow-hidden">
            <CardHeader className="bg-white pb-5">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <span className="inline-block w-2 h-6 bg-gradient-to-b from-[#2E9E6C] to-[#1A6B47] rounded-full"></span>
                            栄養バランス
                        </CardTitle>
                        <CardDescription className="mt-1 text-[14px]">今日の栄養摂取状況</CardDescription>
                    </div>
                    <Button size="sm" variant="ghost" className="text-[#2E9E6C]">
                        詳細を見る <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6 pt-3 bg-white">
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                    {/* 栄養スコア部分 */}
                    <div className="w-full sm:w-1/3 flex flex-col items-center">
                        <h3 className="text-sm font-medium text-gray-500 mb-3">今日のスコア</h3>
                        <div className="relative w-40 h-40 flex items-center justify-center mb-2">
                            <div
                                className="w-full h-full rounded-full"
                                style={{
                                    background: `conic-gradient(
                                        #2E9E6C ${score}%, 
                                        #E9F5F0 ${score}% 100%
                                    )`
                                }}
                            ></div>
                            <div className="absolute w-32 h-32 bg-white rounded-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-[#2E9E6C]">{score}<span className="text-xl">%</span></div>
                                    <div className="text-sm text-gray-500 mt-1">
                                        {score >= 80 ? '優れています' : score >= 60 ? '良好です' : '改善が必要です'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 栄養素グリッド部分 */}
                    <div className="w-full sm:w-2/3">
                        <h3 className="text-sm font-medium text-gray-500 mb-3">摂取栄養素</h3>
                        <div className="grid grid-cols-2 gap-5">
                            {nutrients.map((nutrient) => (
                                <div key={nutrient.name} className="bg-[#F8FBFA] p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center">
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${nutrient.percentOfTarget >= 90 ? 'bg-[#E3F3ED] text-[#2E9E6C]' :
                                                        nutrient.percentOfTarget >= 70 ? 'bg-[#FFF2DD] text-[#F59E0B]' :
                                                            'bg-[#FEECEC] text-[#EF4444]'
                                                    }`}
                                            >
                                                {getNutrientIcon(nutrient.name)}
                                            </div>
                                            <div>
                                                <div className="font-medium">{nutrient.name}</div>
                                                <div className="text-xs text-gray-500">{nutrient.current}{nutrient.unit} / {nutrient.target}{nutrient.unit}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <Progress
                                        value={nutrient.percentOfTarget}
                                        max={100}
                                        className={`h-2 ${nutrient.percentOfTarget >= 90 ? 'bg-[#E3F3ED]' :
                                                nutrient.percentOfTarget >= 70 ? 'bg-[#FFF2DD]' :
                                                    'bg-[#FEECEC]'
                                            }`}
                                        indicatorClassName={`${nutrient.percentOfTarget >= 90 ? 'bg-[#2E9E6C]' :
                                                nutrient.percentOfTarget >= 70 ? 'bg-[#F59E0B]' :
                                                    'bg-[#EF4444]'
                                            }`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}; 