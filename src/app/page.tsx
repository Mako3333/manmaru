'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()

  return (
    <>
      <head>
        <title>manmaru</title>
      </head>
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-green-50 via-white to-green-50 overflow-hidden relative">
        {/* デコレーション要素 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-green-100 rounded-full opacity-20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-100 rounded-full opacity-20 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-md mx-auto text-center space-y-8">
          {/* ヘッダー部分 */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-green-700 tracking-tight">
              manmaru
            </h1>
            <p className="text-lg text-green-600 font-medium">
              AI搭載 妊婦さんの栄養バランスケアアプリ
            </p>
            <p className="text-zinc-600 italic">
              "あなたと赤ちゃんの健康を、まんまる笑顔に"
            </p>
          </div>

          {/* 主な機能の説明 */}
          <div className="grid grid-cols-2 gap-4 my-8">
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-green-100">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-3 bg-green-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-green-700 mb-1">AIで簡単記録</h3>
              <p className="text-xs text-zinc-600">写真を撮るだけで栄養を分析</p>
            </div>

            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-green-100">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-3 bg-green-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-green-700 mb-1">栄養バランス管理</h3>
              <p className="text-xs text-zinc-600">妊娠週数に応じたアドバイス</p>
            </div>
          </div>

          {/* ボタン群 */}
          <div className="space-y-4 w-full">
            <Button
              onClick={() => router.push('/auth/login')}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              ログイン
            </Button>
            <Button
              onClick={() => router.push('/terms')}
              variant="outline"
              className="w-full border-green-200 hover:bg-green-50"
            >
              新規登録
            </Button>
          </div>

          {/* フッター */}
          <p className="text-xs text-zinc-500 mt-8">
            ※ 本アプリは医療行為の代替とはなりません
          </p>
        </div>
      </div>
    </>
  )
}