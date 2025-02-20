// src/components/auth/login-form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'

export function LoginForm() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) throw error

            router.push('/dashboard')
        } catch (err) {
            setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。')
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