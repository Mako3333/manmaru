'use client'

import { useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { getProfile } from '@/lib/utils/profile'

export default function AuthCallbackPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const router = useRouter()

    useEffect(() => {
        const handleCallback = async () => {
            try {
                console.log('認証コールバック処理を開始します')
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()

                if (sessionError) {
                    console.error('セッション取得エラー:', sessionError)
                    throw sessionError
                }

                if (!session) {
                    console.log('セッションが存在しません、ログインページにリダイレクトします')
                    router.replace('/auth/login')
                    return
                }

                console.log('セッション取得成功:', session.user.id)
                // プロフィールの確認
                const profile = await getProfile()

                if (!profile) {
                    // 新規ユーザーの場合はプロフィール登録ページへ
                    console.log('プロフィールが存在しません、プロフィール登録ページにリダイレクトします')
                    router.replace('/profile')
                } else {
                    // 既存ユーザーの場合はホームページへ
                    console.log('プロフィールが存在します、ホームページにリダイレクトします')
                    router.replace('/home')
                }
            } catch (error) {
                console.error('認証コールバック処理中にエラーが発生しました:', error)
                // エラーが発生した場合はログインページへ
                router.replace('/auth/login?error=callback_error')
            }
        }

        // URLからエラーパラメータを確認
        const hasError = window.location.search.includes('error')
        const hasCode = window.location.search.includes('code')

        console.log('URL確認: hasError=', hasError, 'hasCode=', hasCode)

        if (hasError) {
            // エラーパラメータがある場合はログインページへ
            console.log('エラーパラメータが存在します、ログインページにリダイレクトします')
            router.replace('/auth/login?error=auth_error')
        } else if (hasCode) {
            // 認証コードがある場合はコールバック処理を実行
            console.log('認証コードが存在します、コールバック処理を実行します')
            handleCallback()
        } else {
            // パラメータがない場合もログインページへ
            console.log('有効なパラメータが存在しません、ログインページにリダイレクトします')
            router.replace('/auth/login')
        }
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
            <div className="text-center">
                <h2 className="text-xl font-semibold text-green-700 mb-2">
                    認証中...
                </h2>
                <p className="text-zinc-600">
                    しばらくお待ちください
                </p>
            </div>
        </div>
    )
}