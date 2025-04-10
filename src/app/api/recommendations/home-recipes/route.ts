import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

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

export async function GET(_req: NextRequest) {
    console.log('[API DEBUG] /api/recommendations/home-recipes GET handler started');
    try {
        const cookieStore = await cookies();
        console.log('[API DEBUG] Cookie store retrieved');

        // Check if environment variables are loaded on the server
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('[API DEBUG] Supabase URL or Anon Key is missing on the server!');
            return NextResponse.json({ status: 'debug_env_var_missing', error: 'Server environment variables missing' }, { status: 500 });
        }
        console.log('[API DEBUG] Supabase env vars seem loaded on server.');

        const supabase = createServerClient(
            supabaseUrl, // Use checked variables
            supabaseAnonKey, // Use checked variables
            {
                cookies: {
                    get(name: string) {
                        const cookie = cookieStore.get(name)?.value;
                        // console.log(`[API DEBUG] Cookie get: ${name} = ${cookie ? 'found' : 'not found'}`);
                        return cookie;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value, ...options });
                            console.log(`[API DEBUG] Cookie set: ${name}`);
                        } catch (error) {
                            // Note: Setting cookies in Route Handlers might be problematic
                            console.error(`[API DEBUG] Error setting cookie ${name}:`, error);
                        }
                    },
                    remove(name: string, options: CookieOptions) {
                        try {
                            cookieStore.delete({ name, ...options });
                            console.log(`[API DEBUG] Cookie removed: ${name}`);
                        } catch (error) {
                            console.error(`[API DEBUG] Error removing cookie ${name}:`, error);
                        }
                    },
                },
            }
        );
        console.log('[API DEBUG] Supabase server client created');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('[API DEBUG] supabase.auth.getSession attempted');

        if (sessionError) {
            console.error('[API DEBUG] Error getting session:', sessionError);
            // Return a specific error response for debugging
            return NextResponse.json({ status: 'debug_session_error', error: sessionError.message }, { status: 500 });
        }

        if (!session) {
            console.log('[API DEBUG] No session found');
            // Return a specific response indicating no session
            return NextResponse.json({ status: 'debug_no_session', recipes: [] }); // Match expected structure loosely
        }

        console.log('[API DEBUG] Session found for user:', session.user.id);
        // Return a minimal success response for debugging, mimicking original structure slightly
        return NextResponse.json({ status: 'debug_success', recipes: [], total_clips: 0, userId: session.user.id });

    } catch (error) {
        console.error('[API DEBUG] Unexpected error in GET handler:', error);
        // Return a generic server error response
        return NextResponse.json({ status: 'debug_catch_error', error: error instanceof Error ? error.message : 'Unknown server error' }, { status: 500 });
    }
}

// 元のシャッフル関数などはコメントアウトまたは削除
// function shuffleArray<T>(array: T[]): T[] { ... } 