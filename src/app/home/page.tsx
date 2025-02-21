'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/lib/utils/profile'

export default function HomePage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const supabase = createClientComponentClient()

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return

                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .single()

                if (error) throw error
                setProfile(data)
            } catch (error) {
                console.error('Error fetching profile:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchProfile()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-zinc-600">読み込み中...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-green-50">
            {/* デコレーション要素 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-green-100 rounded-full opacity-20 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-100 rounded-full opacity-20 blur-3xl" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* ウェルカムセクション */}
                <div className="text-center mb-8 animate-fade-in">
                    <h1 className="text-5xl font-bold text-green-700 mb-2">
                        manmaru
                    </h1>
                    <p className="text-zinc-800">
                        あなたと赤ちゃんの健康を、まんまる笑顔に
                    </p>
                </div>

                {/* クイックアクション */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <Button
                        onClick={() => router.push('/meals/log')}
                        className="h-24 bg-white hover:bg-green-50 border border-green-100 text-green-700 shadow-sm"
                    >
                        <div className="flex flex-col items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            </svg>
                            <span>食事を記録</span>
                        </div>
                    </Button>

                    <Button
                        onClick={() => router.push('/meals/recommend')}
                        className="h-24 bg-white hover:bg-green-50 border border-green-100 text-green-700 shadow-sm"
                    >
                        <div className="flex flex-col items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span>献立提案</span>
                        </div>
                    </Button>
                </div>

                {/* 今日の栄養状態 */}
                <Card className="mb-8 bg-white/80 backdrop-blur-sm shadow-lg border-green-100">
                    <CardHeader>
                        <h2 className="text-xl font-semibold text-green-700 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            今日の栄養状態
                        </h2>
                    </CardHeader>
                    <CardContent>
                        <p className="text-zinc-600 text-center">
                            ※ 食事を記録すると栄養バランスが表示されます
                        </p>
                    </CardContent>
                </Card>

                {/* メニュー */}
                <div className="grid grid-cols-2 gap-4">
                    <Button
                        onClick={() => router.push('/dashboard')}
                        variant="ghost"
                        className="h-20 hover:bg-green-50"
                    >
                        <div className="flex flex-col items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mb-1 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-zinc-600">詳しい分析</span>
                        </div>
                    </Button>

                    <Button
                        onClick={() => router.push('/profile')}
                        variant="ghost"
                        className="h-20 hover:bg-green-50"
                    >
                        <div className="flex flex-col items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mb-1 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-sm text-zinc-600">プロフィール</span>
                        </div>
                    </Button>
                </div>
            </div>
        </div>
    )
}