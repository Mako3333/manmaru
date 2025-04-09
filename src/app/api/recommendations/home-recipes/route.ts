import { NextRequest, NextResponse } from 'next/server';
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

// 型を削除する代わりに、実際に使用する
// データベースからの生レコードの型
type RecipeRecord = {
    id: string;
    title?: string;
    image_url?: string;
    is_favorite?: boolean;
    source_platform?: string;
    content_id?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    clipped_at?: string;
    recipe_type?: string;
    source_url?: string;
};

export async function GET(req: NextRequest) {
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
            // filter(Boolean) を使って null/undefined を除去し、型ガードを行う
            const validRecords = clippedRecipes.filter(Boolean);

            for (const record of validRecords) { // RecipeRecord 型として扱われることを期待
                // if (!record) continue; // filter で除去済みのため不要

                // 必須フィールドを保証して変換
                recipes.push({
                    id: record.id, // record.id は string であると仮定
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
        // let recommendedRecipes: Recipe[] = []; // const に変更

        // 4. レコメンデーションロジック
        const recommendedRecipes: Recipe[] = (() => {
            // 4.1 クリップされたレシピがない場合
            if (clippedCount === 0) {
                // status はレスポンスで設定するためここではレシピ配列のみ返す
                return [];
            } else if (clippedCount < 5) {
                // recipes[0] は undefined の可能性があるが、空配列許容のためチェック不要
                return recipes.slice(0, 1);
            } else if (clippedCount < 10) {
                const availableRecipes = recipes.filter(r => !recentlyUsedIds.has(r.id));
                const recipesToUse = availableRecipes.length > 0 ? availableRecipes : recipes;
                const favoriteRecipes = recipesToUse.filter(r => r.is_favorite);

                if (favoriteRecipes.length >= 2) {
                    return shuffleArray(favoriteRecipes).slice(0, 2);
                } else if (favoriteRecipes.length === 1) {
                    const firstFavorite = favoriteRecipes[0]; // undefined の可能性あり
                    const nonFavorites = recipesToUse.filter(r => !r.is_favorite);
                    const firstNonFavorite = nonFavorites[0]; // undefined の可能性あり
                    const otherAvailable = recipesToUse.filter(r => r.id !== firstFavorite?.id); // Optional chaining
                    const firstOther = otherAvailable[0]; // undefined の可能性あり

                    const recs: Recipe[] = [];
                    if (firstFavorite) recs.push(firstFavorite);
                    if (firstNonFavorite) recs.push(firstNonFavorite);
                    else if (firstOther) recs.push(firstOther);

                    return recs.slice(0, 2); // 最大2件まで
                } else {
                    return recipesToUse.slice(0, Math.min(2, recipesToUse.length));
                }
            }

            // 4.2 十分なクリップ数がある場合
            const availableRecipesFull = recipes.filter(r => !recentlyUsedIds.has(r.id));
            const recipesToUseFull = availableRecipesFull.length < 3 ? recipes : availableRecipesFull;

            const favoriteRecipesFull = recipesToUseFull.filter(r => r.is_favorite);
            if (favoriteRecipesFull.length >= 3) {
                return shuffleArray(favoriteRecipesFull).slice(0, 3);
            } else {
                let combinedRecs = [...favoriteRecipesFull];
                const nonFavoritesFull = recipesToUseFull.filter(r => !r.is_favorite);
                if (nonFavoritesFull.length > 0) {
                    const remainingCount = 3 - combinedRecs.length;
                    const additionalRecipes = shuffleArray(nonFavoritesFull).slice(0, remainingCount);
                    combinedRecs = [...combinedRecs, ...additionalRecipes];
                }
                return combinedRecs;
            }
        })();

        // ステータスを決定
        const status = (() => {
            if (clippedCount === 0) return 'no_clips';
            if (clippedCount < 5) return 'few_clips';
            if (clippedCount < 10) return 'few_more_clips';
            return 'success';
        })();

        return NextResponse.json({
            status: status,
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
    // 空の配列の場合は空の配列を返す
    if (array.length === 0) {
        return [];
    }

    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        // i と j はどちらも配列の有効な範囲内であることが保証されているため、
        // 非 undefined アサーション (!) を使用して型システムに伝える
        const temp = shuffled[i]!;
        shuffled[i] = shuffled[j]!;
        shuffled[j] = temp;
    }
    return shuffled;
} 