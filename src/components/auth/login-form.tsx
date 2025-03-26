// src/components/auth/login-form.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { AuthError, ErrorCode } from '@/lib/errors/app-errors'
import { handleError } from '@/lib/errors/error-handler'

export function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    // URLパラメータからエラーと戻り先を取得
    useEffect(() => {
        const authError = searchParams.get('authError')
        if (authError) {
            switch (authError) {
                case 'login_required':
                    setError('この操作を行うにはログインが必要です。')
                    break
                case 'server_error':
                    setError('サーバーエラーが発生しました。もう一度お試しください。')
                    break
                default:
                    setError('ログインが必要です。')
            }
        }

        const registered = searchParams.get('registered')
        if (registered === 'true') {
            toast.success('登録が完了しました', {
                description: 'メールアドレスとパスワードでログインしてください',
            })
        }
    }, [searchParams])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            // 入力検証
            if (!email || !password) {
                throw new AuthError(
                    'メールアドレスとパスワードを入力してください',
                    ErrorCode.DATA_VALIDATION_ERROR,
                    '必要な情報が入力されていません',
                    { email: !email, password: !password }
                )
            }

            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (authError) {
                // Supabaseエラーを変換
                let code = ErrorCode.AUTH_INVALID
                let message = 'ログイン情報が正しくありません'
                let suggestions = ['メールアドレスとパスワードを確認してください']

                if (authError.message.includes('not found') || authError.message.includes('Invalid login')) {
                    code = ErrorCode.AUTH_INVALID
                    message = 'メールアドレスまたはパスワードが正しくありません'
                } else if (authError.message.includes('too many requests')) {
                    code = ErrorCode.RATE_LIMIT_EXCEEDED
                    message = 'ログイン試行回数が多すぎます'
                    suggestions = ['しばらく経ってからもう一度お試しください']
                }

                throw new AuthError(message, code, undefined, authError, suggestions, authError)
            }

            // コールバックURL（リダイレクト先）の取得
            const callbackUrl = searchParams.get('callbackUrl') || '/home'

            // 成功メッセージ
            toast.success('ログインに成功しました', {
                description: 'ホーム画面に移動します',
            })

            // リダイレクト
            router.push(callbackUrl)
        } catch (err) {
            // 標準化されたエラーハンドリング
            handleError(err, {
                showToast: true,
                rethrow: false,
                toastOptions: {
                    title: 'ログインに失敗しました',
                }
            })

            // フォームのエラーメッセージを設定
            setError(
                err instanceof AuthError
                    ? err.userMessage
                    : 'ログインに失敗しました。メールアドレスとパスワードを確認してください。'
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
            </div>
            {error && (
                <div className="text-sm text-red-500">
                    {error}
                </div>
            )}
            <Button
                type="submit"
                className="w-full bg-pink-600 hover:bg-pink-700"
                disabled={loading}
            >
                {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
            <div className="text-center text-sm">
                <a href="/auth/register" className="text-pink-600 hover:text-pink-700">
                    新規登録はこちら
                </a>
            </div>
        </form>
    )
}