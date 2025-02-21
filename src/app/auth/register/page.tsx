'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { getCookie } from 'cookies-next'

export default function RegisterPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const router = useRouter()
    const supabase = createClientComponentClient()

    // 利用規約同意の確認
    useEffect(() => {
        const termsAgreed = getCookie('terms_agreed')
        if (!termsAgreed) {
            router.push('/terms')
        }
    }, [])

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${location.origin}/auth/callback`,
                    data: {
                        registration_flow: true // 新規登録フラグ
                    }
                },
            })

            if (error) throw error

            setMessage({
                type: 'success',
                text: '登録用リンクを送信しました。メールをご確認ください。',
            })
        } catch (error) {
            console.error('Registration error:', error)
            setMessage({
                type: 'error',
                text: 'エラーが発生しました。もう一度お試しください。',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
            <Card className="w-full max-w-md shadow-lg border-green-100">
                <CardHeader>
                    <h1 className="text-3xl font-bold text-center text-green-700">新規登録</h1>
                    <p className="text-sm text-center text-muted-foreground mt-2">
                        メールアドレスで登録
                    </p>
                </CardHeader>

                <form onSubmit={handleRegister}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder="メールアドレス"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                required
                                className="w-full"
                            />
                        </div>

                        {message && (
                            <div className={`p-3 rounded-lg ${message.type === 'success'
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <p className="text-xs text-zinc-600">
                            ※ 登録後のメールアドレス変更はできません
                        </p>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4">
                        <Button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={loading}
                        >
                            {loading ? '送信中...' : '登録リンクを送信'}
                        </Button>

                        <div className="text-center space-y-2">
                            <p className="text-xs text-muted-foreground">
                                登録することで、利用規約とプライバシーポリシーに同意したものとみなされます。
                            </p>
                            <button
                                type="button"
                                onClick={() => router.push('/terms')}
                                className="text-xs text-green-600 hover:underline"
                            >
                                利用規約を確認する
                            </button>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
