import React from 'react';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { RecipeCard as RecipeCardType } from '@/types/recipe';

type RecipeCardProps = {
    recipe: RecipeCardType;
    onCardClick: (id: string) => void;
    onFavoriteToggle: (id: string, isFavorite: boolean) => void;
};

export const RecipeCard: React.FC<RecipeCardProps> = ({
    recipe,
    onCardClick,
    onFavoriteToggle
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

    // ソーシャルメディアかどうかを判定
    const isSocialMedia = recipe.source_platform === 'Instagram' || recipe.source_platform === 'TikTok' || recipe.use_placeholder === true;

    // プレースホルダー背景色
    const getPlaceholderBgColor = () => {
        if (recipe.source_platform === 'Instagram') {
            return 'bg-gradient-to-tr from-purple-500 via-pink-600 to-orange-400';
        }
        if (recipe.source_platform === 'TikTok') {
            return 'bg-black';
        }
        return 'bg-gray-200';
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
                {recipe.image_url && !recipe.use_placeholder ? (
                    <Image
                        src={recipe.image_url}
                        alt={recipe.title}
                        fill
                        className="object-cover"
                    />
                ) : isSocialMedia ? (
                    // ソーシャルメディアのプレースホルダー
                    <div className={`w-full h-full ${getPlaceholderBgColor()} flex items-center justify-center`}>
                        <div className="text-white text-center">
                            <div className="relative w-6 h-6 mx-auto">
                                <Image
                                    src={`/icons/${recipe.source_platform?.toLowerCase()}.svg`}
                                    alt={recipe.source_platform || ''}
                                    width={24}
                                    height={24}
                                    className="object-contain"
                                />
                            </div>
                        </div>
                    </div>
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

                {/* ソーシャルメディアアイコン */}
                {isSocialMedia && (
                    <div className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow-sm">
                        {recipe.source_platform === 'Instagram' ? (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <linearGradient id="instagramGradient" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#FBCD07" />
                                    <stop offset="50%" stopColor="#E94E76" />
                                    <stop offset="100%" stopColor="#6B54D7" />
                                </linearGradient>
                                <path d="M12 2C14.717 2 15.056 2.01 16.122 2.06C17.187 2.11 17.912 2.277 18.55 2.525C19.21 2.779 19.766 3.123 20.322 3.678C20.8305 4.1779 21.224 4.78259 21.475 5.45C21.722 6.087 21.89 6.813 21.94 7.878C21.987 8.944 22 9.283 22 12C22 14.717 21.99 15.056 21.94 16.122C21.89 17.187 21.722 17.912 21.475 18.55C21.2247 19.2178 20.8311 19.8226 20.322 20.322C19.822 20.8303 19.2173 21.2238 18.55 21.475C17.913 21.722 17.187 21.89 16.122 21.94C15.056 21.987 14.717 22 12 22C9.283 22 8.944 21.99 7.878 21.94C6.813 21.89 6.088 21.722 5.45 21.475C4.78233 21.2245 4.17753 20.8309 3.678 20.322C3.16941 19.8222 2.77593 19.2175 2.525 18.55C2.277 17.913 2.11 17.187 2.06 16.122C2.013 15.056 2 14.717 2 12C2 9.283 2.01 8.944 2.06 7.878C2.11 6.812 2.277 6.088 2.525 5.45C2.77524 4.78218 3.1688 4.17732 3.678 3.678C4.17767 3.16923 4.78243 2.77573 5.45 2.525C6.088 2.277 6.812 2.11 7.878 2.06C8.944 2.013 9.283 2 12 2Z" stroke="url(#instagramGradient)" fill="url(#instagramGradient)" />
                                <circle cx="12" cy="12" r="5" stroke="white" fill="none" strokeWidth="2" />
                                <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19.321 5.562C18.7206 4.98345 17.8873 4.73633 16.714 4.73633H7.286C6.11267 4.73633 5.27867 4.98345 4.679 5.562C4.07933 6.14055 3.75 7.00973 3.75 8.14052V15.8587C3.75 16.9895 4.07933 17.859 4.679 18.4375C5.27867 19.0161 6.11267 19.2632 7.286 19.2632H16.714C17.8873 19.2632 18.7213 19.0161 19.321 18.4375C19.9207 17.859 20.25 16.9895 20.25 15.8587V8.14052C20.25 7.00973 19.9207 6.14055 19.321 5.562Z" fill="#FF0050" />
                                <path d="M9.16797 15.8164V8.18262L16.1078 12.8383L9.16797 15.8164Z" fill="white" />
                            </svg>
                        )}
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
            </div>
        </div>
    );
}; 