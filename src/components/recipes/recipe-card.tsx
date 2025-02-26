import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

type RecipeCardProps = {
    recipe: {
        id?: string;
        title: string;
        description: string;
        nutrients: string[];
        preparation_time: string;
        difficulty: string;
        imageUrl?: string;
    };
    index?: number;
};

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, index = 0 }) => {
    const router = useRouter();

    // 栄養素から主要なものを抽出
    const mainNutrients = recipe.nutrients.slice(0, 2).map(nutrient => {
        const [name, value] = nutrient.split(':');
        return { name, value: value?.trim() || '' };
    });

    // 栄養素の種類に基づいてハイライトカラーを決定
    const getHighlightColor = (nutrients: string[]) => {
        if (nutrients.some(n => n.includes('鉄分'))) return 'text-red-600';
        if (nutrients.some(n => n.includes('葉酸'))) return 'text-green-600';
        if (nutrients.some(n => n.includes('カルシウム'))) return 'text-blue-600';
        return 'text-purple-600';
    };

    // 栄養素の種類に基づいてハイライトテキストを生成
    const getHighlightText = (nutrients: string[]) => {
        if (nutrients.some(n => n.includes('鉄分'))) return '鉄分たっぷり！';
        if (nutrients.some(n => n.includes('葉酸'))) return '葉酸が豊富！';
        if (nutrients.some(n => n.includes('カルシウム'))) return 'カルシウム補給！';
        return '栄養バランス◎';
    };

    const handleClick = () => {
        // IDがある場合はそのIDを使用、ない場合はインデックスを使用
        const recipeId = recipe.id || index.toString();
        router.push(`/recipes/${recipeId}`);
    };

    return (
        <div
            className="flex rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow mb-4"
            onClick={handleClick}
        >
            <div className="w-1/3 h-32 relative">
                {recipe.imageUrl ? (
                    <Image
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        fill
                        className="object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400">No Image</span>
                    </div>
                )}
            </div>
            <div className="w-2/3 p-4">
                <h3 className={`font-bold ${getHighlightColor(recipe.nutrients)}`}>
                    {getHighlightText(recipe.nutrients)}
                </h3>
                <h2 className="text-lg font-semibold line-clamp-1">{recipe.title}</h2>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {recipe.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                    {mainNutrients.map((nutrient, index) => (
                        <span key={index} className="text-xs bg-gray-100 rounded-full px-2 py-1">
                            {nutrient.name}: {nutrient.value}
                        </span>
                    ))}
                </div>
                <div className="flex items-center mt-2 text-xs text-gray-500">
                    <span className="mr-2">⏱️ {recipe.preparation_time}</span>
                    <span>🔥 {recipe.difficulty}</span>
                </div>
            </div>
        </div>
    );
}; 