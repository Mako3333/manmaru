"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, Clock, Plus, ExternalLink } from 'lucide-react';
import { ClippedRecipe } from '@/types/recipe';
import { AddToMealDialog } from '@/components/recipes/add-to-meal-dialog';
import { toast } from 'sonner';

interface RecipeDetailClientProps {
    initialData: ClippedRecipe;
}

export default function RecipeDetailClient({ initialData }: RecipeDetailClientProps) {
    const [recipe, setRecipe] = useState<ClippedRecipe>(initialData);
    const [isFavorite, setIsFavorite] = useState<boolean>(initialData.is_favorite || false);
    const [loading, setLoading] = useState(false);
    const [showMealDialog, setShowMealDialog] = useState(false);
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

    // 栄養素の表示名を取得
    const getNutrientDisplayName = (key: string): string => {
        const nameMap: Record<string, string> = {
            'calories': 'カロリー',
            'protein': 'タンパク質',
            'iron': '鉄分',
            'folic_acid': '葉酸',
            'calcium': 'カルシウム',
            'vitamin_d': 'ビタミンD'
        };
        return nameMap[key] || key;
    };

    // 栄養素の単位を取得
    const getNutrientUnit = (key: string): string => {
        const unitMap: Record<string, string> = {
            'calories': 'kcal',
            'protein': 'g',
            'iron': 'mg',
            'folic_acid': 'μg',
            'calcium': 'mg',
            'vitamin_d': 'μg'
        };
        return unitMap[key] || '';
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

                    {/* 元サイトへのリンク */}
                    <div className="mt-8">
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => window.open(recipe.source_url, '_blank')}
                        >
                            <ExternalLink size={16} className="mr-2" />
                            元のレシピを見る
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
        </div>
    );
} 