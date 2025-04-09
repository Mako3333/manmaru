import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import RecipesClient from './recipes-client';
import { notFound } from 'next/navigation';

// Props の型定義を追加
type RecipePageProps = {
    params: { id: string };
    searchParams?: { [key: string]: string | string[] | undefined };
};

// 型エイリアスを使用するように変更
export default async function RecipePage({ params }: RecipePageProps) {
    const { id } = params;

    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    }
                }
            }
        );

        // ユーザー情報を取得
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return <div>ログインが必要です</div>;
        }

        // IDに基づいてレシピデータを取得
        const { data: recipe, error } = await supabase
            .from('clipped_recipes')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (error || !recipe) {
            console.error('Failed to fetch recipe:', error);
            notFound();
        }

        // クライアントコンポーネントにデータを渡す
        return <RecipesClient initialData={recipe} />;
    } catch (error) {
        console.error('Failed to fetch recipe:', error);
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6">レシピ詳細</h1>
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