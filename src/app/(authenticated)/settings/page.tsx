'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/utils/profile'
import { Button } from '@/components/ui/button'
import { calculatePregnancyWeek } from '@/lib/date-utils'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function SettingsPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

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

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut()
            router.push('/')
        } catch (error) {
            console.error('Error signing out:', error)
        }
    }

    const updateProfile = async (updatedData: any) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const { error } = await supabase
                .from('profiles')
                .update(updatedData)
                .eq('user_id', session.user.id)

            if (error) throw error

            // 更新成功後、プロファイルを再取得
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single()

            if (fetchError) throw fetchError
            setProfile(data)

            // 成功メッセージを表示
            alert('プロファイルを更新しました')
        } catch (error) {
            console.error('Error updating profile:', error)
            alert('プロファイルの更新に失敗しました')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-zinc-600">読み込み中...</p>
            </div>
        )
    }

    if (!profile) {
        router.push('/profile')
        return null
    }

    return (
        <>
            {/* ヘッダー */}
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold text-green-600">設定</h1>
                </div>
            </header>

            {/* メインコンテンツ */}
            <div className="container mx-auto px-4 py-6 space-y-6">
                {/* プロフィール設定 */}
                <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800">プロフィール設定</h2>
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center py-2">
                            <span className="text-gray-700">プロフィール編集</span>
                            <button
                                onClick={() => router.push('/profile/edit')}
                                className="text-green-600 text-sm"
                            >
                                編集
                            </button>
                        </div>

                        <div className="flex justify-between items-center py-2 border-t border-gray-100">
                            <span className="text-gray-700">出産予定日</span>
                            <span className="text-gray-900">
                                {profile.due_date ? format(new Date(profile.due_date), 'yyyy年MM月dd日', { locale: ja }) : '-'}
                            </span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-t border-gray-100">
                            <span className="text-gray-700">妊娠週数（計算値）</span>
                            <span className="text-gray-900">
                                {profile.due_date ? calculatePregnancyWeek(profile.due_date) : '-'} 週
                            </span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-t border-gray-100">
                            <span className="text-gray-700">身長</span>
                            <span className="text-gray-900">{profile.height || '-'} cm</span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-t border-gray-100">
                            <span className="text-gray-700">体重</span>
                            <span className="text-gray-900">{profile.weight || '-'} kg</span>
                        </div>
                    </div>
                </section>

                {/* アプリ設定 */}
                <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800">アプリ設定</h2>
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center py-2">
                            <span className="text-gray-700">通知設定</span>
                            <button className="relative inline-flex items-center h-6 rounded-full w-11 bg-gray-200">
                                <span className="absolute h-4 w-4 left-1 bg-white rounded-full"></span>
                            </button>
                        </div>

                        <div className="flex justify-between items-center py-2 border-t border-gray-100">
                            <span className="text-gray-700">ダークモード</span>
                            <button className="relative inline-flex items-center h-6 rounded-full w-11 bg-gray-200">
                                <span className="absolute h-4 w-4 left-1 bg-white rounded-full"></span>
                            </button>
                        </div>
                    </div>
                </section>


                {/* ログアウトボタン */}
                <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                >
                    ログアウト
                </Button>
            </div>
        </>
    )
} 