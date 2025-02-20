'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function AuthCallbackPage() {
    const { handleAuthRedirect, isLoading, error } = useAuth()
    const [authSuccess, setAuthSuccess] = useState(false)

    useEffect(() => {
        let isMounted = true
        let redirectTimer: NodeJS.Timeout

        const handleAuth = async () => {
            try {
                await handleAuthRedirect()
                if (isMounted) {
                    setAuthSuccess(true)
                    // 成功メッセージを表示するため、リダイレクトを少し遅延させる
                    redirectTimer = setTimeout(() => {
                        // handleAuthRedirect 内で router.push が実行される
                        handleAuthRedirect()
                    }, 1500)
                }
            } catch (err) {
                console.error('認証コールバックエラー:', err)
            }
        }

        handleAuth()

        // クリーンアップ関数
        return () => {
            isMounted = false
            if (redirectTimer) {
                clearTimeout(redirectTimer)
            }
        }
    }, [handleAuthRedirect])

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
                <Card className="w-full max-w-md shadow-lg border-green-100">
                    <CardHeader>
                        <h1 className="text-2xl font-bold text-center text-red-600">認証エラー</h1>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="text-red-600 text-center">
                            <p className="text-sm mt-2">{error}</p>
                            <p className="text-sm mt-4 text-zinc-600">
                                もう一度ログインをお試しください。
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (authSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
                <Card className="w-full max-w-md shadow-lg border-green-100">
                    <CardHeader>
                        <h1 className="text-2xl font-bold text-center text-green-700">ログイン成功！</h1>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <svg
                                className="w-16 h-16 text-green-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <p className="text-zinc-600">リダイレクト中...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
            <Card className="w-full max-w-md shadow-lg border-green-100">
                <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="ml-3 text-zinc-600">認証を確認中...</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
} 