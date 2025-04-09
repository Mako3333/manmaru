import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// レシピプレビューで表示するために必要な最低限の型を定義
interface PreviewRecipe {
    id: string; // Linkで使用するためIDが必要と仮定
    title: string;
    imageUrl?: string;
    description?: string;
    nutrients: string[]; // mapで使用されているためstringの配列と仮定
}

export const RecipePreview: React.FC = () => {
    const [recipes, setRecipes] = useState<PreviewRecipe[]>([]); // any[] から PreviewRecipe[] に変更
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                // TODO: userId を認証情報から取得するように修正
                const response = await fetch('/api/recommend-recipes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: 'temp-user-id', limit: 1 }) // 仮のuserId
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status}`);
                }

                const data = await response.json();
                // APIレスポンスの構造に合わせて調整が必要
                // ここでは data.recipes が PreviewRecipe の配列であることを期待
                if (Array.isArray(data.recipes)) {
                    setRecipes(data.recipes.slice(0, 1));
                } else {
                    // recommended_recipes キーも試す (recommend-recipes APIのレスポンスに合わせて調整)
                    if (Array.isArray(data.recommended_recipes)) {
                        setRecipes(data.recommended_recipes.slice(0, 1));
                    } else {
                        console.warn('API response does not contain a recipes array:', data);
                        setRecipes([]);
                    }
                }

            } catch (error) {
                console.error('Failed to fetch recipe preview:', error);
                setRecipes([]); // エラー時も空配列をセット
            } finally {
                setLoading(false);
            }
        };

        fetchRecipes();
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-green-100 h-32 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (recipes.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-green-100">
                <p className="text-gray-500 text-center py-4">おすすめレシピはありません</p>
            </div>
        );
    }

    // recipes 配列が空でないことを保証した上でアクセス
    const recipe = recipes[0];

    // レシピIDが取得できない場合や不正な場合のフォールバック
    const recipeLink = recipe.id ? `/recipes/${recipe.id}` : '#';

    return (
        // Link hrefを安全に設定
        <Link href={recipeLink} className="block">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-green-100">
                <div className="relative h-40 w-full">
                    {recipe.imageUrl ? (
                        <Image
                            src={recipe.imageUrl}
                            alt={recipe.title || 'レシピ画像'} // titleがundefinedの場合のフォールバック
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // レスポンシブイメージのためのsizes属性を追加 (調整が必要)
                            priority // LCP要素の可能性があるためpriorityを追加
                        />
                    ) : (
                        <div className="w-full h-full bg-green-100 flex items-center justify-center">
                            <span className="text-green-500 text-4xl">🍽️</span>
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <h3 className="text-white font-semibold">{recipe.title || 'タイトル未設定'}</h3>
                    </div>
                </div>

                <div className="p-3">
                    <p className="text-sm text-gray-600 line-clamp-2">
                        {recipe.description || '説明がありません'}
                    </p>
                    {/* nutrients が配列であることを確認 */}
                    {Array.isArray(recipe.nutrients) && recipe.nutrients.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {recipe.nutrients.slice(0, 3).map((nutrient: string, index: number) => {
                                // nutrientが文字列でない場合のフォールバック
                                const name = typeof nutrient === 'string' ? nutrient.split(':')[0] : '不明';
                                return (
                                    <span key={index} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                        {name}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}; 