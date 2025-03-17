import React from 'react';
import Image from 'next/image';
import { Heart, Plus } from 'lucide-react';
import { RecipeCard as RecipeCardType } from '@/types/recipe';

type RecipeCardProps = {
    recipe: RecipeCardType;
    onCardClick: (id: string) => void;
    onFavoriteToggle: (id: string, isFavorite: boolean) => void;
    onQuickLog: (id: string) => void;
};

export const RecipeCard: React.FC<RecipeCardProps> = ({
    recipe,
    onCardClick,
    onFavoriteToggle,
    onQuickLog
}) => {
    // 栄養素フォーカスに基づいてハイライトカラーを決定
    const getHighlightColor = (nutrientFocus?: string[]) => {
        if (!nutrientFocus || nutrientFocus.length === 0) return 'text-purple-600';
        if (nutrientFocus.includes('iron')) return 'text-red-600';
        if (nutrientFocus.includes('folic_acid')) return 'text-green-600';
        if (nutrientFocus.includes('calcium')) return 'text-blue-600';
        return 'text-purple-600';
    };

    // 栄養素フォーカスに基づいてハイライトテキストを生成
    const getHighlightText = (nutrientFocus?: string[]) => {
        if (!nutrientFocus || nutrientFocus.length === 0) return '栄養バランス◎';
        if (nutrientFocus.includes('iron')) return '鉄分たっぷり！';
        if (nutrientFocus.includes('folic_acid')) return '葉酸が豊富！';
        if (nutrientFocus.includes('calcium')) return 'カルシウム補給！';
        return '栄養バランス◎';
    };

    // 注意レベルに基づくスタイルを取得
    const getCautionStyle = (cautionLevel?: 'low' | 'medium' | 'high') => {
        if (!cautionLevel) return '';
        if (cautionLevel === 'high') return 'border-red-300';
        if (cautionLevel === 'medium') return 'border-yellow-300';
        return '';
    };

    // レシピタイプに基づくラベルテキスト
    const getRecipeTypeLabel = (recipeType?: string) => {
        if (!recipeType) return '料理';
        const typeMap: Record<string, string> = {
            'main_dish': '主菜',
            'side_dish': '副菜',
            'soup': '汁物',
            'staple_food': '主食',
            'dessert': 'デザート'
        };
        return typeMap[recipeType] || recipeType;
    };

    return (
        <div
            className={`recipe-card relative w-40 h-50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow ${getCautionStyle(recipe.caution_level)}`}
            style={{ width: '160px', height: '200px' }}
        >
            {/* サムネイル部分 (60%) */}
            <div
                className="recipe-card-thumbnail relative h-24 w-full cursor-pointer"
                onClick={() => onCardClick(recipe.id)}
            >
                {recipe.image_url ? (
                    <Image
                        src={recipe.image_url}
                        alt={recipe.title}
                        fill
                        className="object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400">No Image</span>
                    </div>
                )}

                {/* 注意レベルが高い場合の警告表示 */}
                {recipe.caution_level === 'high' && (
                    <div className="absolute top-1 left-1 bg-red-500 text-white text-xs px-1 py-0.5 rounded">
                        ⚠️
                    </div>
                )}
            </div>

            {/* 情報エリア (35%) */}
            <div
                className="recipe-card-info p-2 h-20 cursor-pointer"
                onClick={() => onCardClick(recipe.id)}
            >
                {/* 栄養フォーカスハイライト */}
                <div className={`text-xs font-medium ${getHighlightColor(recipe.nutrition_focus)}`}>
                    {getHighlightText(recipe.nutrition_focus)}
                </div>

                {/* タイトル (最大2行) */}
                <h3 className="recipe-card-title text-sm font-semibold mt-1 line-clamp-2">
                    {recipe.title}
                </h3>

                {/* カテゴリタグ */}
                <div className="recipe-card-category mt-1">
                    <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5">
                        {getRecipeTypeLabel(recipe.recipe_type)}
                    </span>
                </div>
            </div>

            {/* アクションエリア (5%) */}
            <div className="recipe-card-actions absolute bottom-1 right-1 flex space-x-1">
                {/* お気に入りボタン */}
                <button
                    className={`favorite-button p-1 rounded-full ${recipe.is_favorite ? 'text-red-500' : 'text-gray-400'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onFavoriteToggle(recipe.id, !recipe.is_favorite);
                    }}
                    aria-label={recipe.is_favorite ? 'お気に入りから削除' : 'お気に入りに追加'}
                >
                    <Heart size={16} fill={recipe.is_favorite ? 'currentColor' : 'none'} />
                </button>

                {/* 簡易記録ボタン */}
                <button
                    className="quick-log-button p-1 bg-blue-500 text-white rounded-full"
                    onClick={(e) => {
                        e.stopPropagation();
                        onQuickLog(recipe.id);
                    }}
                    aria-label="食事記録に追加"
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );
}; 