'use client'

import React from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { setCookie } from 'cookies-next'

export default function TermsPage() {
    const router = useRouter()

    const handleAgree = () => {
        setCookie('terms_agreed', 'true', {
            maxAge: 60 * 60 * 24 * 365, // 1年間
            path: '/',
        })
        router.push('/auth/register')
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
            <Card className="w-full max-w-3xl shadow-lg border-green-100">
                <CardHeader>
                    <h1 className="text-3xl font-bold text-center text-green-700">利用規約・免責事項</h1>
                    <p className="text-sm text-center text-muted-foreground mt-2">
                        manmaruのご利用にあたって
                    </p>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* 免責事項セクション */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-green-800">免責事項</h2>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                            <ul className="space-y-2 text-zinc-700">
                                <li className="flex items-start">
                                    <span className="text-green-600 mr-2">•</span>
                                    本アプリは医療行為の代替とはなりません
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-600 mr-2">•</span>
                                    栄養管理に関する重要な判断は、必ず医師にご相談ください
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-600 mr-2">•</span>
                                    AI による食事解析は参考値であり、完全な正確性を保証するものではありません
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* 利用規約セクション */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-green-800">利用規約</h2>
                        <div className="p-4 bg-white rounded-lg border border-green-100">
                            <div className="space-y-4 text-zinc-700">
                                <section>
                                    <h3 className="font-medium text-green-700">1. サービスの目的</h3>
                                    <p className="mt-1 text-sm">
                                        manmaruは、妊婦の方々の健康的な食生活をサポートすることを目的としたアプリケーションです。
                                    </p>
                                </section>

                                <section>
                                    <h3 className="font-medium text-green-700">2. 利用条件</h3>
                                    <p className="mt-1 text-sm">
                                        本サービスは、妊娠中の方を対象としています。医療専門家の助言に代わるものではありません。
                                    </p>
                                </section>

                                <section>
                                    <h3 className="font-medium text-green-700">3. 個人情報の取り扱い</h3>
                                    <p className="mt-1 text-sm">
                                        ユーザーの個人情報は、適切に保護され、サービス提供の目的にのみ使用されます。
                                    </p>
                                </section>

                                <section>
                                    <h3 className="font-medium text-green-700">4. 禁止事項</h3>
                                    <p className="mt-1 text-sm">
                                        アプリの不正使用、データの改ざん、他のユーザーへの妨害行為などは禁止されています。
                                    </p>
                                </section>
                            </div>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col space-y-2">
                    <Button
                        onClick={handleAgree}
                        className="w-full bg-green-600 hover:bg-green-700 text-white transition-colors"
                    >
                        同意して始める
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                        同意をクリックすることで、上記の利用規約と免責事項に同意したものとみなされます
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}