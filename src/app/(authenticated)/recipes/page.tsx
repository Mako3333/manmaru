import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import RecipesClient from './recipes-client';

export const metadata = {
    title: 'レシピ - manmaru',
    description: 'あなた向けの妊婦栄養レシピコレクション',
};

export default async function RecipesPage() {
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

    // クリップされたレシピデータを取得
    const { data: recipesData, error } = await supabase
        .from('clipped_recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('clipped_at', { ascending: false });

    if (error) {
        console.error('Failed to fetch clipped recipes:', error);
        return <div>レシピの取得に失敗しました。</div>;
    }

    // カードビュー用に栄養素フォーカスを追加
    const recipesWithFocus = recipesData.map(recipe => {
        const nutrition = recipe.nutrition_per_serving || {};
        const nutritionFocus: string[] = [];

        // 栄養素の基準値
        const thresholds = {
            iron: 5, // 5mg以上が鉄分豊富と判断
            folic_acid: 100, // 100μg以上が葉酸豊富と判断
            calcium: 200, // 200mg以上がカルシウム豊富と判断
        };

        // 基準を超える栄養素をフォーカスとして追加
        if (nutrition.iron && nutrition.iron >= thresholds.iron) {
            nutritionFocus.push('iron');
        }

        if (nutrition.folic_acid && nutrition.folic_acid >= thresholds.folic_acid) {
            nutritionFocus.push('folic_acid');
        }

        if (nutrition.calcium && nutrition.calcium >= thresholds.calcium) {
            nutritionFocus.push('calcium');
        }

        return {
            ...recipe,
            nutrition_focus: nutritionFocus
        };
    });

    return <RecipesClient initialData={recipesWithFocus} />;
} 