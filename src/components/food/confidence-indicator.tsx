import React from 'react';
import { CheckCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';

export interface ConfidenceIndicatorProps {
    /** 確信度スコア (0.0-1.0) */
    confidenceScore: number;
    /** サイズ */
    size?: 'sm' | 'md' | 'lg';
    /** ラベルを表示するか */
    showLabel?: boolean;
    /** アイコンを表示するか */
    showIcon?: boolean;
    /** バッジスタイル */
    badgeStyle?: boolean;
    /** 追加のクラス名 */
    className?: string;
}

/**
 * 確信度を視覚的に表示するコンポーネント
 * 
 * 確信度スコアに応じて色とラベルが変化します:
 * - 高確信度 (0.85以上): 緑色
 * - 中確信度 (0.7以上): 青色
 * - 低確信度 (0.5以上): 黄色
 * - 非常に低い確信度 (0.35以上): オレンジ色
 */
export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
    confidenceScore,
    size = 'md',
    showLabel = true,
    showIcon = true,
    badgeStyle = true,
    className = ''
}) => {
    const matchingService = FoodMatchingServiceFactory.getService();
    const display = matchingService.getConfidenceDisplay(confidenceScore);

    // サイズに応じたクラス
    const sizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    };

    if (badgeStyle) {
        const paddingClass = {
            sm: 'px-1.5 py-0.5',
            md: 'px-2 py-1',
            lg: 'px-3 py-1.5'
        };

        return (
            <span
                className={`inline-flex items-center rounded-full ${paddingClass[size]} ${sizeClasses[size]} font-medium ${display.colorClass} bg-opacity-10 ${className}`}
            >
                {showIcon && (
                    <span className="mr-1">
                        {display.icon === 'check-circle' && <CheckCircleIcon className="w-3.5 h-3.5" />}
                        {display.icon === 'info-circle' && <InformationCircleIcon className="w-3.5 h-3.5" />}
                        {display.icon === 'exclamation-circle' && <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
                    </span>
                )}
                {showLabel && display.message}
            </span>
        );
    }

    // バッジスタイルではない場合はシンプルな表示
    return (
        <span className={`inline-flex items-center ${sizeClasses[size]} ${display.colorClass} ${className}`}>
            {showIcon && (
                <span className="mr-1">
                    {display.icon === 'check-circle' && <CheckCircleIcon className="w-3.5 h-3.5" />}
                    {display.icon === 'info-circle' && <InformationCircleIcon className="w-3.5 h-3.5" />}
                    {display.icon === 'exclamation-circle' && <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
                </span>
            )}
            {showLabel && display.message}
        </span>
    );
}; 