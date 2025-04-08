import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        cookieStore.set({ name, value, ...options });
                    },
                    remove(name: string, options: CookieOptions) {
                        cookieStore.delete({ name, ...options });
                    },
                },
            }
        );

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // 1. クリップデータの取得
        const { data: clippedRecipes } = await supabase
            .from('clipped_recipes')
            .select('*')
            .eq('user_id', session.user.id)
            .order('clipped_at', { ascending: false });

        // 2. 最近使用したレシピの取得（除外用）
        const { data: recentlyUsed } = await supabase
            .from('meal_recipe_entries')
            .select('clipped_recipe_id')
            .eq('user_id', session.user.id)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        const recentlyUsedIds = new Set(recentlyUsed?.map(item => item.clipped_recipe_id) || []);

        // 3. レコメンドするレシピの決定
        let recommendedRecipes = [];
        const recipes = clippedRecipes || [];
        const clippedCount = recipes.length;

        if (clippedCount === 0) {
            // クリップなしの場合
            return NextResponse.json({
                status: 'no_clips',
                recipes: []
            });
        } else if (clippedCount < 5) {
            // クリップが少ない場合（1件のみ返す）
            recommendedRecipes = [recipes[0]];
            return NextResponse.json({
                status: 'few_clips',
                recipes: recommendedRecipes
            });
        } else if (clippedCount < 10) {
            // クリップが5～9件の場合（2件返す）
            let availableRecipes = recipes.filter(r => !recentlyUsedIds.has(r.id));

            // 利用可能なレシピがない場合は全クリップから選択
            if (availableRecipes.length === 0) {
                availableRecipes = recipes;
            }

            // お気に入りを優先
            const favoriteRecipes = availableRecipes.filter(r => r.is_favorite);

            if (favoriteRecipes.length >= 2) {
                // お気に入りから2件選択
                recommendedRecipes = shuffleArray(favoriteRecipes).slice(0, 2);
            } else if (favoriteRecipes.length === 1) {
                // お気に入り1件+それ以外から1件
                recommendedRecipes = [...favoriteRecipes];
                const nonFavorites = availableRecipes.filter(r => !r.is_favorite);
                if (nonFavorites.length > 0) {
                    recommendedRecipes.push(nonFavorites[0]);
                } else if (availableRecipes.length > 1) {
                    recommendedRecipes.push(availableRecipes[1]);
                }
            } else {
                // お気に入りがない場合は上位2件
                recommendedRecipes = availableRecipes.slice(0, 2);
            }

            return NextResponse.json({
                status: 'few_more_clips',
                recipes: recommendedRecipes,
                total_clips: clippedCount
            });
        } else {
            // クリップが十分ある場合（10件以上）
            // a. 最近使用したものを除外
            let availableRecipes = recipes.filter(r => !recentlyUsedIds.has(r.id));

            // 利用可能なレシピがない場合は全クリップから選択
            if (availableRecipes.length === 0) {
                availableRecipes = recipes;
            }

            // b. お気に入りを優先
            const favoriteRecipes = availableRecipes.filter(r => r.is_favorite);

            // c. お気に入りが十分あればそこから、なければ全体から選択
            if (favoriteRecipes.length >= 4) {
                // お気に入りからランダムに4件選択
                recommendedRecipes = shuffleArray(favoriteRecipes).slice(0, 4);
            } else {
                // クリップが新しいものから古いものまで均等に選ぶ（バラエティ向上）
                const step = Math.max(1, Math.floor(availableRecipes.length / 4));
                recommendedRecipes = [0, 1, 2, 3].map(i =>
                    availableRecipes[Math.min(i * step, availableRecipes.length - 1)]
                );
            }

            return NextResponse.json({
                status: 'enough_clips',
                recipes: recommendedRecipes,
                total_clips: clippedCount
            });
        }
    } catch (error) {
        console.error('レシピ推奨エラー:', error);
        return NextResponse.json(
            { error: '推奨レシピの取得に失敗しました' },
            { status: 500 }
        );
    }
}

// 配列をランダムにシャッフルする関数
function shuffleArray<T>(array: T[]): T[] {
    if (!array || array.length === 0) return [];

    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i]!, newArray[j]!] = [newArray[j]!, newArray[i]!];
    }
    return newArray;
} 