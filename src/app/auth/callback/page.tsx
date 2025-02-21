'use client'

import { useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { getProfile } from '@/lib/utils/profile'

export default function AuthCallbackPage() {
    const supabase = createClientComponentClient()
    const router = useRouter()

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()

                if (sessionError) throw sessionError

                if (!session) {
                    router.push('/auth/login')
                    return
                }

                // プロフィールの確認
                const profile = await getProfile(session.user.id)

                if (!profile) {
                    // 新規ユーザーの場合はプロフィール登録ページへ
                    router.push('/profile')
                } else {
                    // 既存ユーザーの場合はダッシュボードへ
                    router.push('/dashboard')
                }
            } catch (error) {
                console.error('Error in auth callback:', error)
                // エラーが発生した場合はログインページへ
                router.push('/auth/login')
            }
        }

        // URLからエラーパラメータを確認
        const hasError = window.location.search.includes('error')
        const hasCode = window.location.search.includes('code')

        if (hasError) {
            // エラーパラメータがある場合はログインページへ
            router.push('/auth/login')
        } else if (hasCode) {
            // 認証コードがある場合はコールバック処理を実行
            handleCallback()
        } else {
            // パラメータがない場合もログインページへ
            router.push('/auth/login')
        }
    }, [])

    return (
        <div className="min-h-screen flex items-center justify-center">
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