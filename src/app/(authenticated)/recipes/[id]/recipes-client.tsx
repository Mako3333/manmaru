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
                    ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-400 text-4xl">🍽️</span>
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
                            onClick={() => window.open(recipe.source_url, '_blank')}
                        >
                            <ExternalLink size={16} className="mr-2" />
                            元のレシピを見る
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">クリップを解除しますか？</h2>
                        <p className="text-gray-600 mb-6">
                            このレシピを削除すると、元に戻すことができません。本当にクリップを解除しますか？
                        </p>
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
                                {loading ? '削除中...' : '削除する'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 