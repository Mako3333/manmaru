import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { RecipeCard, ClippedRecipe } from '@/types/recipe';

// レシピの型を定義     
// interface Recipe {
//     id: string;
//     title: string;
//     image_url: string;
//     is_favorite: boolean;
//     source_platform?: string;
//     content_id?: string;
//     use_placeholder?: boolean;
// }

// 配列をシャッフルするヘルパー関数
function shuffleArray<T>(array: T[]): T[] {
    if (array.length === 0) {
        return [];
    }
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = shuffled[i]!;
        shuffled[i] = shuffled[j]!;
        shuffled[j] = temp;
    }
    return shuffled;
}

export async function GET(_req: NextRequest) {
    // Prepare response object upfront -> REMOVED as it's not supported in Route Handlers
    // const response = NextResponse.next();

    try {
        const cookieStore = await cookies(); // Keep this for Next.js 15+

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        // cookieStore.set({ name, value, ...options }); // 変更前: ガイドライン違反
                        // Route Handler 内の cookieStore は読み取り専用のため no-op にする
                    },
                    remove(name: string, options: CookieOptions) {
                        // cookieStore.delete({ name, ...options }); // 変更前: ガイドライン違反
                        // Route Handler 内の cookieStore は読み取り専用のため no-op にする
                    },
                },
            }
        );
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error('Error getting session:', sessionError);
        }

        // If no session, return default empty state
        if (!session) {
            // Return JSON without merging headers from the removed 'response' object
            return NextResponse.json({ status: 'no_clips', recipes: [], total_clips: 0 });
        }
        const userId = session.user.id; // userId is guaranteed here

        // 1. Fetch clipped recipes
        const { data: clippedRecipesData, error: clippedError } = await supabase
            .from('clipped_recipes')
            .select('*')
            .eq('user_id', userId)
            .order('clipped_at', { ascending: false });

        if (clippedError) {
            console.error('Error fetching clipped recipes:', clippedError);
            // Return JSON without merging headers
            return NextResponse.json({ status: 'no_clips', recipes: [], total_clips: 0 });
        }

        // 2. Fetch recently used recipe IDs
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentlyUsed, error: recentError } = await supabase
            .from('meal_recipe_entries')
            .select(`
                clipped_recipe_id,
                meals!inner (user_id)
            `)
            .eq('meals.user_id', userId)
            .gte('meal_recipe_entries.created_at', sevenDaysAgo);

        if (recentError) {
            console.error('Error fetching recently used recipes:', recentError);
        }
        const recentlyUsedIds = new Set(recentlyUsed?.map(item => item.clipped_recipe_id).filter(Boolean) || []);

        // 3. Process ClippedRecipe[] into RecipeCard[] format
        const allRecipes: RecipeCard[] = (clippedRecipesData || [])
            .filter((record): record is ClippedRecipe => !!record)
            .map(record => {
                let finalImageUrl: string | undefined = undefined;
                if (record.source_platform === 'instagram') {
                    finalImageUrl = record.image_url ?? '/icons/instagram.svg';
                } else if (record.source_platform === 'tiktok') {
                    finalImageUrl = record.image_url ?? '/icons/tiktok.svg';
                } else if (record.use_placeholder || !record.image_url) {
                    finalImageUrl = '/images/placeholder-recipe.svg';
                } else {
                    finalImageUrl = record.image_url;
                }

                // Map from ClippedRecipe to RecipeCard, omitting undefined optional fields
                const recipeCard: RecipeCard = {
                    id: record.id,
                    title: record.title ?? 'タイトルなし',
                    is_favorite: record.is_favorite ?? false,
                    ...(finalImageUrl && { image_url: finalImageUrl }),
                    ...(record.recipe_type && { recipe_type: record.recipe_type }),
                    ...(record.caution_level && { caution_level: record.caution_level }),
                    ...(record.source_platform && { source_platform: record.source_platform }),
                    ...(record.content_id && { content_id: record.content_id }),
                    ...(record.use_placeholder !== null && record.use_placeholder !== undefined && { use_placeholder: record.use_placeholder }),
                };
                return recipeCard;
            });

        const clippedCount = allRecipes.length;
        let recommendedRecipes: RecipeCard[] = [];

        // 4. Recommendation Logic based on clippedCount
        if (clippedCount > 0 && clippedCount < 5) {
            // Use the first recipe if it exists
            const firstRecipe = allRecipes[0];
            if (firstRecipe) {
                recommendedRecipes = [firstRecipe];
            }
        } else if (clippedCount >= 5 && clippedCount < 10) {
            const availableRecipes = allRecipes.filter(r => !recentlyUsedIds.has(r.id));
            const recipesToUse = availableRecipes.length > 0 ? availableRecipes : allRecipes;
            const favoriteRecipes = recipesToUse.filter(r => r.is_favorite);

            if (favoriteRecipes.length >= 2) {
                recommendedRecipes = shuffleArray(favoriteRecipes).slice(0, 2);
            } else if (favoriteRecipes.length === 1) {
                const firstFavorite = favoriteRecipes[0];
                if (firstFavorite) {
                    recommendedRecipes.push(firstFavorite);
                    const nonFavorites = recipesToUse.filter(r => !r.is_favorite && r.id !== firstFavorite.id);
                    const firstNonFavorite = shuffleArray(nonFavorites)[0];
                    if (firstNonFavorite) {
                        recommendedRecipes.push(firstNonFavorite);
                    }
                }
            } else {
                recommendedRecipes = shuffleArray(recipesToUse).slice(0, Math.min(2, recipesToUse.length));
            }
            // Ensure maximum 2 recipes
            recommendedRecipes = recommendedRecipes.slice(0, 2);
        } else if (clippedCount >= 10) {
            const availableRecipesFull = allRecipes.filter(r => !recentlyUsedIds.has(r.id));
            const recipesToUseFull = availableRecipesFull.length < 3 ? allRecipes : availableRecipesFull;
            const favoriteRecipesFull = recipesToUseFull.filter(r => r.is_favorite);

            if (favoriteRecipesFull.length >= 3) {
                recommendedRecipes = shuffleArray(favoriteRecipesFull).slice(0, 3);
            } else {
                recommendedRecipes = [...favoriteRecipesFull];
                const nonFavoritesFull = recipesToUseFull.filter(r => !r.is_favorite);
                const remainingCount = 3 - recommendedRecipes.length;
                if (nonFavoritesFull.length > 0 && remainingCount > 0) {
                    const additionalRecipes = shuffleArray(nonFavoritesFull).slice(0, remainingCount);
                    recommendedRecipes = [...recommendedRecipes, ...additionalRecipes];
                }
            }
            // Ensure maximum 3 recipes
            recommendedRecipes = recommendedRecipes.slice(0, 3);
        }

        // 5. Determine status
        const status = (() => {
            if (clippedCount === 0) return 'no_clips';
            if (clippedCount < 5) return 'few_clips';
            if (clippedCount < 10) return 'few_more_clips';
            return 'success';
        })();

        // 6. Return response
        // Return JSON without merging headers
        return NextResponse.json({
            status: status,
            recipes: recommendedRecipes,
            total_clips: clippedCount
        });

    } catch (error) {
        console.error('Error in recommend recipes API:', error);
        // The catch block returns its own response, no need to merge headers here
        return NextResponse.json({ error: 'Internal server error', status: 'error', recipes: [], total_clips: 0 }, { status: 500 });
    }
}

// 元のシャッフル関数などはコメントアウトまたは削除
// function shuffleArray<T>(array: T[]): T[] { ... } 