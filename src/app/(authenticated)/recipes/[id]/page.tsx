import { getRecipes } from '@/lib/api';
import RecipesClient from './recipes-client';

export default async function RecipesPage() {
    try {
        // サーバーサイドでデータを取得
        const recipesData = await getRecipes();

        // クライアントコンポーネントにデータを渡す
        return <RecipesClient initialData={recipesData} />;
    } catch (error) {
        console.error('Failed to fetch recipes:', error);
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6">あなたにおすすめのレシピ</h1>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h2 className="text-lg font-semibold text-red-800">
                        レシピの取得に失敗しました
                    </h2>
                    <p className="text-red-700">
                        しばらく経ってからもう一度お試しください。
                    </p>
                </div>
            </div>
        );
    }
} 