import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// パスの定義
const PROTECTED_PATHS = ['/dashboard', '/profile', '/meals', '/home']
const AUTH_PATHS = ['/auth/login', '/auth/register']
const PUBLIC_PATHS = ['/', '/terms']
const CALLBACK_PATH = '/auth/callback'

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req, res })

    // パスの取得
    const path = req.nextUrl.pathname

    // コールバックパスの場合は処理をスキップ
    if (path === CALLBACK_PATH) {
        return res
    }

    try {
        // セッションの取得
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
            console.error('Session error:', sessionError)
            // セッションエラーの場合はログインページへ
            return NextResponse.redirect(new URL('/auth/login', req.url))
        }

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

        // 認証済みユーザーの処理
        if (session) {
            // プロフィール情報の取得
            const profile = await getProfile(session.user.id)

            // 認証ページまたはパブリックページへのアクセスをチェック
            if ([...AUTH_PATHS, ...PUBLIC_PATHS].includes(path)) {
                return NextResponse.redirect(
                    new URL(profile ? '/home' : '/profile', req.url)
                )
            }

            // プロフィール未設定でホームまたはダッシュボードにアクセスしようとした場合
            if (!profile && (path === '/home' || path.startsWith('/dashboard'))) {
                return NextResponse.redirect(new URL('/profile', req.url))
            }

            // プロフィール設定済みでプロフィールページにアクセスしようとした場合
            if (profile && path === '/profile') {
                return NextResponse.redirect(new URL('/home', req.url))
            }

            return res
        }

        // 未認証ユーザーの処理
        if (!session) {
            // パブリックパスの場合は処理をスキップ
            if (PUBLIC_PATHS.includes(path)) {
                return res
            }

            // 保護されたパスへのアクセスをチェック
            if (PROTECTED_PATHS.some(protectedPath => path.startsWith(protectedPath))) {
                // 認証ページへリダイレクト
                const redirectUrl = new URL('/auth/login', req.url)
                redirectUrl.searchParams.set('redirectTo', path)
                return NextResponse.redirect(redirectUrl)
            }
        }

        return res
    } catch (error) {
        console.error('Middleware error:', error)
        // エラーが発生した場合はログインページへ
        return NextResponse.redirect(new URL('/auth/login', req.url))
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