import React from 'react';
import { ReliabilityIndicator } from './reliability-indicator';
import { StandardizedMealNutrition, Nutrient } from '@/types/nutrition';

export interface NutritionSummaryProps {
    /** 栄養データ */
    nutritionData: StandardizedMealNutrition;
    /** 見つからなかった食品の数 */
    missingFoodsCount: number;
    /** 低確信度の食品の数 */
    lowConfidenceFoodsCount: number;
    /** 詳細表示の初期状態 */
    initiallyExpanded?: boolean;
    /** コンパクト表示モード */
    compact?: boolean;
    /** 追加のクラス名 */
    className?: string;
}

/**
 * 栄養計算結果のサマリーを表示するコンポーネント
 * 
 * 主要な栄養素とその量、推奨摂取量に対する割合を表示します。
 * また、栄養計算の信頼性も表示します。
 */
export const NutritionSummary: React.FC<NutritionSummaryProps> = ({
    nutritionData,
    missingFoodsCount,
    lowConfidenceFoodsCount,
    initiallyExpanded = false,
    compact = false,
    className = ''
}) => {
    const [isExpanded, setIsExpanded] = React.useState(initiallyExpanded);
    const reliabilityScore = nutritionData?.reliability?.confidence ?? 0;
    const nutrients = nutritionData?.totalNutrients || [];

    // 表示する栄養素を絞り込む（重要な栄養素のみ、または全て）
    const displayedNutrients = isExpanded
        ? nutrients
        : nutrients.filter(n =>
            ['エネルギー', 'たんぱく質', '脂質', '炭水化物', '食物繊維', '鉄', '葉酸', 'カルシウム'].includes(n.name)
        );

    // 不足している栄養素（ここでは仮に値が推奨摂取量の70%未満を不足と定義）
    // この部分は実際のアプリケーションの要件に応じて調整する必要がある
    const deficientNutrients = nutrients.filter(n => {
        // 栄養素ごとの推奨摂取量の閾値（実際のアプリケーションでは外部から提供されるべき）
        const thresholds: Record<string, number> = {
            'たんぱく質': 60,
            'タンパク質': 60,
            'protein': 60,
            '鉄分': 20,
            '鉄': 20,
            'iron': 20,
            '葉酸': 400,
            'folic_acid': 400,
            'カルシウム': 650,
            'calcium': 650
        };

        const threshold = thresholds[n.name];
        if (!threshold) return false;

        return n.value < threshold * 0.7; // 70%未満を不足と定義
    });

    if (compact) {
        return (
            <div className={`rounded-lg border p-4 bg-white ${className}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-gray-900">栄養素サマリー</h3>
                    <ReliabilityIndicator
                        reliabilityScore={reliabilityScore}
                        missingFoodsCount={missingFoodsCount}
                        lowConfidenceFoodsCount={lowConfidenceFoodsCount}
                        compact={true}
                    />
                </div>

                {deficientNutrients.length > 0 && (
                    <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-sm font-medium text-amber-800 mb-1">不足している栄養素:</p>
                        <div className="flex flex-wrap gap-1">
                            {deficientNutrients.map(nutrient => (
                                <span
                                    key={nutrient.name}
                                    className="inline-block px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs"
                                >
                                    {nutrient.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                    {displayedNutrients.slice(0, 4).map(nutrient => {
                        // 推奨摂取量に対する割合の計算（仮の実装）
                        const thresholds: Record<string, number> = {
                            'たんぱく質': 60,
                            'タンパク質': 60,
                            'protein': 60,
                            '鉄分': 20,
                            '鉄': 20,
                            'iron': 20,
                            '葉酸': 400,
                            'folic_acid': 400,
                            'カルシウム': 650,
                            'calcium': 650
                        };

                        const threshold = thresholds[nutrient.name];
                        const percentOfDaily = threshold ? nutrient.value / threshold : undefined;

                        return (
                            <div key={nutrient.name} className="text-sm">
                                <div className="font-medium">{nutrient.name}</div>
                                <div className="text-gray-500">
                                    {nutrient.value.toFixed(1)} {nutrient.unit}
                                    {percentOfDaily !== undefined && (
                                        <span className="ml-1 text-xs">
                                            ({Math.round(percentOfDaily * 100)}%)
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {displayedNutrients.length > 4 && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                    >
                        {isExpanded ? '折りたたむ' : 'すべての栄養素を表示'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
            <div className="p-4 border-b">
                <h3 className="font-medium text-gray-900 mb-1">栄養素サマリー</h3>
                <p className="text-sm text-gray-500">この食事から摂取できる栄養素</p>
            </div>

            <div className="p-4">
                {deficientNutrients.length > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-sm font-medium text-amber-800 mb-2">不足している栄養素:</p>
                        <div className="flex flex-wrap gap-2">
                            {deficientNutrients.map(nutrient => (
                                <span
                                    key={nutrient.name}
                                    className="inline-block px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs"
                                >
                                    {nutrient.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedNutrients.map(nutrient => {
                        // 推奨摂取量に対する割合の計算（仮の実装）
                        const thresholds: Record<string, number> = {
                            'たんぱく質': 60,
                            'タンパク質': 60,
                            'protein': 60,
                            '鉄分': 20,
                            '鉄': 20,
                            'iron': 20,
                            '葉酸': 400,
                            'folic_acid': 400,
                            'カルシウム': 650,
                            'calcium': 650
                        };

                        const threshold = thresholds[nutrient.name];
                        const percentOfDaily = threshold ? nutrient.value / threshold : undefined;
                        const isDeficient = percentOfDaily !== undefined && percentOfDaily < 0.7;

                        return (
                            <div key={nutrient.name} className="flex justify-between items-center">
                                <div>
                                    <div className="font-medium">{nutrient.name}</div>
                                    <div className="text-sm text-gray-500">{nutrient.value.toFixed(1)} {nutrient.unit}</div>
                                </div>
                                {percentOfDaily !== undefined && (
                                    <div className="w-24">
                                        <div className="text-right text-sm mb-1">
                                            {Math.round(percentOfDaily * 100)}%
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div
                                                className={`h-1.5 rounded-full ${isDeficient ? 'bg-amber-500' : 'bg-green-500'}`}
                                                style={{ width: `${Math.min(100, percentOfDaily * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {nutrients.length > displayedNutrients.length && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="mt-4 text-sm text-blue-600 hover:text-blue-800 w-full text-center"
                    >
                        {isExpanded ? '主要な栄養素のみ表示' : 'すべての栄養素を表示'}
                    </button>
                )}
            </div>

            <div className="p-4 border-t">
                <ReliabilityIndicator
                    reliabilityScore={reliabilityScore}
                    missingFoodsCount={missingFoodsCount}
                    lowConfidenceFoodsCount={lowConfidenceFoodsCount}
                />
            </div>
        </div>
    );
}; 