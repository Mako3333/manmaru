import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 認証が必要なパスの配列
const PROTECTED_PATHS = ['/dashboard', '/profile', '/meals']
// 認証済みユーザーがアクセスできないパスの配列
const AUTH_PATHS = ['/auth/login', '/auth/register']

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req, res })

    // セッションの取得
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    // セッションエラーの場合はログインページへ
    if (sessionError) {
        console.error('Session error:', sessionError)
        return NextResponse.redirect(new URL('/auth/login', req.url))
    }

    const path = req.nextUrl.pathname

    // プロフィール情報を取得する関数
    const getProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    return null
                }
                throw error
            }
            return data
        } catch (err) {
            console.error('Profile check error:', err)
            return null
        }
    }

    // 未認証ユーザーの処理
    if (!session) {
        // 保護されたパスへのアクセスをチェック
        if (PROTECTED_PATHS.some(protectedPath => path.startsWith(protectedPath))) {
            // 認証ページにいない場合のみリダイレクト
            if (!AUTH_PATHS.some(authPath => path.startsWith(authPath))) {
                return NextResponse.redirect(new URL('/auth/login', req.url))
            }
        }
        return res
    }

    // 認証済みユーザーの処理
    if (session) {
        // 認証ページへのアクセスをチェック
        if (AUTH_PATHS.some(authPath => path.startsWith(authPath))) {
            // コールバックページは許可
            if (path === '/auth/callback') {
                return res
            }

            // プロフィール情報を確認してリダイレクト先を決定
            const profile = await getProfile(session.user.id)
            const redirectUrl = profile ? '/dashboard' : '/profile'
            return NextResponse.redirect(new URL(redirectUrl, req.url))
        }

        // ダッシュボードへのアクセスをチェック
        if (path.startsWith('/dashboard')) {
            const profile = await getProfile(session.user.id)
            if (!profile) {
                return NextResponse.redirect(new URL('/profile', req.url))
            }
        }

        // プロフィールページへのアクセスをチェック
        if (path === '/profile') {
            const profile = await getProfile(session.user.id)
            if (profile) {
                return NextResponse.redirect(new URL('/dashboard', req.url))
            }
        }
    }

    return res
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