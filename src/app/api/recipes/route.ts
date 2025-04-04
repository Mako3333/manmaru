import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
    try {
        // ユーザー認証確認
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

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            );
        }

        // URLからクエリパラメータを取得
        const url = new URL(req.url);
        const recipeType = url.searchParams.get('recipe_type');
        const isFavorite = url.searchParams.get('is_favorite') === 'true';
        const searchQuery = url.searchParams.get('search');
        const cautionLevel = url.searchParams.get('caution_level');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // クエリビルダー
        let query = supabase
            .from('clipped_recipes')
            .select('*')
            .eq('user_id', user.id)
            .order('clipped_at', { ascending: false });

        // 条件フィルタリング
        if (recipeType) {
            query = query.eq('recipe_type', recipeType);
        }

        if (url.searchParams.has('is_favorite')) {
            query = query.eq('is_favorite', isFavorite);
        }

        if (cautionLevel) {
            query = query.eq('caution_level', cautionLevel);
        }

        if (searchQuery) {
            query = query.ilike('title', `%${searchQuery}%`);
        }

        // ページネーション
        query = query.range(offset, offset + limit - 1);

        // データ取得
        const { data: recipes, error, count } = await query;

        if (error) {
            throw error;
        }

        // カードビュー用に栄養素フォーカスを追加
        const recipesWithFocus = recipes.map(recipe => {
            const nutrition = recipe.nutrition_per_serving || {};
            const nutritionFocus = [];

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

        return NextResponse.json({
            recipes: recipesWithFocus,
            count
        });

    } catch (error) {
        console.error('Recipe fetch error:', error);
        return NextResponse.json(
            { error: 'レシピの取得中にエラーが発生しました' },
            { status: 500 }
        );
    }
} 