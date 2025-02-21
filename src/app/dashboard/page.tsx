'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Profile } from '@/lib/utils/profile'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function DashboardPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
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

    if (!profile) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-red-600">プロフィール情報が見つかりません</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <h2 className="text-xl font-semibold text-green-700">
                        プロフィール情報
                    </h2>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <dt className="text-sm font-medium text-zinc-500">年齢</dt>
                            <dd className="mt-1 text-lg text-zinc-700">{profile.age}歳</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-zinc-500">妊娠週数</dt>
                            <dd className="mt-1 text-lg text-zinc-700">{profile.pregnancy_week}週</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-zinc-500">身長</dt>
                            <dd className="mt-1 text-lg text-zinc-700">{profile.height}cm</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-zinc-500">体重</dt>
                            <dd className="mt-1 text-lg text-zinc-700">{profile.weight}kg</dd>
                        </div>
                    </dl>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <h2 className="text-xl font-semibold text-green-700">
                        今日の栄養状態
                    </h2>
                </CardHeader>
                <CardContent>
                    <p className="text-zinc-600">
                        ※ 食事記録機能は近日実装予定です
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
