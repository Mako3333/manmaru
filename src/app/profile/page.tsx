'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

interface ProfileFormData {
    user_id: string
    age: number
    pregnancy_week: number
    height: number
    weight: number
    adult_family_members: number
    child_family_members: number
}

export default function ProfilePage() {
    const router = useRouter()
    const { session } = useAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            if (!session?.user) {
                throw new Error('ログイン状態が確認できません')
            }

            const formData = new FormData(e.currentTarget)
            const profileData: ProfileFormData = {
                user_id: session.user.id,
                age: Number(formData.get('age')),
                pregnancy_week: Number(formData.get('pregnancy_week')),
                height: Number(formData.get('height')),
                weight: Number(formData.get('weight')),
                adult_family_members: Number(formData.get('adult_family_members')),
                child_family_members: Number(formData.get('child_family_members')),
            }

            // プロフィールを保存
            const { error: insertError } = await supabase
                .from('profiles')
                .insert(profileData)

            if (insertError) {
                console.error('プロフィール作成エラー:', insertError)
                throw new Error('プロフィールの保存に失敗しました')
            }

            router.push('/dashboard')
        } catch (err) {
            console.error('handleSubmit エラー:', err)
            setError(err instanceof Error ? err.message : 'プロフィールの保存に失敗しました。もう一度お試しください。')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
            <Card className="w-full max-w-md shadow-lg border-green-100">
                <CardHeader>
                    <h1 className="text-2xl font-bold text-center text-green-700">プロフィール設定</h1>
                    <p className="text-sm text-center text-muted-foreground mt-2">
                        あなたに合わせた栄養管理のために必要な情報を入力してください
                    </p>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="age" className="text-zinc-700">年齢</Label>
                            <Input
                                id="age"
                                name="age"
                                type="number"
                                required
                                min="15"
                                max="60"
                                className="border-green-100 focus:border-green-200 focus:ring-green-200"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pregnancy_week" className="text-zinc-700">妊娠週数</Label>
                            <Input
                                id="pregnancy_week"
                                name="pregnancy_week"
                                type="number"
                                required
                                min="1"
                                max="42"
                                className="border-green-100 focus:border-green-200 focus:ring-green-200"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="height" className="text-zinc-700">身長 (cm)</Label>
                            <Input
                                id="height"
                                name="height"
                                type="number"
                                required
                                min="130"
                                max="200"
                                step="0.1"
                                className="border-green-100 focus:border-green-200 focus:ring-green-200"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="weight" className="text-zinc-700">体重 (kg)</Label>
                            <Input
                                id="weight"
                                name="weight"
                                type="number"
                                required
                                min="30"
                                max="150"
                                step="0.1"
                                className="border-green-100 focus:border-green-200 focus:ring-green-200"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="adult_family_members" className="text-zinc-700">大人の人数</Label>
                            <Input
                                id="adult_family_members"
                                name="adult_family_members"
                                type="number"
                                required
                                min="1"
                                max="10"
                                defaultValue="1"
                                className="border-green-100 focus:border-green-200 focus:ring-green-200"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="child_family_members" className="text-zinc-700">子どもの人数</Label>
                            <Input
                                id="child_family_members"
                                name="child_family_members"
                                type="number"
                                required
                                min="0"
                                max="10"
                                defaultValue="0"
                                className="border-green-100 focus:border-green-200 focus:ring-green-200"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700 text-white transition-colors"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    保存中...
                                </span>
                            ) : '保存する'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
} 