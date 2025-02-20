'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function DashboardPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const checkProfile = async () => {
            try {
                // 現在のユーザーを取得
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    router.push('/auth/login')
                    return
                }

                // プロフィールの存在確認
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('id', user.id)
                    .single()

                if (error || !profile) {
                    router.push('/profile')
                    return
                }

                setIsLoading(false)
            } catch (err) {
                console.error('Profile check failed:', err)
                router.push('/profile')
            }
        }

        checkProfile()
    }, [router])

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
                <div className="flex items-center space-x-2">
                    <svg className="animate-spin h-8 w-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-green-600 text-lg">読み込み中...</span>
                </div>
            </div>
        )
    }

    return (
        // ダッシュボードの実際のコンテンツ
        <div>
            {/* ダッシュボードのコンテンツをここに実装 */}
        </div>
    )
}
