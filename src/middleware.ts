import { NextRequest, NextResponse } from 'next/server'
// import { createServerComponentClient } from '@supabase/auth-helpers-nextjs' // 削除
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr' // 追加

// 認証が必要なパス
const PROTECTED_PATHS = [
    '/meals',
    '/recipes',
    '/profile',
    '/dashboard',
    '/home',
    '/settings',
]

// 認証チェックをスキップするパス
const PUBLIC_PATHS = [
    '/auth/login',
    '/auth/register',
    '/auth/callback',
    '/terms',
    '/api/health', // ヘルスチェック用API
]

// API呼び出し関連のパス
const API_PATHS = ['/api/']

// @supabase/ssr 用の Supabase クライアント作成関数 (ヘルパー化)
const createSupabaseMiddlewareClient = (req: NextRequest, res: NextResponse) => {
    // cookieStore をリクエスト・レスポンスから取得・設定できるようにラップ
    let requestCookies = '';
    req.cookies.getAll().forEach((cookie) => {
        requestCookies += `${cookie.name}=${cookie.value}; `;
    });
    const cookieStore = {
        get: (name: string) => {
            return req.cookies.get(name)?.value;
        },
        set: (name: string, value: string, options: CookieOptions) => {
            res.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
            res.cookies.set({ name, value: '', ...options });
        },
    };

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: cookieStore,
        }
    );
}

export async function middleware(req: NextRequest) {
    try {
        const res = NextResponse.next()
        const pathname = req.nextUrl.pathname

        // ルートパスの特別処理
        if (pathname === '/') {
            // const cookieStore = cookies(); // 削除
            // const supabase = createServerComponentClient({ cookies: () => cookieStore }); // 削除
            const supabase = createSupabaseMiddlewareClient(req, res); // @supabase/ssr 使用
            const { data: { session } } = await supabase.auth.getSession()

            if (session) {
                console.log('ルートパスでログイン状態を検出: /homeにリダイレクト')
                return NextResponse.redirect(new URL('/home', req.url))
            }
            return res
        }

        // 公開パスはチェックをスキップ
        for (const path of PUBLIC_PATHS) {
            if (pathname.startsWith(path)) {
                return res
            }
        }

        // API呼び出しはセッションチェックをスキップ（APIハンドラー内でチェック）
        for (const path of API_PATHS) {
            if (pathname.startsWith(path)) {
                return res
            }
        }

        // 認証保護が必要なパスかどうかチェック
        let isProtectedPath = false
        for (const path of PROTECTED_PATHS) {
            if (pathname.startsWith(path)) {
                isProtectedPath = true
                break
            }
        }

        // 保護されたパスでなければ通過
        if (!isProtectedPath) {
            return res
        }

        // セッションの存在確認
        // const cookieStore = cookies(); // 削除
        // const supabase = createServerComponentClient({ cookies: () => cookieStore }); // 削除
        const supabase = createSupabaseMiddlewareClient(req, res); // @supabase/ssr 使用
        const {
            data: { session },
        } = await supabase.auth.getSession()

        // セッションがない場合はログインページへリダイレクト
        if (!session) {
            const loginUrl = new URL('/auth/login', req.url)
            loginUrl.searchParams.set('callbackUrl', pathname)
            loginUrl.searchParams.set('authError', 'login_required')
            return NextResponse.redirect(loginUrl)
        }

        // セッションがある場合は通過
        return res
    } catch (error) {
        console.error('Middleware error:', error)

        // エラーメッセージを設定してログインページへリダイレクト
        const loginUrl = new URL('/auth/login', req.url)
        loginUrl.searchParams.set('authError', 'server_error')

        return NextResponse.redirect(loginUrl)
    }
}

// ミドルウェアを適用するパスを指定
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public (public files)
         */
        '/((?!_next/static|_next/image|favicon.ico|public).*)',
    ],
}