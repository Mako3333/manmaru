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
    console.log('[home-recipes] Test 4: Fetch recently_used');
    try {
        const cookieStore = await cookies();
        console.log('[home-recipes] cookies() called successfully');

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
        console.log('[home-recipes] Supabase client initialized');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('[home-recipes] getSession() called');

        if (sessionError) {
            console.error('[home-recipes] Error getting session:', sessionError);
        }
        console.log('[home-recipes] Session data:', session);

        if (!session) {
            console.log('[home-recipes] No session found, returning 401');
            // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            // テストのためモックを返す
        }

        // 1. クリップデータの取得
        console.log('[home-recipes] Getting clipped recipes for user:', session?.user.id);
        const { data: clippedRecipes, error: clippedError } = await supabase
            .from('clipped_recipes')
            .select('*')
            .eq('user_id', session?.user.id || '')
            .order('clipped_at', { ascending: false });

        if (clippedError) {
            console.error('[home-recipes] Error fetching clipped recipes:', clippedError);
            // エラーが発生しても、テストのためモックデータを返す
        } else {
            console.log('[home-recipes] Found', clippedRecipes?.length || 0, 'clipped recipes');
        }

        // 2. 最近使用したレシピの取得を元に戻す
        console.log('[home-recipes] Getting recently used recipes for user:', session?.user.id);
        const { data: recentlyUsed, error: recentError } = await supabase
            .from('meal_recipe_entries')
            .select('clipped_recipe_id')
            .eq('user_id', session?.user.id || '') // sessionがない場合もエラー回避
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (recentError) {
            console.error('[home-recipes] Error fetching recently used recipes:', recentError);
            // エラーがあっても処理を続行（最近使用したレシピがないだけと扱う）
        } else {
            console.log('[home-recipes] Found', recentlyUsed?.length || 0, 'recently used recipe entries');
        }

        // recentlyUsedIds の作成を元に戻す
        let recentlyUsedIds: Set<string>;
        try {
            recentlyUsedIds = new Set(
                (recentlyUsed || [])
                    .filter(item => item && item.clipped_recipe_id)
                    .map(item => item.clipped_recipe_id)
            );
            console.log('[home-recipes] recentlyUsedIds size:', recentlyUsedIds.size);
            // console.log('[home-recipes] recentlyUsedIds content:', Array.from(recentlyUsedIds));
        } catch (error) {
            console.error('[home-recipes] Error creating recentlyUsedIds:', error);
            recentlyUsedIds = new Set(); // エラー時は空にする
        }


        // 3. レコメンドロジックはまだコメントアウト
        // ...

        // 固定のJSONレスポンスを返す
        const mockRecipes = [
            { id: 'mock1', title: 'Mock Recipe 1', image_url: '/placeholder.png', is_favorite: false },
            { id: 'mock2', title: 'Mock Recipe 2', image_url: '/placeholder.png', is_favorite: true },
        ];

        console.log('[home-recipes] Returning mock data');
        return NextResponse.json({
            status: 'enough_clips', // 仮のステータス
            recipes: mockRecipes,
            total_clips: 2 // 仮の件数
        });

    } catch (error) {
        console.error('[home-recipes] Test 4 Error:', error);
        // エラーの詳細を出力
        if (error instanceof Error) {
            console.error('[home-recipes] Error name:', error.name);
            console.error('[home-recipes] Error message:', error.message);
            console.error('[home-recipes] Error stack:', error.stack);
        }
        return NextResponse.json(
            { error: 'Test 4 failed' },
            { status: 500 }
        );
    }
}

// shuffleArray 関数はまだ不要 