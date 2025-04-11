import { NextResponse, NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { withErrorHandling } from '@/lib/api/middleware';
import { AppError, ErrorCode } from '@/lib/error';

export const GET = withErrorHandling(async (req: NextRequest) => {
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

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new AppError({
            code: ErrorCode.Base.AUTH_ERROR,
            message: '認証が必要です',
            userMessage: 'この操作にはログインが必要です。'
        });
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
        throw new AppError({
            code: ErrorCode.Base.API_ERROR,
            message: `Supabase query error: ${error.message}`,
            userMessage: 'レシピデータの取得に失敗しました。',
            originalError: error
        });
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
}); 