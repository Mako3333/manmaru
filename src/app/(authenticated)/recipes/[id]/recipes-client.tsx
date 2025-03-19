"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, Clock, Plus, ExternalLink, Trash } from 'lucide-react';
import { ClippedRecipe } from '@/types/recipe';
import { AddToMealDialog } from '@/components/recipes/add-to-meal-dialog';
import { toast } from 'sonner';
import { getNutrientDisplayName, getNutrientUnit } from '@/lib/nutrition-utils';
import { openOriginalSocialMedia } from '@/lib/utils/deep-link';

interface RecipeDetailClientProps {
    initialData: ClippedRecipe;
}

export default function RecipeDetailClient({ initialData }: RecipeDetailClientProps) {
    const [recipe, setRecipe] = useState<ClippedRecipe>(initialData);
    const [isFavorite, setIsFavorite] = useState<boolean>(recipe?.is_favorite || false);
    const [loading, setLoading] = useState<boolean>(false);
    const [showMealDialog, setShowMealDialog] = useState<boolean>(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
    const router = useRouter();
    const supabase = createClientComponentClient();

    // ソーシャルメディアかどうかを判定
    const isSocialMedia = recipe.source_platform === 'Instagram' || recipe.source_platform === 'TikTok';

    // お気に入りトグル処理
    const handleFavoriteToggle = async () => {
        try {
            setLoading(true);
            const newFavoriteState = !isFavorite;

            // 楽観的UI更新（即時に状態を更新）
            setIsFavorite(newFavoriteState);
            setRecipe({ ...recipe, is_favorite: newFavoriteState });

            // APIリクエスト
            const response = await fetch(`/api/recipes/${recipe.id}/favorite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_favorite: newFavoriteState }),
            });

            if (!response.ok) {
                // APIリクエストが失敗した場合は元の状態に戻す
                setIsFavorite(!newFavoriteState);
                setRecipe({ ...recipe, is_favorite: !newFavoriteState });
                throw new Error('お気に入り設定の更新に失敗しました');
            }
        } catch (error) {
            console.error('Failed to update favorite status:', error);
            toast?.error('お気に入り設定の更新に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    // 食事記録ダイアログを開く
    const handleOpenMealDialog = () => {
        setShowMealDialog(true);
    };

    // 食事記録ダイアログを閉じる
    const handleCloseMealDialog = () => {
        setShowMealDialog(false);
    };

    // 元のレシピを開く
    const handleOpenOriginalRecipe = () => {
        if (isSocialMedia && recipe.content_id) {
            // ソーシャルメディアの場合はディープリンクを使用
            openOriginalSocialMedia(
                recipe.source_url,
                recipe.source_platform,
                recipe.content_id
            );
        } else {
            // 通常のレシピサイトの場合は新しいタブで開く
            window.open(recipe.source_url, '_blank');
        }
    };

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

    // 注意レベルに基づくスタイルクラスを取得
    const getCautionStyleClass = () => {
        if (!recipe.caution_level) return '';
        if (recipe.caution_level === 'high') return 'bg-red-50 border-red-200 text-red-700';
        if (recipe.caution_level === 'medium') return 'bg-yellow-50 border-yellow-200 text-yellow-700';
        return '';
    };

    const handleDeleteRecipe = async () => {
        if (!recipe.id) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/recipes/${recipe.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'レシピの削除に失敗しました');
            }

            // 削除成功後、レシピ一覧ページに戻る
            router.push('/recipes');
            router.refresh();
        } catch (error) {
            console.error('削除エラー:', error);
            alert('レシピの削除に失敗しました。もう一度お試しください。');
        } finally {
            setLoading(false);
            setShowDeleteDialog(false);
        }
    };

    const openDeleteDialog = () => {
        setShowDeleteDialog(true);
    };

    const closeDeleteDialog = () => {
        setShowDeleteDialog(false);
    };

    return (
        <div className="container max-w-4xl mx-auto px-4 py-6">
            {/* 戻るボタンとアクションボタン */}
            <div className="flex justify-between items-center mb-6">
                <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-1">
                    <ArrowLeft size={16} />
                    戻る
                </Button>

                <div className="flex gap-2">
                    <Button
                        variant={isFavorite ? "default" : "outline"}
                        onClick={handleFavoriteToggle}
                        disabled={loading}
                        className={isFavorite ? "bg-red-500 hover:bg-red-600" : ""}
                    >
                        <Heart size={16} className="mr-1" fill={isFavorite ? "white" : "none"} />
                        {isFavorite ? "お気に入り済み" : "お気に入り"}
                    </Button>

                    <Button variant="default" onClick={handleOpenMealDialog}>
                        <Plus size={16} className="mr-1" />
                        食事記録に追加
                    </Button>
                </div>
            </div>

            {/* レシピ情報 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* レシピ画像 */}
                <div className="relative h-64 w-full">
                    {recipe.image_url ? (
                        <Image
                            src={recipe.image_url}
                            alt={recipe.title}
                            fill
                            className="object-cover"
                        />
                    ) : isSocialMedia ? (
                        // ソーシャルメディアのプレースホルダー
                        <div className={`w-full h-full ${getPlaceholderBgColor()} flex items-center justify-center`}>
                            <div className="flex flex-col items-center p-4 text-white">
                                <div className="relative w-16 h-16 mb-3">
                                    <Image
                                        src={`/icons/${recipe.source_platform?.toLowerCase()}.svg`}
                                        alt={recipe.source_platform || ''}
                                        width={64}
                                        height={64}
                                        className="object-contain"
                                    />
                                </div>
                                <h3 className="text-xl font-semibold text-center">{recipe.title}</h3>
                                <p className="text-sm opacity-80 mt-1">{recipe.source_platform}のレシピ</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-400 text-4xl">🍽️</span>
                        </div>
                    )}

                    {/* ソーシャルメディアアイコン */}
                    {isSocialMedia && (
                        <div className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-md">
                            {recipe.source_platform === 'Instagram' ? (
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19.321 5.562C18.7206 4.98345 17.8873 4.73633 16.714 4.73633H7.286C6.11267 4.73633 5.27867 4.98345 4.679 5.562C4.07933 6.14055 3.75 7.00973 3.75 8.14052V15.8587C3.75 16.9895 4.07933 17.859 4.679 18.4375C5.27867 19.0161 6.11267 19.2632 7.286 19.2632H16.714C17.8873 19.2632 18.7213 19.0161 19.321 18.4375C19.9207 17.859 20.25 16.9895 20.25 15.8587V8.14052C20.25 7.00973 19.9207 6.14055 19.321 5.562Z" fill="#FF0050" />
                                    <path d="M9.16797 15.8164V8.18262L16.1078 12.8383L9.16797 15.8164Z" fill="white" />
                                </svg>
                            )}
                        </div>
                    )}
                </div>

                {/* レシピ詳細 */}
                <div className="p-6">
                    <h1 className="text-2xl font-bold mb-2">{recipe.title}</h1>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                            {recipe.recipe_type === 'main_dish' ? '主菜' :
                                recipe.recipe_type === 'side_dish' ? '副菜' :
                                    recipe.recipe_type === 'soup' ? '汁物' : 'その他'}
                        </span>
                        <span className="text-sm bg-gray-50 text-gray-700 px-2 py-1 rounded-full flex items-center">
                            <Clock size={14} className="mr-1" />
                            {recipe.source_platform || 'レシピサイト'}
                        </span>
                    </div>

                    {/* 注意事項表示 */}
                    {recipe.caution_foods && recipe.caution_foods.length > 0 && (
                        <div className={`mb-6 p-4 rounded-lg border ${getCautionStyleClass()}`}>
                            <h3 className="font-semibold mb-2">
                                {recipe.caution_level === 'high' ? '⚠️ 注意が必要な食材' :
                                    recipe.caution_level === 'medium' ? '⚠️ 注意した方が良い食材' :
                                        '参考情報'}
                            </h3>
                            <ul className="list-disc list-inside">
                                {recipe.caution_foods.map((food, index) => (
                                    <li key={index}>{food}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* 栄養素情報 */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-3">栄養成分</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {recipe.nutrition_per_serving && Object.entries(recipe.nutrition_per_serving)
                                .filter(([key]) => ['calories', 'protein', 'iron', 'folic_acid', 'calcium', 'vitamin_d'].includes(key))
                                .map(([key, value]) => (
                                    <div key={key} className="bg-gray-50 p-3 rounded-lg">
                                        <h3 className="text-sm text-gray-500">{getNutrientDisplayName(key)}</h3>
                                        <p className="text-lg font-semibold">
                                            {typeof value === 'number' ? value.toFixed(1) : value} {getNutrientUnit(key)}
                                        </p>
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    {/* 材料リスト */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-3">材料</h2>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            {recipe.ingredients && recipe.ingredients.length > 0 ? (
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {recipe.ingredients.map((ingredient, index) => (
                                        <li key={index} className="flex justify-between">
                                            <span>{ingredient.name}</span>
                                            <span className="text-gray-500">{ingredient.quantity || ''}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500">材料情報がありません</p>
                            )}
                        </div>
                    </div>

                    {/* 元サイトへのリンクとクリップ解除ボタン */}
                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={handleOpenOriginalRecipe}
                        >
                            <ExternalLink size={16} className="mr-2" />
                            {isSocialMedia ? `元の${recipe.source_platform}を開く` : '元のレシピを見る'}
                        </Button>

                        <Button
                            variant="outline"
                            className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={openDeleteDialog}
                        >
                            <Trash size={16} className="mr-2" />
                            クリップの解除
                        </Button>
                    </div>
                </div>
            </div>

            {/* 食事記録追加ダイアログ */}
            <AddToMealDialog
                isOpen={showMealDialog}
                onClose={handleCloseMealDialog}
                recipe={recipe}
            />

            {/* 削除確認ダイアログ */}
            {showDeleteDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-xl font-semibold mb-4">レシピのクリップを解除</h3>
                        <p className="mb-6">「{recipe.title}」のクリップを解除しますか？一度削除すると元に戻せません。</p>
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={closeDeleteDialog}
                                disabled={loading}
                            >
                                キャンセル
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDeleteRecipe}
                                disabled={loading}
                            >
                                {loading ? '処理中...' : '削除する'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 