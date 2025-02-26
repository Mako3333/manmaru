import React from 'react';

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
        if (score >= 80) return 'text-green-500';
        if (score >= 60) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getScoreMessage = (score: number) => {
        if (score >= 80) return '良好です';
        if (score >= 60) return '改善の余地があります';
        return '注意が必要です';
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-4 border border-green-100">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-gray-800">総合スコア</h3>
                    <p className={`text-2xl font-bold ${getScoreColor(data.overall_score)}`}>
                        {data.overall_score}
                        <span className="text-sm ml-1">/ 100</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">栄養状態</p>
                    <p className={`font-medium ${getScoreColor(data.overall_score)}`}>
                        {getScoreMessage(data.overall_score)}
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                {data.deficient_nutrients.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">不足している栄養素</h4>
                        <div className="flex flex-wrap gap-2">
                            {data.deficient_nutrients.map((nutrient, index) => (
                                <span
                                    key={index}
                                    className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full"
                                >
                                    {nutrient}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {data.sufficient_nutrients.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">十分な栄養素</h4>
                        <div className="flex flex-wrap gap-2">
                            {data.sufficient_nutrients.map((nutrient, index) => (
                                <span
                                    key={index}
                                    className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full"
                                >
                                    {nutrient}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}; 