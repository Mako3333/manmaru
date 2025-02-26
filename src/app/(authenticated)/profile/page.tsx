'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ProfileFormData {
    age: number
    pregnancy_week: number
    height: number
    weight: number
    adult_family_members: number
    child_family_members: number
}

export default function ProfilePage() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClientComponentClient()

    const [formData, setFormData] = useState<ProfileFormData>({
        age: 0,
        pregnancy_week: 0,
        height: 0,
        weight: 0,
        adult_family_members: 1,
        child_family_members: 0
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: Number(value)
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                throw new Error('セッションが見つかりません')
            }

            // バリデーション
            if (formData.age < 15 || formData.age > 60) {
                throw new Error('年齢は15歳から60歳の間で入力してください')
            }
            if (formData.pregnancy_week < 1 || formData.pregnancy_week > 42) {
                throw new Error('妊娠週数は1週から42週の間で入力してください')
            }
            if (formData.height < 130 || formData.height > 200) {
                throw new Error('身長は130cmから200cmの間で入力してください')
            }
            if (formData.weight < 30 || formData.weight > 150) {
                throw new Error('体重は30kgから150kgの間で入力してください')
            }

            const { error: insertError } = await supabase
                .from('profiles')
                .insert([
                    {
                        user_id: session.user.id,
                        ...formData,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])

            if (insertError) throw insertError

            router.push('/dashboard')
        } catch (error) {
            console.error('Profile creation error:', error)
            setError(error instanceof Error ? error.message : '予期せぬエラーが発生しました')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
            <Card className="w-full max-w-2xl shadow-lg border-green-100">
                <CardHeader>
                    <h1 className="text-3xl font-bold text-center text-green-700">プロフィール登録</h1>
                    <p className="text-sm text-center text-muted-foreground mt-2">
                        あなたに最適な栄養アドバイスのために、以下の情報を入力してください
                    </p>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="age">年齢</Label>
                                <div className="relative">
                                    <Input
                                        id="age"
                                        name="age"
                                        type="number"
                                        value={formData.age}
                                        onChange={handleChange}
                                        required
                                        min="15"
                                        max="60"
                                        className="pr-8"
                                    />
                                    <span className="absolute right-3 top-2 text-zinc-500">歳</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pregnancy_week">妊娠週数</Label>
                                <div className="relative">
                                    <Input
                                        id="pregnancy_week"
                                        name="pregnancy_week"
                                        type="number"
                                        value={formData.pregnancy_week}
                                        onChange={handleChange}
                                        required
                                        min="1"
                                        max="42"
                                        className="pr-8"
                                    />
                                    <span className="absolute right-3 top-2 text-zinc-500">週</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="height">身長</Label>
                                <div className="relative">
                                    <Input
                                        id="height"
                                        name="height"
                                        type="number"
                                        value={formData.height}
                                        onChange={handleChange}
                                        required
                                        min="130"
                                        max="200"
                                        step="0.1"
                                        className="pr-8"
                                    />
                                    <span className="absolute right-3 top-2 text-zinc-500">cm</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="weight">体重</Label>
                                <div className="relative">
                                    <Input
                                        id="weight"
                                        name="weight"
                                        type="number"
                                        value={formData.weight}
                                        onChange={handleChange}
                                        required
                                        min="30"
                                        max="150"
                                        step="0.1"
                                        className="pr-8"
                                    />
                                    <span className="absolute right-3 top-2 text-zinc-500">kg</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="adult_family_members">同居の大人の人数</Label>
                                <Input
                                    id="adult_family_members"
                                    name="adult_family_members"
                                    type="number"
                                    value={formData.adult_family_members}
                                    onChange={handleChange}
                                    required
                                    min="1"
                                    max="10"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="child_family_members">同居の子どもの人数</Label>
                                <Input
                                    id="child_family_members"
                                    name="child_family_members"
                                    type="number"
                                    value={formData.child_family_members}
                                    onChange={handleChange}
                                    required
                                    min="0"
                                    max="10"
                                />
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4">
                        <Button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={loading}
                        >
                            {loading ? '保存中...' : 'プロフィールを保存'}
                        </Button>

                        <p className="text-xs text-center text-muted-foreground">
                            ※ プロフィール情報は後からでも変更できます
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}