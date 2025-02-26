'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/lib/utils/profile'

export default function MealLogPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const [mealType, setMealType] = useState('breakfast')
    const [foodDescription, setFoodDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)

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

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // 食事データを保存
            const { error } = await supabase
                .from('meals')
                .insert({
                    user_id: session.user.id,
                    meal_type: mealType,
                    food_description: {
                        items: foodDescription.split('\n').map(item => ({
                            name: item.trim(),
                            quantity: '1人前'
                        })).filter(item => item.name)
                    }
                })

            if (error) throw error

            // 成功したらホームに戻る
            router.push('/home')
        } catch (error) {
            console.error('Error saving meal:', error)
            alert('食事の記録に失敗しました')
        } finally {
            setSubmitting(false)
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
                    <h1 className="text-xl font-bold text-green-600">食事記録</h1>
                </div>
            </header>

            {/* メインコンテンツ */}
            <div className="container mx-auto px-4 py-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 食事タイプ選択 */}
                    <div className="bg-white rounded-xl shadow-sm p-4">
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">食事タイプ</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'breakfast', label: '朝食', emoji: '🍳' },
                                { id: 'lunch', label: '昼食', emoji: '🍱' },
                                { id: 'dinner', label: '夕食', emoji: '🍽️' },
                                { id: 'snack', label: '間食', emoji: '🍎' }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setMealType(type.id)}
                                    className={`p-3 rounded-lg border ${mealType === type.id
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-gray-200'
                                        }`}
                                >
                                    <div className="flex flex-col items-center">
                                        <span className="text-2xl mb-1">{type.emoji}</span>
                                        <span className="text-sm font-medium">{type.label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 食事内容入力 */}
                    <div className="bg-white rounded-xl shadow-sm p-4">
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">食事内容</h2>
                        <p className="text-sm text-gray-600 mb-3">
                            食べたものを1行ずつ入力してください。
                        </p>
                        <textarea
                            value={foodDescription}
                            onChange={(e) => setFoodDescription(e.target.value)}
                            placeholder="例：
ご飯 茶碗1杯
焼き魚（鮭） 1切れ
ほうれん草のお浸し 小鉢1杯"
                            className="w-full h-40 p-3 border border-gray-300 rounded-lg"
                            required
                        />
                    </div>

                    {/* 送信ボタン */}
                    <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                    >
                        {submitting ? '送信中...' : '記録を保存する'}
                    </Button>
                </form>
            </div>
        </>
    )
} 