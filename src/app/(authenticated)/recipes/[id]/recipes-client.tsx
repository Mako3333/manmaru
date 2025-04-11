"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, Clock, Plus, ExternalLink, Trash, AlertCircle, Users } from 'lucide-react';
import { ClippedRecipe, RecipeIngredient } from '@/types/recipe';
import { AddToMealDialog } from '@/components/recipes/add-to-meal-dialog';
import { toast } from 'sonner';
import { StandardizedMealNutrition, Nutrient } from '@/types/nutrition';
import { openOriginalSocialMedia } from '@/lib/utils/deep-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { getNutrientDisplayName, getNutrientUnit } from '@/lib/nutrition-utils';

interface RecipeDetailClientProps {
    initialData: ClippedRecipe;
}

// 1人前の栄養価を計算するヘルパー関数
const calculatePerServingNutrition = (
    totalNutrition: StandardizedMealNutrition | null | undefined,
    servings: number
): StandardizedMealNutrition | null => {
    if (!totalNutrition || servings <= 0) {
        return null;
    }

    const safeServings = Math.max(1, servings);

    const perServingNutrients = totalNutrition.totalNutrients?.map(nutrient => ({
        ...nutrient,
        value: nutrient.value / safeServings,
    })) || [];

    const perServingCalories = totalNutrition.totalCalories / safeServings;

    // 元の構造を維持しつつ、計算後の値で上書きする
    return {
        ...totalNutrition,
        totalCalories: perServingCalories,
        totalNutrients: perServingNutrients,
        // foodItems など他のプロパティはそのまま保持（ここでは表示しないが）
    };
};

export default function RecipeDetailClient({ initialData }: RecipeDetailClientProps) {
    const [recipe, setRecipe] = useState<ClippedRecipe>(initialData);
    const [isFavorite, setIsFavorite] = useState<boolean>(recipe?.is_favorite || false);
    const [loading, setLoading] = useState<boolean>(false);
    const [showMealDialog, setShowMealDialog] = useState<boolean>(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
    const router = useRouter();

    // 人数情報を取得 (デフォルトは1人前とする)
    const numberOfServings = useMemo(() => {
        // recipe.servings が number 型であり、0より大きいことを確認
        return (recipe.servings && recipe.servings > 0) ? recipe.servings : 1;
    }, [recipe.servings]);

    // 1人前の栄養価を計算
    const perServingNutrition = useMemo(() => {
        return calculatePerServingNutrition(recipe.nutrition_per_serving, numberOfServings);
    }, [recipe.nutrition_per_serving, numberOfServings]);

    // 人数表示用の文字列 (例: "4人前")
    const servingsDisplayText = useMemo(() => {
        return `${numberOfServings}人前`;
    }, [numberOfServings]);

    // ソーシャルメディアかどうかを判定
    const isSocialMedia = recipe.source_platform === 'Instagram' || recipe.source_platform === 'TikTok';

    // お気に入りトグル処理
    const handleFavoriteToggle = async () => {
        try {
            setLoading(true);
            const newFavoriteState = !isFavorite;

            // 楽観的UI更新（即時に状態を更新）
            setIsFavorite(newFavoriteState);
            setRecipe(prev => ({ ...prev, is_favorite: newFavoriteState }));

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
                setRecipe(prev => ({ ...prev, is_favorite: !newFavoriteState }));
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
        } else if (recipe.source_url) {
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
    const getCautionStyleClass = (type: 'alert' | 'title' | 'list') => {
        const level = recipe.caution_level;
        if (!level) return '';

        if (level === 'high') {
            switch (type) {
                case 'alert': return 'bg-red-50 border-red-200 text-red-700';
                case 'title': return 'text-red-800';
                case 'list': return 'text-red-700';
                default: return '';
            }
        }
        if (level === 'medium') {
            switch (type) {
                case 'alert': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
                case 'title': return 'text-yellow-800';
                case 'list': return 'text-yellow-700';
                default: return '';
            }
        }
        // 'low' or other cases
        switch (type) {
            case 'alert': return 'bg-blue-50 border-blue-200 text-blue-700';
            case 'title': return 'text-blue-800';
            case 'list': return 'text-blue-700';
            default: return '';
        }
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

            toast.success('レシピを削除しました');
            // 削除成功後、レシピ一覧ページに戻る
            router.push('/recipes');
            router.refresh();
        } catch (error) {
            console.error('削除エラー:', error);
            toast.error(`レシピの削除に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
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

    // 栄養成分表示用データ
    const displayNutrients = useMemo(() => {
        if (!perServingNutrition) return [];

        // カロリーをリストの先頭に追加
        const nutrientsToShow: { name: string, value: number, unit: string }[] = [
            { name: 'カロリー', value: perServingNutrition.totalCalories, unit: 'kcal' },
        ];

        // totalNutrients から主要なものを抽出・整形 (例)
        // 必要に応じて表示する栄養素を調整してください
        const mainNutrients = ['タンパク質', '脂質', '炭水化物', '食物繊維', '食塩相当量', 'カルシウム', '鉄', '亜鉛', 'ビタミンA', 'ビタミンB1', 'ビタミンB2', 'ビタミンC', '葉酸'];
        perServingNutrition.totalNutrients?.forEach(n => {
            if (mainNutrients.includes(n.name)) {
                nutrientsToShow.push({ name: n.name, value: n.value, unit: n.unit });
            }
        });

        return nutrientsToShow;

    }, [perServingNutrition]);

    return (
        <div className="container max-w-4xl mx-auto px-4 py-6">
            {/* 戻るボタンとアクションボタン */}
            <div className="flex justify-between items-center mb-6">
                <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-1 text-gray-600 hover:text-gray-800">
                    <ArrowLeft size={16} />
                    戻る
                </Button>

                <div className="flex gap-2">
                    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700">
                                <Trash size={16} className="mr-1" />
                                削除
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>レシピの削除</AlertDialogTitle>
                                <AlertDialogDescription>
                                    「{recipe.title}」を削除しますか？この操作は元に戻せません。
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={closeDeleteDialog}>キャンセル</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteRecipe}
                                    disabled={loading}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    {loading ? '削除中...' : '削除する'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Button
                        variant={isFavorite ? "default" : "outline"}
                        onClick={handleFavoriteToggle}
                        disabled={loading}
                        className={`${isFavorite ? "bg-pink-500 hover:bg-pink-600 text-white" : "text-pink-600 border-pink-600 hover:bg-pink-50 hover:text-pink-700"} flex items-center gap-1`}
                    >
                        <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
                        {isFavorite ? "お気に入り" : "お気に入り"}
                    </Button>

                    <Button
                        variant="default"
                        onClick={handleOpenMealDialog}
                        className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
                    >
                        <Plus size={16} />
                        食事記録に追加
                    </Button>
                </div>
            </div>

            {/* レシピ情報 */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* レシピ画像 */}
                <div className="relative h-64 w-full bg-gray-100">
                    {recipe.image_url && !recipe.use_placeholder ? (
                        <Image
                            src={recipe.image_url}
                            alt={recipe.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover"
                            priority
                        />
                    ) : isSocialMedia ? (
                        // ソーシャルメディアのプレースホルダー
                        <div className={`w-full h-full ${getPlaceholderBgColor()} flex items-center justify-center`}>
                            <div className="flex flex-col items-center p-4 text-white text-center">
                                <div className="relative w-16 h-16 mb-3">
                                    <Image
                                        src={`/icons/${recipe.source_platform?.toLowerCase() || 'other'}.svg`}
                                        alt={recipe.source_platform || 'Social Media'}
                                        width={64}
                                        height={64}
                                        className="object-contain filter drop-shadow-lg"
                                    />
                                </div>
                                <h3 className="text-xl font-semibold">{recipe.title}</h3>
                                <p className="text-sm opacity-80 mt-1">{recipe.source_platform}のレシピ</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                            <span className="text-gray-400 text-5xl">🍽️</span>
                        </div>
                    )}

                    {recipe.source_platform && (
                        <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-md cursor-pointer" onClick={handleOpenOriginalRecipe} title="元のレシピを開く">
                            <Image
                                src={`/icons/${recipe.source_platform.toLowerCase()}.svg`}
                                alt={`${recipe.source_platform} icon`}
                                width={24}
                                height={24}
                            />
                        </div>
                    )}
                    {!isSocialMedia && recipe.source_url && (
                        <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-md cursor-pointer" onClick={handleOpenOriginalRecipe} title="元のレシピサイトを開く">
                            <ExternalLink size={20} className="text-gray-600" />
                        </div>
                    )}
                </div>

                {/* レシピ詳細 */}
                <div className="p-6 md:p-8">
                    <h1 className="text-3xl font-bold mb-3 leading-tight">{recipe.title}</h1>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                            <span className={`inline-block w-3 h-3 rounded-full mr-1 ${recipe.recipe_type === 'main_dish' ? 'bg-green-500' :
                                recipe.recipe_type === 'side_dish' ? 'bg-yellow-500' :
                                    recipe.recipe_type === 'soup' ? 'bg-blue-500' :
                                        recipe.recipe_type === 'staple_food' ? 'bg-orange-500' :
                                            recipe.recipe_type === 'dessert' ? 'bg-pink-500' : 'bg-gray-400'
                                }`}></span>
                            {recipe.recipe_type === 'main_dish' ? '主菜' :
                                recipe.recipe_type === 'side_dish' ? '副菜' :
                                    recipe.recipe_type === 'soup' ? '汁物' :
                                        recipe.recipe_type === 'staple_food' ? '主食' :
                                            recipe.recipe_type === 'dessert' ? 'デザート' : 'その他'}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {recipe.source_platform || (recipe.source_url ? new URL(recipe.source_url).hostname : 'レシピサイト')}
                        </span>
                        {numberOfServings > 0 && (
                            <span className="flex items-center gap-1 font-medium text-gray-700">
                                <Users size={14} />
                                {servingsDisplayText}
                            </span>
                        )}
                    </div>

                    {recipe.caution_foods && recipe.caution_foods.length > 0 && (
                        <Alert className={`mb-6 ${getCautionStyleClass('alert')}`}>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle className={`${getCautionStyleClass('title')} font-semibold`}>
                                {recipe.caution_level === 'high' ? '注意が必要な食材が含まれています' :
                                    recipe.caution_level === 'medium' ? '注意した方が良い食材が含まれています' :
                                        '含まれる食材に関する情報'}
                            </AlertTitle>
                            <AlertDescription className={`${getCautionStyleClass('list')}`}>
                                {recipe.caution_foods.join('、')}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                材料
                                {numberOfServings > 0 && <span className="text-sm font-normal text-gray-500">({servingsDisplayText})</span>}
                            </h2>
                            {recipe.ingredients && recipe.ingredients.length > 0 ? (
                                <ul className="space-y-2 list-disc list-inside text-gray-700">
                                    {recipe.ingredients.map((ingredient: RecipeIngredient, index: number) => (
                                        <li key={index}>
                                            <span className="font-medium">{ingredient.name}</span>
                                            {ingredient.quantity && <span className="ml-2 text-gray-600">{ingredient.quantity}</span>}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500">材料情報がありません。</p>
                            )}
                        </div>

                        <div>
                            <h2 className="text-xl font-semibold mb-4">栄養成分 (1人前あたり)</h2>
                            {displayNutrients.length > 0 ? (
                                <div className="space-y-2">
                                    {displayNutrients.map((nutrient) => (
                                        <div key={nutrient.name} className="flex justify-between items-center border-b pb-1">
                                            <span className="text-sm text-gray-600">{nutrient.name}:</span>
                                            <span className="font-medium text-gray-800">
                                                {nutrient.value !== undefined ? Math.round(nutrient.value * 10) / 10 : '-'} {nutrient.unit}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500">栄養情報がありません。</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showMealDialog && (
                <AddToMealDialog
                    isOpen={showMealDialog}
                    onClose={handleCloseMealDialog}
                    recipe={recipe}
                />
            )}
        </div>
    );
} 