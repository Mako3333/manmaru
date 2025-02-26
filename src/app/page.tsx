'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LandingPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>('record')

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-green-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-green-100 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-700">manmaru</h1>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="border-green-200 text-green-700 hover:bg-green-50"
              onClick={() => router.push('/auth/login')}
            >
              ログイン
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => router.push('/terms')}
            >
              新規登録
            </Button>
          </div>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-green-100 rounded-full opacity-20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-100 rounded-full opacity-20 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-bold text-green-800 leading-tight mb-4">
                あなたと赤ちゃんの健康を<br />
                <span className="text-green-600">まんまる笑顔に</span>
              </h2>
              <p className="text-lg text-zinc-700 mb-8 max-w-lg">
                忙しい毎日でも、写真を撮るだけで栄養管理。
                妊娠期に必要な栄養素をAIがサポートします。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg h-auto"
                  onClick={() => router.push('/terms')}
                >
                  今すぐ始める
                </Button>
                <Button
                  variant="outline"
                  className="border-green-200 text-green-700 hover:bg-green-50 px-8 py-6 text-lg h-auto"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  詳しく見る
                </Button>
              </div>
            </div>
            <div className="flex-1 max-w-md">
              <div className="relative w-full max-w-[300px] mx-auto">
                <Image
                  src="/images/home_image.png"
                  alt="manmaruアプリのホーム画面"
                  width={300}
                  height={600}
                  priority
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section id="features" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-green-800 mb-12">
            manmaruの特徴
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* 特徴1: AIで簡単記録 */}
            <div className="bg-green-50 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">AIで簡単記録</h3>
              <p className="text-zinc-600">写真を撮るだけで食事内容を認識。面倒な手入力は不要です。</p>
            </div>

            {/* 特徴2: 栄養バランス管理 */}
            <div className="bg-green-50 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">栄養バランス管理</h3>
              <p className="text-zinc-600">妊娠週数に応じた栄養管理。足りない栄養素を一目で確認できます。</p>
            </div>

            {/* 特徴3: レシピ提案 */}
            <div className="bg-green-50 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">レシピ提案</h3>
              <p className="text-zinc-600">不足している栄養素を補えるレシピを自動で提案します。</p>
            </div>

            {/* 特徴4: 赤ちゃんの成長記録 */}
            <div className="bg-green-50 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">成長記録</h3>
              <p className="text-zinc-600">週数に応じた赤ちゃんの成長を可視化。出産までをサポートします。</p>
            </div>
          </div>
        </div>
      </section>

      {/* 使い方セクション */}
      <section className="py-16 bg-green-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-green-800 mb-4">
            簡単3ステップ
          </h2>
          <p className="text-center text-zinc-600 mb-12 max-w-2xl mx-auto">
            まんまるは忙しい妊婦さんの栄養管理をシンプルにします
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* ステップ1 */}
            <div className="text-center">
              <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-green-100 text-green-800 text-2xl font-bold mx-auto mb-4">
                1
                <div className="absolute -right-4 top-1/2 transform -translate-y-1/2 hidden md:block">
                  <svg className="w-8 h-8 text-green-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13.293 7.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L15.586 12l-2.293-2.293a1 1 0 010-1.414z"></path>
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">食事の写真を撮影</h3>
              <p className="text-zinc-600">アプリで食事の写真を撮るだけ。入力の手間はありません。</p>
            </div>

            {/* ステップ2 */}
            <div className="text-center">
              <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-green-100 text-green-800 text-2xl font-bold mx-auto mb-4">
                2
                <div className="absolute -right-4 top-1/2 transform -translate-y-1/2 hidden md:block">
                  <svg className="w-8 h-8 text-green-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13.293 7.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L15.586 12l-2.293-2.293a1 1 0 010-1.414z"></path>
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">AIが栄養を分析</h3>
              <p className="text-zinc-600">カロリー、タンパク質、鉄分など自動で計算します。</p>
            </div>

            {/* ステップ3 */}
            <div className="text-center">
              <div className="w-20 h-20 flex items-center justify-center rounded-full bg-green-100 text-green-800 text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">レシピ提案を確認</h3>
              <p className="text-zinc-600">不足栄養素を補うレシピが自動で提案されます。</p>
            </div>
          </div>
        </div>
      </section>

      {/* デモ/機能説明タブ */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-green-800 mb-12">
            アプリの機能
          </h2>

          {/* タブヘッダー */}
          <div className="flex overflow-x-auto mb-6 border-b border-green-100 max-w-2xl mx-auto">
            <button
              className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${activeTab === 'record' ? 'text-green-700 border-b-2 border-green-500' : 'text-zinc-500'}`}
              onClick={() => setActiveTab('record')}
            >
              食事記録
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${activeTab === 'nutrition' ? 'text-green-700 border-b-2 border-green-500' : 'text-zinc-500'}`}
              onClick={() => setActiveTab('nutrition')}
            >
              栄養管理
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${activeTab === 'recipes' ? 'text-green-700 border-b-2 border-green-500' : 'text-zinc-500'}`}
              onClick={() => setActiveTab('recipes')}
            >
              レシピ提案
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${activeTab === 'growth' ? 'text-green-700 border-b-2 border-green-500' : 'text-zinc-500'}`}
              onClick={() => setActiveTab('growth')}
            >
              成長記録
            </button>
          </div>

          {/* タブコンテンツ */}
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8 items-center">
            <div className="md:w-1/2">
              <div className="aspect-[9/16] w-full max-w-[250px] mx-auto rounded-[2rem] border-8 border-zinc-800 shadow-xl overflow-hidden">
              </div>
            </div>

            <div className="md:w-1/2">
              {activeTab === 'record' && (
                <div>
                  <h3 className="text-2xl font-semibold text-green-700 mb-4">簡単食事記録</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>写真を撮るだけでAIが食材を認識</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>食材リストの編集も簡単</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>過去の記録もカレンダーで確認可能</span>
                    </li>
                  </ul>
                </div>
              )}

              {activeTab === 'nutrition' && (
                <div>
                  <h3 className="text-2xl font-semibold text-green-700 mb-4">スマートな栄養管理</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>妊娠週数に応じた必要栄養素の表示</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>カロリー、タンパク質、鉄分などの達成率</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>わかりやすいグラフで傾向を確認</span>
                    </li>
                  </ul>
                </div>
              )}

              {activeTab === 'recipes' && (
                <div>
                  <h3 className="text-2xl font-semibold text-green-700 mb-4">パーソナライズドレシピ</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>不足栄養素に基づいたレシピ提案</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>簡単に作れる家庭料理中心</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>好みや苦手な食材を設定可能</span>
                    </li>
                  </ul>
                </div>
              )}

              {activeTab === 'growth' && (
                <div>
                  <h3 className="text-2xl font-semibold text-green-700 mb-4">赤ちゃんの成長記録</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>週数に応じた赤ちゃんの大きさを表示</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>発育状況に関する情報提供</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>出産までのカウントダウン</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA セクション */}
      <section className="py-20 bg-gradient-to-r from-green-50 to-green-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-6">
            あなたの健やかな妊娠生活を始めましょう
          </h2>
          <p className="text-lg text-zinc-600 mb-8 max-w-2xl mx-auto">
            manmaruは栄養管理をもっとシンプルに。
            赤ちゃんとあなたの健康を第一に考えたアプリです。
          </p>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg h-auto"
            onClick={() => router.push('/terms')}
          >
            無料で始める
          </Button>
          <p className="text-sm text-zinc-500 mt-4">
            ※ 本アプリは医療行為の代替とはなりません
          </p>
        </div>
      </section>

      {/* フッター */}
      <footer className="bg-white py-8 border-t border-green-100">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h2 className="text-xl font-bold text-green-700">manmaru</h2>
              <p className="text-sm text-zinc-500">妊婦さんの栄養バランスケアアプリ</p>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href="#" className="text-sm text-zinc-600 hover:text-green-700">利用規約</a>
              <a href="#" className="text-sm text-zinc-600 hover:text-green-700">プライバシーポリシー</a>
              <a href="#" className="text-sm text-zinc-600 hover:text-green-700">お問い合わせ</a>
            </div>
          </div>
          <div className="text-center text-xs text-zinc-400 mt-8">
            &copy; {new Date().getFullYear()} manmaru All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}