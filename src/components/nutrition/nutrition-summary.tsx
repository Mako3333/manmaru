import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StandardizedMealNutrition } from '@/types/nutrition';

export interface NutritionSummaryProps {
    nutritionData: StandardizedMealNutrition;
    reliabilityScore?: number | undefined;
    missingFoodsCount?: number;
    lowConfidenceFoodsCount?: number;
    className?: string;
}

/**
 * 栄養計算結果のサマリーを表示するコンポーネント
 * 
 * 主要な栄養素とその量、推奨摂取量に対する割合を表示します。
 * また、栄養計算の信頼性も表示します。
 */
export const NutritionSummary = ({
    nutritionData,
    reliabilityScore,
    missingFoodsCount = 0,
    lowConfidenceFoodsCount = 0,
    className
}: NutritionSummaryProps) => {
    // 重要な栄養素を取得
    const getImportantNutrient = (name: string) => {
        return nutritionData.totalNutrients.find(nutrient => nutrient.name === name);
    };

    // 重要な栄養素のパーセント値を取得
    const getPercentage = (name: string) => {
        const nutrient = getImportantNutrient(name);
        return nutrient?.percentDailyValue || 0;
    };

    const proteinPercentage = getPercentage('タンパク質');
    const calciumPercentage = nutritionData.pregnancySpecific?.calciumPercentage || getPercentage('カルシウム');
    const ironPercentage = nutritionData.pregnancySpecific?.ironPercentage || getPercentage('鉄分');
    const folatePercentage = nutritionData.pregnancySpecific?.folatePercentage || getPercentage('葉酸');

    const reliabilityActual = reliabilityScore || (nutritionData.reliability?.confidence ? nutritionData.reliability.confidence * 100 : 85);

    // 信頼性に基づいた色の決定
    const getReliabilityColor = (score: number) => {
        if (score >= 90) return 'text-green-500';
        if (score >= 70) return 'text-yellow-500';
        return 'text-red-500';
    };

    const reliabilityColorClass = getReliabilityColor(reliabilityActual);

    // 信頼性に影響する要因があるかどうか
    const hasReliabilityFactors = missingFoodsCount > 0 || lowConfidenceFoodsCount > 0;

    return (
        <Card className={cn('w-full', className)}>
            <CardHeader>
                <CardTitle className="text-xl">栄養素サマリー</CardTitle>
                <CardDescription>この食事から得られる主要な栄養素</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span>カロリー</span>
                        <span className="font-semibold">{nutritionData.totalCalories} kcal</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">タンパク質</span>
                            <div className="flex justify-between items-baseline">
                                <span>{getImportantNutrient('タンパク質')?.value || 0}g</span>
                                <span className="text-sm">{proteinPercentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(proteinPercentage, 100)}%` }}></div>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">カルシウム</span>
                            <div className="flex justify-between items-baseline">
                                <span>{getImportantNutrient('カルシウム')?.value || 0}mg</span>
                                <span className="text-sm">{calciumPercentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(calciumPercentage, 100)}%` }}></div>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">鉄分</span>
                            <div className="flex justify-between items-baseline">
                                <span>{getImportantNutrient('鉄分')?.value || 0}mg</span>
                                <span className="text-sm">{ironPercentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min(ironPercentage, 100)}%` }}></div>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">葉酸</span>
                            <div className="flex justify-between items-baseline">
                                <span>{getImportantNutrient('葉酸')?.value || 0}μg</span>
                                <span className="text-sm">{folatePercentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(folatePercentage, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                            <span>データ信頼性</span>
                            <span className={cn('font-semibold', reliabilityColorClass)}>
                                {reliabilityActual.toFixed(0)}%
                            </span>
                        </div>

                        {hasReliabilityFactors && (
                            <div className="mt-2 text-sm text-muted-foreground">
                                <p>信頼性に影響する要因:</p>
                                <ul className="list-disc list-inside">
                                    {missingFoodsCount > 0 && (
                                        <li>認識できなかった食品: {missingFoodsCount}個</li>
                                    )}
                                    {lowConfidenceFoodsCount > 0 && (
                                        <li>低い信頼度の食品: {lowConfidenceFoodsCount}個</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}; 