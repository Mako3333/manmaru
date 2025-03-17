'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { RecipeCard } from '@/components/recipes/recipe-card';
import { ClippedRecipe } from '@/types/recipe';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search } from 'lucide-react';

interface RecipesClientProps {
    initialData: (ClippedRecipe & { nutrition_focus?: string[] })[];
}

export default function RecipesClient({ initialData }: RecipesClientProps) {
    const [recipes, setRecipes] = useState<(ClippedRecipe & { nutrition_focus?: string[] })[]>(initialData);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();
    const supabase = createClientComponentClient();

    // レシピをフィルタリングする関数
    const filterRecipes = () => {
        // クエリによるフィルター
        let filtered = initialData;

        if (searchQuery) {
            filtered = filtered.filter(recipe =>
                recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // タブによるフィルター
        if (activeTab === 'favorites') {
            filtered = filtered.filter(recipe => recipe.is_favorite);
        } else if (activeTab !== 'all') {
            filtered = filtered.filter(recipe => recipe.recipe_type === activeTab);
        }

        return filtered;
    };

    // タブ変更時のハンドラー
    const handleTabChange = (value: string) => {
        setActiveTab(value);
    };

    // 検索クエリ変更時のハンドラー
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    // レシピカードクリック時のハンドラー
    const handleRecipeClick = (id: string) => {
        router.push(`/recipes/${id}`);
    };

    // お気に入りトグル時のハンドラー
    const handleFavoriteToggle = async (id: string, isFavorite: boolean) => {
        try {
            const response = await fetch(`/api/recipes/${id}/favorite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_favorite: isFavorite }),
            });

            if (!response.ok) {
                throw new Error('お気に入り設定の更新に失敗しました');
            }

            // ローカルステートの更新
            setRecipes(prevRecipes =>
                prevRecipes.map(recipe =>
                    recipe.id === id
                        ? { ...recipe, is_favorite: isFavorite }
                        : recipe
                )
            );
        } catch (error) {
            console.error('Favorite toggle error:', error);
        }
    };

    // クイック記録ハンドラー（実装予定）
    const handleQuickLog = (id: string) => {
        // 食事記録連携機能（後で実装）
        console.log('Quick log recipe:', id);
    };

    // フィルタリングされたレシピの取得
    const filteredRecipes = filterRecipes();

    return (
        <div className="container px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold">マイレシピ</h1>

                <div className="flex space-x-2 w-full md:w-auto">
                    <div className="relative flex-grow">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            type="text"
                            placeholder="レシピを検索"
                            className="pl-8"
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                    </div>

                    <Button onClick={() => router.push('/recipes/clip')}>
                        <Plus className="mr-1 h-4 w-4" /> 追加
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="all" onValueChange={handleTabChange} className="w-full mb-6">
                <TabsList className="w-full max-w-md mx-auto grid grid-cols-5">
                    <TabsTrigger value="all">すべて</TabsTrigger>
                    <TabsTrigger value="favorites">お気に入り</TabsTrigger>
                    <TabsTrigger value="main_dish">主菜</TabsTrigger>
                    <TabsTrigger value="side_dish">副菜</TabsTrigger>
                    <TabsTrigger value="soup">汁物</TabsTrigger>
                </TabsList>
            </Tabs>

            {filteredRecipes.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredRecipes.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={{
                                id: recipe.id,
                                title: recipe.title,
                                image_url: recipe.image_url,
                                recipe_type: recipe.recipe_type,
                                nutrition_focus: recipe.nutrition_focus,
                                is_favorite: recipe.is_favorite,
                                caution_level: recipe.caution_level
                            }}
                            onCardClick={handleRecipeClick}
                            onFavoriteToggle={handleFavoriteToggle}
                            onQuickLog={handleQuickLog}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <h2 className="text-lg font-semibold text-yellow-800 mb-2">
                        レシピが見つかりません
                    </h2>
                    <p className="text-yellow-700 mb-4">
                        {searchQuery ?
                            '検索条件に一致するレシピがありません。' :
                            'まだレシピがクリップされていません。レシピサイトからURLをクリップしてみましょう。'}
                    </p>
                    <Button onClick={() => router.push('/recipes/clip')}>
                        レシピをクリップする
                    </Button>
                </div>
            )}
        </div>
    );
} 