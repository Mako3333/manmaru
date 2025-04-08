import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// レシピの型を定義
interface Recipe {
    id: string;
    title: string;
    image_url: string;
    is_favorite: boolean;
    source_platform?: string;
    content_id?: string;
    use_placeholder?: boolean;
}

// レシピレコード型（データベースから取得される生データ）
interface RecipeRecord {
    id: string;
    title?: string;
    image_url?: string;
    is_favorite?: boolean;
    source_platform?: string;
    content_id?: string;
    [key: string]: any; // その他のフィールド
}

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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error('Error getting session:', sessionError);
        }

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. clipped_recipes のデータ取得
        const { data: clippedRecipes, error: clippedError } = await supabase
            .from('clipped_recipes')
            .select('*')
            .eq('user_id', session.user.id)
            .order('clipped_at', { ascending: false });

        if (clippedError) {
            console.error('Error fetching clipped recipes:', clippedError);
            return NextResponse.json({ status: 'no_clips', recipes: [], total_clips: 0 });
        }

        // 2. 最近使用したレシピIDの取得 - meal_recipe_entriesとmealsを結合して取得
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentlyUsed, error: recentError } = await supabase
            .from('meal_recipe_entries')
            .select(`
                clipped_recipe_id,
                meals!inner (user_id)
            `)
            .eq('meals.user_id', session.user.id)
            .gte('created_at', sevenDaysAgo);

        if (recentError) {
            console.error('Error fetching recently used recipes:', recentError);
        }

        // 最近使用したレシピIDのセットを作成
        const recentlyUsedIds = new Set(recentlyUsed?.map(item => item.clipped_recipe_id) || []);

        // 3. レシピデータの加工 - nullを除外しRecipe型に変換
        const recipes: Recipe[] = [];

        if (clippedRecipes) {
            for (const record of clippedRecipes) {
                if (!record) continue;

                // 必須フィールドを保証して変換
                recipes.push({
                    id: record.id,
                    title: record.title || '無題のレシピ',
                    image_url: record.image_url || '/images/placeholder-recipe.jpg',
                    is_favorite: !!record.is_favorite,
                    source_platform: record.source_platform,
                    content_id: record.content_id,
                    use_placeholder: !record.image_url
                });
            }
        }

        const clippedCount = recipes.length;
        let recommendedRecipes: Recipe[] = [];

        // 4. レコメンデーションロジック
        // 4.1 クリップされたレシピがない場合
        if (clippedCount === 0) {
            return NextResponse.json({ status: 'no_clips', recipes: [] });
        } else if (clippedCount < 5) {
            if (recipes.length > 0) {
                recommendedRecipes = [recipes[0]];
            }
            return NextResponse.json({ status: 'few_clips', recipes: recommendedRecipes });
        } else if (clippedCount < 10) {
            let availableRecipes = recipes.filter(r => !recentlyUsedIds.has(r.id));
            if (availableRecipes.length === 0) availableRecipes = recipes;
            const favoriteRecipes = availableRecipes.filter(r => r.is_favorite);

            if (favoriteRecipes.length >= 2) {
                recommendedRecipes = shuffleArray(favoriteRecipes).slice(0, 2);
            } else if (favoriteRecipes.length === 1) {
                recommendedRecipes = [...favoriteRecipes];
                const nonFavorites = availableRecipes.filter(r => !r.is_favorite);
                if (nonFavorites.length > 0) {
                    recommendedRecipes.push(nonFavorites[0]);
                } else if (availableRecipes.length > 1) {
                    const otherAvailable = availableRecipes.filter(r => {
                        // favoriteRecipes[0]が存在することを確認
                        const firstFavorite = favoriteRecipes[0];
                        if (!firstFavorite) return true;
                        return r.id !== firstFavorite.id;
                    });
                    if (otherAvailable.length > 0) {
                        recommendedRecipes.push(otherAvailable[0]);
                    }
                }
            } else {
                recommendedRecipes = availableRecipes.slice(0, Math.min(2, availableRecipes.length));
            }
            return NextResponse.json({ status: 'few_more_clips', recipes: recommendedRecipes, total_clips: clippedCount });
        }

        // 4.2 十分なクリップ数がある場合
        // 優先度: 1. 最近使用していない 2. お気に入り
        let availableRecipes = recipes.filter(r => !recentlyUsedIds.has(r.id));

        // 直近で使われたレシピを除外した結果、利用可能なレシピが少なすぎる場合はすべて対象に
        if (availableRecipes.length < 3) {
            availableRecipes = recipes;
        }

        // お気に入りレシピを優先
        const favoriteRecipes = availableRecipes.filter(r => r.is_favorite);
        if (favoriteRecipes.length >= 3) {
            recommendedRecipes = shuffleArray(favoriteRecipes).slice(0, 3);
        } else {
            // お気に入りと非お気に入りを組み合わせる
            recommendedRecipes = [...favoriteRecipes];

            // 残りの枠はお気に入りでないレシピから
            const nonFavorites = availableRecipes.filter(r => !r.is_favorite);
            if (nonFavorites.length > 0) {
                const remainingCount = 3 - recommendedRecipes.length;
                const additionalRecipes = shuffleArray(nonFavorites).slice(0, remainingCount);
                recommendedRecipes = [...recommendedRecipes, ...additionalRecipes];
            }
        }

        return NextResponse.json({
            status: 'success',
            recipes: recommendedRecipes,
            total_clips: clippedCount
        });

    } catch (error) {
        console.error('Error in recommend recipes API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// 配列をシャッフルする関数
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        if (shuffled[i] !== undefined && shuffled[j] !== undefined) {
            const temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }
    }
    return shuffled;
} 