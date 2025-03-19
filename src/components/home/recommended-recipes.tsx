import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookmarkPlus, LoaderCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// レシピデータの型定義
interface Recipe {
    id: string;
    title: string;
    image_url: string;
    is_favorite: boolean;
}

// APIレスポンスの型定義
interface HomeRecipesResponse {
    status: 'no_clips' | 'few_clips' | 'few_more_clips' | 'enough_clips';
    recipes: Recipe[];
    total_clips?: number;
}

export function RecommendedRecipes() {
    const [status, setStatus] = useState<'loading' | 'no_clips' | 'few_clips' | 'few_more_clips' | 'enough_clips'>('loading');
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [totalClips, setTotalClips] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        async function fetchRecipes() {
            try {
                const response = await fetch('/api/recommendations/home-recipes');

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'レシピの取得に失敗しました');
                }

                const data = await response.json() as HomeRecipesResponse;
                setStatus(data.status);
                setRecipes(data.recipes || []);
                setTotalClips(data.total_clips || 0);
            } catch (error) {
                console.error('レシピ取得エラー:', error);
                setError(error instanceof Error ? error.message : '予期せぬエラーが発生しました');
                setStatus('no_clips'); // エラー時はガイダンス表示
            }
        }

        fetchRecipes();
    }, []);

    // ローディング中の表示
    if (status === 'loading') {
        return (
            <div className="space-y-2">
                <h2 className="text-xl font-medium">おすすめレシピ</h2>
                <Card className="bg-gray-50">
                    <CardContent className="flex flex-col items-center justify-center p-8">
                        <LoaderCircle className="animate-spin text-gray-400 mb-2" size={24} />
                        <p className="text-gray-500 text-sm">レシピを読み込み中...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // エラー表示
    if (error) {
        return (
            <div className="space-y-2">
                <h2 className="text-xl font-medium">おすすめレシピ</h2>
                <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-6">
                        <p className="text-red-600 text-sm">{error}</p>
                        <Button
                            variant="outline"
                            className="mt-4 w-full"
                            onClick={() => window.location.reload()}
                        >
                            再読み込み
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // クリップなしの場合のガイダンス表示
    if (status === 'no_clips') {
        return (
            <div className="space-y-2">
                <h2 className="text-xl font-medium">おすすめレシピ</h2>
                <Card className="bg-gray-50 border border-dashed">
                    <CardContent className="pt-6 pb-4 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                            <BookmarkPlus className="text-green-600 w-6 h-6" />
                        </div>
                        <h3 className="font-medium text-lg mb-2">レシピをクリップしてみましょう</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            お気に入りのレシピをクリップすると、ここでおすすめレシピが表示されます
                        </p>
                        <Button
                            variant="outline"
                            className="mt-2 w-full"
                            onClick={() => router.push('/recipes/clip')}
                        >
                            レシピを探す <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // クリップが少ない場合（1件のみ表示 + メッセージ）
    if (status === 'few_clips') {
        const recipe = recipes[0];

        return (
            <div className="space-y-2">
                <h2 className="text-xl font-medium">おすすめレシピ</h2>
                <Card className="overflow-hidden">
                    <div className="relative h-40 w-full">
                        <Image
                            src={recipe.image_url || '/placeholder-recipe.jpg'}
                            alt={recipe.title}
                            className="object-cover"
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                        />
                    </div>
                    <CardContent className="p-4">
                        <h3 className="font-medium mb-2 line-clamp-2">{recipe.title}</h3>
                        <div className="flex justify-between items-center mt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/recipes/${recipe.id}`)}
                            >
                                詳細を見る
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-100 mt-4">
                    <CardContent className="p-4">
                        <p className="text-blue-700 text-sm mb-3">
                            もっと多くのレシピをクリップすると、より多くのおすすめが表示されます
                        </p>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => router.push('/recipes/clip')}
                        >
                            レシピを追加する <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // クリップが5～9件の場合（2件表示 + ポジティブメッセージ）
    if (status === 'few_more_clips') {
        return (
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-medium">おすすめレシピ</h2>
                    <Button
                        variant="link"
                        size="sm"
                        className="text-sm font-normal"
                        onClick={() => router.push('/recipes')}
                    >
                        すべて見る <ArrowRight className="ml-1 w-3 h-3" />
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {recipes.map((recipe) => (
                        <Card key={recipe.id} className="overflow-hidden">
                            <div className="relative aspect-video">
                                <Image
                                    src={recipe.image_url || '/placeholder-recipe.jpg'}
                                    alt={recipe.title}
                                    className="object-cover"
                                    fill
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                />
                            </div>
                            <CardContent className="p-3">
                                <h3 className="font-medium text-sm mb-2 line-clamp-2">{recipe.title}</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-2 text-xs"
                                    onClick={() => router.push(`/recipes/${recipe.id}`)}
                                >
                                    詳細
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="bg-green-50 border-green-100 mt-3">
                    <CardContent className="p-4">
                        <p className="text-green-700 text-sm mb-2">
                            <span className="font-medium">順調にレシピが集まっていますね！</span> 現在{totalClips}件のレシピをクリップ済み。あと数件クリップすると、もっと多彩なおすすめが表示されます。
                        </p>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => router.push('/recipes/clip')}
                        >
                            レシピを追加する <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // クリップが十分ある場合（グリッド表示）
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-medium">おすすめレシピ</h2>
                <Button
                    variant="link"
                    size="sm"
                    className="text-sm font-normal"
                    onClick={() => router.push('/recipes')}
                >
                    すべて見る <ArrowRight className="ml-1 w-3 h-3" />
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {recipes.map((recipe) => (
                    <Card key={recipe.id} className="overflow-hidden">
                        <div className="relative aspect-video">
                            <Image
                                src={recipe.image_url || '/placeholder-recipe.jpg'}
                                alt={recipe.title}
                                className="object-cover"
                                fill
                                sizes="(max-width: 768px) 100vw, 33vw"
                            />
                        </div>
                        <CardContent className="p-3">
                            <h3 className="font-medium text-sm mb-2 line-clamp-2">{recipe.title}</h3>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2 text-xs"
                                onClick={() => router.push(`/recipes/${recipe.id}`)}
                            >
                                詳細
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
} 