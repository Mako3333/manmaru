'use client'

import React from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { AuthError } from '@supabase/supabase-js'

export default function RegisterPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [showSuccess, setShowSuccess] = useState(false)
    const [registeredEmail, setRegisteredEmail] = useState('')

    // エラーメッセージをクリアする関数
    const clearError = () => {
        setError('')
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        setShowSuccess(false)

        const formData = new FormData(e.currentTarget)
        const email = formData.get('email') as string

        try {
            const { data, error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/login`
                }
            })

            if (error) throw error

            setRegisteredEmail(email)
            setShowSuccess(true)
        } catch (err) {
            const authError = err as AuthError
            const errorMessages: Record<string, string> = {
                'User already registered': 'このメールアドレスは既に登録されています。',
                'Invalid email': '有効なメールアドレスを入力してください。',
                'Email rate limit exceeded': 'メール送信の制限回数を超えました。しばらく時間をおいて再度お試しください。',
                'Rate limit exceeded': '試行回数が多すぎます。しばらく時間をおいて再度お試しください。'
            }

            setError(
                errorMessages[authError.message] ||
                '予期せぬエラーが発生しました。しばらく時間をおいて再度お試しください。'
            )
        } finally {
            setIsLoading(false)
        }
    }

    // 入力フィールドの変更時にエラーをクリア
    const handleInputChange = () => {
        if (error) clearError()
    }

    if (showSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
                <Card className="w-full max-w-md shadow-lg border-green-100">
                    <CardHeader>
                        <h1 className="text-2xl font-bold text-center text-green-700">メールを確認してください</h1>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-green-50 border border-green-100 text-green-600 p-4 rounded-lg text-center">
                            <p className="mb-4">登録用のメールを送信しました！</p>
                            <p className="text-sm text-zinc-600 mb-2">
                                {registeredEmail} 宛にメールを送信しました。
                            </p>
                            <p className="text-sm text-zinc-600">
                                メール内のリンクをクリックして、登録を完了してください。
                            </p>
                        </div>
                        <div className="text-sm text-zinc-500 text-center">
                            <p>メールが届かない場合は、迷惑メールフォルダもご確認ください。</p>
                        </div>
                        <Button
                            onClick={() => router.push('/auth/login')}
                            className="w-full bg-green-600 hover:bg-green-700 text-white transition-colors"
                        >
                            ログインページへ
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
            <Card className="w-full max-w-md shadow-lg border-green-100">
                <CardHeader>
                    <h1 className="text-2xl font-bold text-center text-green-700">新規登録</h1>
                    <p className="text-sm text-center text-muted-foreground mt-2">
                        まんまるへようこそ
                    </p>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-zinc-700">メールアドレス</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="example@email.com"
                                required
                                className="border-green-100 focus:border-green-200 focus:ring-green-200"
                                onChange={handleInputChange}
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg text-sm">
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
                                    送信中...
                                </span>
                            ) : 'メールアドレスを登録'}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex justify-center">
                    <p className="text-sm text-zinc-600">
                        アカウントをお持ちの方は
                        <Link href="/auth/login" className="text-green-600 hover:text-green-700 font-semibold ml-1">
                            ログイン
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
