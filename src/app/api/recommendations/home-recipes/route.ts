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
    // 他の必要なフィールド
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
            console.error('Error getting session:', sessionError); // セッションエラーログは残す
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
            console.error('Error fetching clipped recipes:', clippedError); // DBエラーログは残す
            return NextResponse.json({ status: 'no_clips', recipes: [], total_clips: 0 });
        }

        // 2. meal_recipe_entries の取得と recentlyUsedIds の作成
        const { data: recentlyUsed, error: recentError } = await supabase
            .from('meal_recipe_entries')
            .select('clipped_recipe_id')
            .eq('user_id', session.user.id)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (recentError) {
            console.error('Error fetching recently used recipes:', recentError); // DBエラーログは残す
            // エラーがあっても処理を続行（最近使用なしとして扱う）
        }

        let recentlyUsedIds = new Set<string>();
        try {
            recentlyUsedIds = new Set(
                (recentlyUsed || [])
                    .filter(item => item && item.clipped_recipe_id)
                    .map(item => item.clipped_recipe_id)
            );
        } catch (error) {
            console.error('Error creating recentlyUsedIds:', error); // ID作成エラーログは残す
            // エラーが発生しても空のSetで続行
        }

        // 3. レコメンドロジック
        let recommendedRecipes: Recipe[] = [];
        const recipes = (clippedRecipes || []) as Recipe[];
        const clippedCount = recipes.length;

        if (clippedCount === 0) {
            return NextResponse.json({ status: 'no_clips', recipes: [] });
        } else if (clippedCount < 5) {
            if (recipes[0]) {
                recommendedRecipes = [recipes[0]];
            }
            return NextResponse.json({ status: 'few_clips', recipes: recommendedRecipes });
        } else if (clippedCount < 10) {
            let availableRecipes = recipes.filter(r => r && !recentlyUsedIds.has(r.id));
            if (availableRecipes.length === 0) availableRecipes = recipes.filter(r => r); // fallback
            const favoriteRecipes = availableRecipes.filter(r => r && r.is_favorite === true);

            if (favoriteRecipes.length >= 2) {
                recommendedRecipes = shuffleArray(favoriteRecipes).slice(0, 2);
            } else if (favoriteRecipes.length === 1) {
                recommendedRecipes = [...favoriteRecipes];
                const nonFavorites = availableRecipes.filter(r => r && !r.is_favorite);
                if (nonFavorites.length > 0) {
                    const recipeToAdd = nonFavorites[0];
                    if (recipeToAdd) {
                        recommendedRecipes.push(recipeToAdd);
                    }
                } else if (availableRecipes.length > 1) { // fallback if only favorite exists
                    const otherAvailable = availableRecipes.filter(r => r.id !== favoriteRecipes[0]?.id);
                    if (otherAvailable.length > 0) {
                        const recipeToAdd = otherAvailable[0];
                        if (recipeToAdd) {
                            recommendedRecipes.push(recipeToAdd);
                        }
                    }
                }
            } else {
                recommendedRecipes = availableRecipes.slice(0, Math.min(2, availableRecipes.length));
            }
            return NextResponse.json({ status: 'few_more_clips', recipes: recommendedRecipes, total_clips: clippedCount });
        } else { // clippedCount >= 10
            let availableRecipes = recipes.filter(r => r && !recentlyUsedIds.has(r.id));
            if (availableRecipes.length === 0) availableRecipes = recipes.filter(r => r); // fallback
            const favoriteRecipes = availableRecipes.filter(r => r && r.is_favorite === true);

            if (favoriteRecipes.length >= 4) {
                recommendedRecipes = shuffleArray(favoriteRecipes).slice(0, 4);
            } else {
                const recipesCount = availableRecipes.length;
                if (recipesCount > 0) {
                    const step = Math.max(1, Math.floor(recipesCount / 4));
                    recommendedRecipes = [0, 1, 2, 3].map(i => availableRecipes[Math.min(i * step, recipesCount - 1)])
                        .filter((r): r is Recipe => !!r); // filter out undefined
                } else {
                    recommendedRecipes = [];
                }
            }
            return NextResponse.json({ status: 'enough_clips', recipes: recommendedRecipes, total_clips: clippedCount });
        }

    } catch (error) {
        console.error('Home recipes API Error:', error); // 一般エラーログは残す
        if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            // console.error('Error stack:', error.stack); // スタックトレースは冗長なのでコメントアウト
        }
        return NextResponse.json(
            { error: '推奨レシピの取得中にエラーが発生しました' }, // ユーザー向けエラーメッセージ
            { status: 500 }
        );
    }
}

// shuffleArray 関数 (修正済み)
function shuffleArray<T>(array: T[]): T[] {
    if (!array || array.length === 0) return [];
    const validItems = array.filter(item => item !== undefined && item !== null);
    if (validItems.length === 0) return [];
    const newArray = [...validItems];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = newArray[i]!;
        newArray[i]! = newArray[j]!;
        newArray[j]! = temp;
    }
    return newArray;
} 