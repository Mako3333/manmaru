'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// レシピデータの型定義
interface Recipe {
    id: string;
    title: string;
    description: string;
    ingredients: string[];
    instructions: string[];
    image_url?: string;
    nutrition_info?: {
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
    };
}

interface RecipesClientProps {
    initialData: Recipe[];
}

export default function RecipesClient({ initialData }: RecipesClientProps) {
    const [recipes, setRecipes] = useState<Recipe[]>(initialData);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClientComponentClient();

    useEffect(() => {
        // 必要に応じて追加のデータ取得やクライアントサイドの処理を行う
    }, []);

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">あなたにおすすめのレシピ</h1>

            {recipes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recipes.map((recipe) => (
                        <div
                            key={recipe.id}
                            className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => router.push(`/recipes/${recipe.id}`)}
                        >
                            {recipe.image_url && (
                                <img
                                    src={recipe.image_url}
                                    alt={recipe.title}
                                    className="w-full h-48 object-cover"
                                />
                            )}
                            <div className="p-4">
                                <h2 className="text-lg font-semibold mb-2">{recipe.title}</h2>
                                <p className="text-gray-600 text-sm line-clamp-2">{recipe.description}</p>

                                {recipe.nutrition_info && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                            {recipe.nutrition_info.calories}kcal
                                        </span>
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                            タンパク質 {recipe.nutrition_info.protein}g
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h2 className="text-lg font-semibold text-yellow-800">
                        レシピが見つかりません
                    </h2>
                    <p className="text-yellow-700">
                        現在おすすめのレシピはありません。後でもう一度確認してください。
                    </p>
                </div>
            )}
        </div>
    );
} 