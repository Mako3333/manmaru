import React from 'react';
// import { FoodMatchingService } from '@/lib/food/food-matching-service';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';

interface FoodMatchBadgeProps {
    /** 類似度スコア (0.0-1.0) */
    similarity: number;
    /** バッジサイズ */
    size?: 'sm' | 'md' | 'lg';
    /** ラベルを表示するか */
    showLabel?: boolean;
}

/**
 * 食品マッチングの確信度を視覚的に表示するバッジコンポーネント
 */
export const FoodMatchBadge: React.FC<FoodMatchBadgeProps> = ({
    similarity,
    size = 'md',
    showLabel = true
}) => {
    const matchingService = FoodMatchingServiceFactory.getService();
    const display = matchingService.getConfidenceDisplay(similarity);

    // サイズに応じたクラス
    const sizeClasses = {
        sm: 'text-xs px-1.5 py-0.5',
        md: 'text-sm px-2 py-1',
        lg: 'text-base px-3 py-1.5'
    };

    return (
        <span
            className={`inline-flex items-center rounded-full ${display.colorClass} ${sizeClasses[size]} 
                 bg-opacity-10 border border-current`}
            title={display.message}
        >
            <span className="mr-1">
                <i className={`fas fa-${display.icon}`} />
            </span>
            {showLabel && (
                <span>{display.message}</span>
            )}
        </span>
    );
}; 