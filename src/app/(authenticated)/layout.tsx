'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { BottomNavigation } from '@/components/layout/bottom-navigation'

export default function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const checkSession = async () => {
            try {
                console.log('認証済みレイアウト: セッションチェック開始')
                const { data: { session }, error } = await supabase.auth.getSession()

                if (error) {
                    console.error('認証済みレイアウト: セッション取得エラー', error)
                    router.replace('/auth/login?authError=session_error')
                    return
                }

                if (!session) {
                    console.log('認証済みレイアウト: セッションが存在しません、ログインページにリダイレクトします')
                    router.replace('/auth/login?authError=login_required')
                    return
                }

                console.log('認証済みレイアウト: 有効なセッションを確認しました', session.user.id)
                setIsLoading(false)
            } catch (error) {
                console.error('認証済みレイアウト: 予期せぬエラー', error)
                router.replace('/auth/login?authError=server_error')
            }
        }

        checkSession()
    }, [router, supabase.auth])

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-green-700 mb-2">
                        ロード中...
                    </h2>
                    <p className="text-zinc-600">
                        しばらくお待ちください
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <main className="flex-grow pb-16">
                {children}
            </main>
            <BottomNavigation />
        </div>
    )
} 