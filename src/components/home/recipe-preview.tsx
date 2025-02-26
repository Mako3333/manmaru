import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export const RecipePreview: React.FC = () => {
    const [recipes, setRecipes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                const response = await fetch('/api/recommend-recipes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: 'current-user-id', limit: 1 })
                });

                const data = await response.json();
                setRecipes(data.recipes?.slice(0, 1) || []);
            } catch (error) {
                console.error('Failed to fetch recipe preview:', error);
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
                <p className="text-gray-500 text-center py-4">レシピがありません</p>
            </div>
        );
    }

    const recipe = recipes[0];

    return (
        <Link href={`/recipes/0`} className="block">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-green-100">
                <div className="relative h-40 w-full">
                    {recipe.imageUrl ? (
                        <Image
                            src={recipe.imageUrl}
                            alt={recipe.title}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-green-100 flex items-center justify-center">
                            <span className="text-green-500 text-4xl">🍽️</span>
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <h3 className="text-white font-semibold">{recipe.title}</h3>
                    </div>
                </div>

                <div className="p-3">
                    <p className="text-sm text-gray-600 line-clamp-2">{recipe.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {recipe.nutrients.slice(0, 3).map((nutrient: string, index: number) => {
                            const [name] = nutrient.split(':');
                            return (
                                <span key={index} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                    {name}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Link>
    );
}; 