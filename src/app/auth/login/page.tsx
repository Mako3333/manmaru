'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // URLパラメータからエラーメッセージを取得して表示
    useEffect(() => {
        const authError = searchParams.get('authError')
        if (authError) {
            let errorMessage = 'ログインが必要です'

            if (authError === 'login_required') {
                errorMessage = 'この操作を行うにはログインが必要です'
            } else if (authError === 'session_error') {
                errorMessage = 'セッションの取得中にエラーが発生しました'
            } else if (authError === 'server_error') {
                errorMessage = 'サーバーエラーが発生しました'
            } else if (authError === 'callback_error') {
                errorMessage = '認証処理中にエラーが発生しました'
            }

            setMessage({
                type: 'error',
                text: errorMessage
            })
        }

        const error = searchParams.get('error')
        if (error) {
            setMessage({
                type: 'error',
                text: 'ログイン処理中にエラーが発生しました'
            })
        }
    }, [searchParams])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            console.log('ログイン処理開始: メールアドレス', email)

            if (!email || !email.includes('@')) {
                setMessage({
                    type: 'error',
                    text: '有効なメールアドレスを入力してください'
                })
                return
            }

            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            })

            if (error) {
                console.error('ログインエラー:', error)
                throw error
            }

            console.log('ログインリンク送信成功')
            setMessage({
                type: 'success',
                text: 'ログインリンクを送信しました。メールをご確認ください。',
            })
        } catch (error) {
            console.error('ログインエラー:', error)
            setMessage({
                type: 'error',
                text: 'メール送信中にエラーが発生しました。もう一度お試しください。',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
            <Card className="w-full max-w-md shadow-lg border-green-100">
                <CardHeader>
                    <h1 className="text-3xl font-bold text-center text-green-700">ログイン</h1>
                    <p className="text-sm text-center text-muted-foreground mt-2">
                        Magic Linkでログイン
                    </p>
                </CardHeader>

                <form onSubmit={handleLogin}>
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
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4">
                        <Button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={loading}
                        >
                            {loading ? 'メール送信中...' : 'ログインリンクを送信'}
                        </Button>

                        <p className="text-xs text-center text-muted-foreground">
                            ※ 登録済みのメールアドレスにログインリンクを送信します
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}