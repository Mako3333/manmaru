import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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
    '/',
    '/terms',
    '/api/health', // ヘルスチェック用API
]

// API呼び出し関連のパス
const API_PATHS = ['/api/']

export async function middleware(req: NextRequest) {
    try {
        const res = NextResponse.next()
        const pathname = req.nextUrl.pathname

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
        const supabase = createServerComponentClient({ cookies })
        const {
            data: { session },
        } = await supabase.auth.getSession()

        // セッションがない場合はログインページへリダイレクト
        if (!session) {
            const loginUrl = new URL('/auth/login', req.url)

            // 現在のURLをコールバックURLとして設定
            loginUrl.searchParams.set('callbackUrl', pathname)

            // 認証エラーメッセージをクエリパラメータとして設定
            loginUrl.searchParams.set('authError', 'login_required')

            // リダイレクト
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