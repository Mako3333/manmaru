'use client'

import React from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function DisclaimerPage() {
  const router = useRouter()

  const handleAgree = () => {
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
      <Card className="w-full max-w-md shadow-lg border-green-100">
        <CardHeader>
          <h1 className="text-3xl font-bold text-center text-green-700">manmaru</h1>
          <p className="text-sm text-center text-muted-foreground mt-2">
            妊婦さんのための栄養管理アプリ
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-sm space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <h2 className="font-semibold text-green-800 mb-2">
                ご利用にあたって
              </h2>
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
        </CardContent>

        <CardFooter>
          <Button
            onClick={handleAgree}
            className="w-full bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            同意して始める
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 