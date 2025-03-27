import React from 'react';
import { CheckCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid';

export interface ReliabilityIndicatorProps {
    /** 栄養計算の信頼性スコア (0.0-1.0) */
    reliabilityScore: number;
    /** 見つからなかった食品の数 */
    missingFoodsCount: number;
    /** 低確信度の食品の数 */
    lowConfidenceFoodsCount: number;
    /** コンパクト表示モード */
    compact?: boolean;
    /** 追加のクラス名 */
    className?: string;
}

/**
 * 栄養計算の信頼性を視覚的に表示するコンポーネント
 * 
 * 信頼性スコアに応じて色とメッセージが変化します:
 * - 高精度 (0.7以上): 緑色
 * - 中程度の精度 (0.5-0.7): 黄色
 * - 低精度 (0.5未満): 赤色
 */
export const ReliabilityIndicator: React.FC<ReliabilityIndicatorProps> = ({
    reliabilityScore,
    missingFoodsCount,
    lowConfidenceFoodsCount,
    compact = false,
    className = ''
}) => {
    // 信頼性スコアに基づいて表示スタイルを決定
    let color = '#22c55e';  // デフォルト: 緑
    let label = '高精度';
    let icon = 'check-circle';

    if (reliabilityScore < 0.7) {
        color = '#f59e0b';  // 黄色
        label = '中程度の精度';
        icon = 'info';
    }

    if (reliabilityScore < 0.5) {
        color = '#ef4444';  // 赤
        label = '低精度';
        icon = 'alert-triangle';
    }

    if (compact) {
        return (
            <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-sm font-medium bg-opacity-10 ${className}`}
                style={{ backgroundColor: `${color}20`, color }}
            >
                {icon === 'check-circle' && <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />}
                {icon === 'info' && <InformationCircleIcon className="w-3.5 h-3.5 mr-1" />}
                {icon === 'alert-triangle' && <ExclamationTriangleIcon className="w-3.5 h-3.5 mr-1" />}
                {label}
            </span>
        );
    }

    return (
        <div className={`rounded-lg border p-4 bg-white shadow-sm ${className}`}>
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">栄養計算の信頼性</h3>
                <span
                    className="inline-flex items-center rounded-full px-2 py-1 text-sm font-medium bg-opacity-10"
                    style={{ backgroundColor: `${color}20`, color }}
                >
                    {icon === 'check-circle' && <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />}
                    {icon === 'info' && <InformationCircleIcon className="w-3.5 h-3.5 mr-1" />}
                    {icon === 'alert-triangle' && <ExclamationTriangleIcon className="w-3.5 h-3.5 mr-1" />}
                    {label}
                </span>
            </div>

            <div className="mt-4 space-y-2">
                {missingFoodsCount > 0 && (
                    <div className="flex items-center text-sm text-gray-600">
                        <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mr-2" />
                        <span>{missingFoodsCount}個の食品が見つかりませんでした</span>
                    </div>
                )}

                {lowConfidenceFoodsCount > 0 && (
                    <div className="flex items-center text-sm text-gray-600">
                        <InformationCircleIcon className="w-4 h-4 text-blue-500 mr-2" />
                        <span>{lowConfidenceFoodsCount}個の食品が低確信度でマッチしました</span>
                    </div>
                )}

                <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>信頼性</span>
                        <span>{Math.round(reliabilityScore * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${reliabilityScore * 100}%`, backgroundColor: color }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
}; 