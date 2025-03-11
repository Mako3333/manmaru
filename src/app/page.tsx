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
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-green-100 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-green-700">manmaru</h1>
              <span className="ml-2 inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">ベータ版</span>
            </div>

            <nav className="hidden md:flex items-center space-x-6">
              <a
                href="#features"
                className="text-sm font-medium text-zinc-600 hover:text-green-700"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                特徴
              </a>
              <a
                href="#how-it-works"
                className="text-sm font-medium text-zinc-600 hover:text-green-700"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                使い方
              </a>
              <a
                href="#app-demo"
                className="text-sm font-medium text-zinc-600 hover:text-green-700"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('app-demo')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                機能デモ
              </a>
            </nav>

            <div className="flex items-center space-x-2">
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
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="relative py-16 md:py-20 bg-green-50">
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="flex-1 text-left">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                <span className="text-zinc-800">忙しいママの味方、</span><br />
                <span className="text-green-700">栄養管理をもっと手軽に</span>
              </h2>
              <p className="text-base text-zinc-600 mb-8 max-w-lg">
                写真を撮るだけでAIが栄養バランスをサポートする栄養管理Webアプリです。<br />
                <span className="text-green-600 font-bold">あなたと赤ちゃんをまんまる笑顔に!</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full"
                  onClick={() => router.push('/terms')}
                >
                  今すぐ始める（無料）
                </Button>
                <Button
                  variant="outline"
                  className="border-green-200 text-green-700 hover:bg-green-50 px-6 py-3 rounded-full"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  詳しく見る
                </Button>
              </div>
              <div className="flex items-center space-x-1 mt-6">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">
                  4.8（ユーザー評価 287件）
                </p>
              </div>
            </div>
            <div className="flex-1 max-w-md">
              <div className="relative w-full max-w-[320px] mx-auto">
                <Image
                  src="/images/home_image.png"
                  alt="manmaruアプリのホーム画面"
                  width={320}
                  height={640}
                  priority
                  className="w-full h-auto rounded-2xl shadow-lg"
                />
                <div className="absolute -right-2 -bottom-2 bg-white px-3 py-2 rounded-lg shadow-md text-xs font-medium text-green-700 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                  オンライン・manmaru
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 妊婦さんの栄養管理をもっと簡単に */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-zinc-800 mb-3">
            妊婦さんの栄養管理を<span className="text-green-700">もっと簡単に</span>
          </h2>
          <p className="text-center text-zinc-600 mb-12 max-w-2xl mx-auto">
            忙しい日々の中でも、あなたと赤ちゃんの健康をしっかりサポート
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gray-50 rounded-xl p-5 relative">
              <div className="flex items-start mb-4">
                <div className="bg-green-100 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-700" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-zinc-800">
                    毎日でマクロ栄養素計算は大変
                  </h3>
                  <p className="text-zinc-600 mt-2">
                    食事ごとにカロリーやタンパク質を計算する手間を省き、写真を撮るだけで自動分析します。面倒な栄養計算から解放されます。
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 relative">
              <div className="flex items-start mb-4">
                <div className="bg-green-100 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-700" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-zinc-800">
                    妊娠週数に合わせた栄養アドバイス
                  </h3>
                  <p className="text-zinc-600 mt-2">
                    妊娠週数にあわせて変化する必要栄養素を自動計算。赤ちゃんの成長段階に合わせた最適な栄養バランスを提案します。
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 relative">
              <div className="flex items-start mb-4">
                <div className="bg-green-100 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-700" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-zinc-800">
                    AIが写真から食品を認識
                  </h3>
                  <p className="text-zinc-600 mt-2">
                    最新のAI技術で食事写真から食材を自動認識。入力の手間を大幅に削減しながら、高精度な栄養計算を実現します。
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 relative">
              <div className="flex items-start mb-4">
                <div className="bg-green-100 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-700" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-zinc-800">
                    忙しくても10秒で記録完了
                  </h3>
                  <p className="text-zinc-600 mt-2">
                    仕事や家事で忙しい日々でも続けられる、超シンプルな記録方法。写真を撮るだけで、栄養管理が完了します。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* こんな経験、ありませんか？ */}
      <section className="py-16 bg-green-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-zinc-800 mb-3">
            こんな経験、<span className="text-green-700">ありませんか？</span>
          </h2>
          <p className="text-center text-zinc-600 mb-12 max-w-2xl mx-auto">
            多くの妊婦さんが感じる「栄養管理の難しさ」に共感します
          </p>

          <div className="grid grid-cols-1 gap-8 max-w-3xl mx-auto">
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="mb-3 flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-medium mr-3">
                  1
                </div>
                <h3 className="font-semibold text-zinc-800">
                  「妊娠中の栄養バランスは？」と聞かれて困った
                </h3>
              </div>
              <p className="text-zinc-600 ml-11">
                産婦人科の検診や家族との会話で、具体的に答えられなくて焦った経験はありませんか？
                manmaruなら栄養状態を可視化し、自信を持って答えられます。
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="mb-3 flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-medium mr-3">
                  2
                </div>
                <h3 className="font-semibold text-zinc-800">
                  食事記録が続かなくて挫折した
                </h3>
              </div>
              <p className="text-zinc-600 ml-11">
                栄養素を手入力する面倒さから、以前使っていたアプリは長続きしませんでした。
                manmaruなら写真を撮るだけで自動計算するので、忙しい日々でも継続できます。
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="mb-3 flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-medium mr-3">
                  3
                </div>
                <h3 className="font-semibold text-zinc-800">
                  「鉄分や葉酸が足りている？」と不安になった
                </h3>
              </div>
              <p className="text-zinc-600 ml-11">
                妊娠に必要な栄養素がきちんと摂れているか心配になることはありませんか？
                manmaruなら妊娠週数に応じた必要栄養素を自動計算し、あなたの栄養状態をリアルタイムで確認できます。
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="mb-3 flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-medium mr-3">
                  4
                </div>
                <h3 className="font-semibold text-zinc-800">
                  夕食の献立を考えるのが毎日大変
                </h3>
              </div>
              <p className="text-zinc-600 ml-11">
                「今日は何を作ろう...」と毎日の献立決めに悩んでいませんか？
                manmaruなら不足している栄養素を補うレシピを自動提案。献立作りの悩みを解消します。
              </p>
            </div>
          </div>

          <div className="text-center mt-10">
            <Button
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              manmaruで解決する
            </Button>
          </div>
        </div>
      </section>

      {/* 簡単に使えるmanmaru */}
      <section id="features" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-zinc-800 mb-3">
            簡単に使える <span className="text-green-700">manmaru</span>
          </h2>
          <p className="text-center text-zinc-600 mb-12 max-w-2xl mx-auto">
            面倒な操作なし！写真を撮るだけで栄養管理が完了します
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  1
                </div>
                <div className="hidden md:block absolute top-7 left-full w-16 h-px bg-green-200"></div>
              </div>
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                写真を撮るだけ
              </h3>
              <p className="text-sm text-zinc-600">
                食事の写真を撮るだけで栄養素を自動分析します
              </p>
            </div>

            <div className="text-center">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  2
                </div>
                <div className="hidden md:block absolute top-7 left-full w-16 h-px bg-green-200"></div>
              </div>
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                AIが栄養素を分析
              </h3>
              <p className="text-sm text-zinc-600">
                AIが食事内容を識別し、栄養成分を自動計算します
              </p>
            </div>

            <div className="text-center">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  3
                </div>
                <div className="hidden md:block absolute top-7 left-full w-16 h-px bg-green-200"></div>
              </div>
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                栄養バランスを確認
              </h3>
              <p className="text-sm text-zinc-600">
                妊娠週数に応じた栄養素の充足率をグラフで確認
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                不足栄養素の対策
              </h3>
              <p className="text-sm text-zinc-600">
                不足している栄養素を補うレシピを自動提案します
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Button
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full"
              onClick={() => router.push('/terms')}
            >
              今すぐ始める（無料）
            </Button>
          </div>
        </div>
      </section>

      {/* 使い方セクション */}
      <section id="how-it-works" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-green-800 mb-4">
            たった3ステップで栄養管理
          </h2>
          <p className="text-center text-zinc-600 mb-12 max-w-2xl mx-auto">
            忙しい妊婦さんでも続けられるシンプル設計
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* ステップ1 */}
            <div className="bg-white border border-green-100 rounded-xl p-6 shadow-md relative">
              <div className="relative">
                <div className="absolute top-0 right-0 w-16 h-16 flex items-center justify-center rounded-full bg-green-600 text-white text-2xl font-bold">
                  1
                </div>
                <div className="rounded-lg overflow-hidden shadow-md mb-6">
                  <div className="aspect-[4/3] bg-green-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">写真を撮るだけ</h3>
              <p className="text-zinc-600">食事をカメラで撮影するだけ。AIが自動で食材を認識し栄養素を計算します。</p>
              <div className="mt-4 flex items-center">
                <div className="bg-green-50 rounded-full w-8 h-8 flex items-center justify-center mr-2">
                  <span className="text-green-700 font-bold">⏱</span>
                </div>
                <span className="text-sm text-zinc-600">所要時間: 約10秒</span>
              </div>
            </div>

            {/* ステップ2 */}
            <div className="bg-white border border-green-100 rounded-xl p-6 shadow-md relative md:mt-6">
              <div className="hidden md:block absolute -left-12 top-1/2 transform -translate-y-1/2 w-8">
                <svg className="w-8 h-8 text-green-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.293 7.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L15.586 12l-2.293-2.293a1 1 0 010-1.414z"></path>
                </svg>
              </div>
              <div className="relative">
                <div className="absolute top-0 right-0 w-16 h-16 flex items-center justify-center rounded-full bg-green-600 text-white text-2xl font-bold">
                  2
                </div>
                <div className="rounded-lg overflow-hidden shadow-md mb-6">
                  <div className="aspect-[4/3] bg-green-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">栄養バランスを確認</h3>
              <p className="text-zinc-600">妊娠週数に合わせた必要栄養素と現在の達成率をグラフで一目確認できます。</p>
              <div className="mt-4 flex items-center">
                <div className="bg-green-50 rounded-full w-8 h-8 flex items-center justify-center mr-2">
                  <span className="text-green-700 font-bold">✓</span>
                </div>
                <span className="text-sm text-zinc-600">主要5栄養素を自動算出</span>
              </div>
            </div>

            {/* ステップ3 */}
            <div className="bg-white border border-green-100 rounded-xl p-6 shadow-md relative md:mt-12">
              <div className="hidden md:block absolute -left-12 top-1/2 transform -translate-y-1/2 w-8">
                <svg className="w-8 h-8 text-green-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.293 7.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L15.586 12l-2.293-2.293a1 1 0 010-1.414z"></path>
                </svg>
              </div>
              <div className="relative">
                <div className="absolute top-0 right-0 w-16 h-16 flex items-center justify-center rounded-full bg-green-600 text-white text-2xl font-bold">
                  3
                </div>
                <div className="rounded-lg overflow-hidden shadow-md mb-6">
                  <div className="aspect-[4/3] bg-green-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">レシピ提案を活用</h3>
              <p className="text-zinc-600">不足している栄養素に合わせたレシピを自動提案。家族の分も一緒に計算できます。</p>
              <div className="mt-4 flex items-center">
                <div className="bg-green-50 rounded-full w-8 h-8 flex items-center justify-center mr-2">
                  <span className="text-green-700 font-bold">👨‍👩‍👧</span>
                </div>
                <span className="text-sm text-zinc-600">家族の人数も調整可能</span>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-zinc-600 mb-6">
              すべての機能が<span className="font-bold">無料</span>でご利用いただけます
            </p>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl"
              onClick={() => document.getElementById('app-demo')?.scrollIntoView({ behavior: 'smooth' })}
            >
              機能を詳しく見る ↓
            </Button>
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

      {/* ユーザーの声 */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-zinc-800 mb-3">
            ユーザー<span className="text-green-700">の声</span>
          </h2>
          <p className="text-center text-zinc-600 mb-12 max-w-2xl mx-auto">
            実際に使っている妊婦さんたちの感想をご紹介します
          </p>

          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold mr-4">
                  M
                </div>
                <div>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <h3 className="font-semibold text-zinc-800">まきさん / 32歳 / 会社員 / 妊娠6ヶ月</h3>
                </div>
              </div>
              <p className="text-zinc-600">
                産婦人科で「鉄分が足りていないかも」と言われて不安になっていましたが、このアプリで日々の栄養バランスを管理できるようになり安心しました。写真を撮るだけという手軽さが続けられる理由です。仕事で忙しくても続けられています！
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold mr-4">
                  Y
                </div>
                <div>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <h3 className="font-semibold text-zinc-800">ようこさん / 28歳 / 主婦 / 妊娠8ヶ月</h3>
                </div>
              </div>
              <p className="text-zinc-600">
                義母に「栄養管理はどうしてるの？」と聞かれた時、このアプリを見せたら「すごく良いものを使ってるのね！」と褒められました。レシピ提案機能も便利で、夕食の献立に悩まなくなりました。葉酸や鉄分が不足すると教えてくれるので安心です。
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold mr-4">
                  S
                </div>
                <div>
                  <div className="flex">
                    {[...Array(4)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-zinc-800">さとみさん / 34歳 / フリーランス / 妊娠5ヶ月</h3>
                </div>
              </div>
              <p className="text-zinc-600">
                写真認識の精度がもう少し上がるといいなと思いますが、それでも他のアプリより断然使いやすいです。特に不足栄養素を基にしたレシピ提案は本当に助かります。赤ちゃんの成長が毎週確認できるのも楽しみの一つになっています。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 今すぐ無料で始める */}
      <section className="py-16 bg-green-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-800 mb-3">
              今すぐ<span className="text-green-700">無料で</span>始める
            </h2>
            <p className="text-zinc-600 mb-6 max-w-2xl mx-auto">
              妊娠期間の栄養管理をもっと簡単に。写真を撮るだけで栄養バランスを自動計算します。
            </p>

            <div className="bg-white rounded-xl p-8 shadow-sm">
              <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-6">
                <div className="w-full md:w-2/3 text-left">
                  <h3 className="text-xl font-semibold text-zinc-800 mb-2">
                    manmaruの特徴
                  </h3>
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="ml-2 text-zinc-700">写真撮影だけで栄養素を自動計算</span>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="ml-2 text-zinc-700">妊娠週数に合わせた栄養素推奨値</span>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="ml-2 text-zinc-700">不足栄養素を補うレシピ提案</span>
                    </li>
                  </ul>
                  <div className="mt-4">
                    <p className="text-sm text-zinc-500">※ インストール不要のWebアプリです</p>
                  </div>
                </div>

                <div className="w-full md:w-1/3">
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white w-full px-6 py-4 text-lg rounded-full shadow-lg"
                    onClick={() => router.push('/terms')}
                  >
                    今すぐ始める（無料）
                  </Button>
                  <p className="text-xs text-zinc-500 mt-2">
                    登録は30秒で完了します
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-sm text-zinc-600">
                    <span className="font-medium">プライバシー保護</span> - 医療関連の個人データは厳重に保護されます
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* よくある質問 */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-zinc-800 mb-3">
            よくある<span className="text-green-700">質問</span>
          </h2>
          <p className="text-center text-zinc-600 mb-12 max-w-2xl mx-auto">
            manmaruについてよく寄せられる質問をまとめました
          </p>

          <div className="max-w-3xl mx-auto">
            {/* FAQ アコーディオン */}
            <div className="space-y-4">
              <div className="border border-green-100 rounded-lg overflow-hidden">
                <details className="group">
                  <summary className="flex items-center justify-between p-4 bg-white cursor-pointer">
                    <h3 className="text-lg font-medium text-zinc-800">manmaruは無料で使えますか？</h3>
                    <span className="ml-4 flex-shrink-0 p-1.5 rounded-full bg-green-50">
                      <svg className="w-5 h-5 text-green-700 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </summary>
                  <div className="p-4 pt-0 border-t border-green-50">
                    <p className="text-zinc-600">
                      はい、すべての機能を無料でご利用いただけます。会員登録のみで、写真からの栄養分析、栄養管理、レシピ提案などすべての機能が使えます。将来的に有料プランの提供も検討していますが、基本機能は常に無料でご利用いただけます。
                    </p>
                  </div>
                </details>
              </div>

              <div className="border border-green-100 rounded-lg overflow-hidden">
                <details className="group">
                  <summary className="flex items-center justify-between p-4 bg-white cursor-pointer">
                    <h3 className="text-lg font-medium text-zinc-800">写真から本当に正確な栄養素が計算できるの？</h3>
                    <span className="ml-4 flex-shrink-0 p-1.5 rounded-full bg-green-50">
                      <svg className="w-5 h-5 text-green-700 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </summary>
                  <div className="p-4 pt-0 border-t border-green-50">
                    <p className="text-zinc-600">
                      最新のAI技術を活用して食品を認識し、おおよその栄養素を計算しています。完璧な精度ではありませんが、日々の栄養管理の目安として十分な精度を提供しています。AI認識後に食材リストを編集することも可能なので、より正確な記録も可能です。栄養分析の精度は定期的なアップデートで向上していきます。
                    </p>
                  </div>
                </details>
              </div>

              <div className="border border-green-100 rounded-lg overflow-hidden">
                <details className="group">
                  <summary className="flex items-center justify-between p-4 bg-white cursor-pointer">
                    <h3 className="text-lg font-medium text-zinc-800">スマートフォンアプリはありますか？</h3>
                    <span className="ml-4 flex-shrink-0 p-1.5 rounded-full bg-green-50">
                      <svg className="w-5 h-5 text-green-700 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </summary>
                  <div className="p-4 pt-0 border-t border-green-50">
                    <p className="text-zinc-600">
                      現在はWebアプリのみのご提供となります。ただし、スマートフォンのブラウザから簡単にアクセスでき、ホーム画面に追加すればアプリのように使えます。将来的にiOSとAndroid向けのネイティブアプリの開発も計画していますが、すべての機能はWebアプリでもご利用いただけます。
                    </p>
                  </div>
                </details>
              </div>

              <div className="border border-green-100 rounded-lg overflow-hidden">
                <details className="group">
                  <summary className="flex items-center justify-between p-4 bg-white cursor-pointer">
                    <h3 className="text-lg font-medium text-zinc-800">個人情報の取り扱いは安全ですか？</h3>
                    <span className="ml-4 flex-shrink-0 p-1.5 rounded-full bg-green-50">
                      <svg className="w-5 h-5 text-green-700 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </summary>
                  <div className="p-4 pt-0 border-t border-green-50">
                    <p className="text-zinc-600">
                      はい、manmaruはプライバシーを最優先しています。食事の写真や妊娠に関する情報は厳格なセキュリティ対策の下で管理され、第三者に提供されることはありません。データはすべて暗号化されて保存され、プライバシーポリシーに基づいて厳重に管理されています。詳細はプライバシーポリシーをご覧ください。
                    </p>
                  </div>
                </details>
              </div>

              <div className="border border-green-100 rounded-lg overflow-hidden">
                <details className="group">
                  <summary className="flex items-center justify-between p-4 bg-white cursor-pointer">
                    <h3 className="text-lg font-medium text-zinc-800">妊娠中以外でも使えますか？</h3>
                    <span className="ml-4 flex-shrink-0 p-1.5 rounded-full bg-green-50">
                      <svg className="w-5 h-5 text-green-700 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </summary>
                  <div className="p-4 pt-0 border-t border-green-50">
                    <p className="text-zinc-600">
                      はい、妊娠前の方や産後の方も利用可能です。妊活中の方向けの栄養管理モードや、産後の授乳期に必要な栄養素計算機能も提供しています。ただし、推奨される栄養素の内容や量は妊娠中とは異なります。将来的には家族全員の栄養管理が可能な機能も追加予定です。
                    </p>
                  </div>
                </details>
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="text-zinc-600 mb-4">
                他にご質問がある場合はお気軽にお問い合わせください
              </p>
              <Button
                variant="outline"
                className="border-green-200 text-green-700 hover:bg-green-50"
                onClick={() => router.push('/contact')}
              >
                お問い合わせ
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="bg-green-50 pt-12 pb-6 border-t border-green-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <h3 className="text-xl font-bold text-green-700">manmaru</h3>
                <span className="ml-2 inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">ベータ版</span>
              </div>
              <p className="text-sm text-zinc-600 mb-4">
                妊婦さんの栄養管理をAIで簡単に。写真一枚で始められる新しい健康管理のカタチです。
              </p>
              <div className="flex space-x-4">
                <a href="https://twitter.com/manmaru_app" className="text-zinc-500 hover:text-green-700" aria-label="Twitter">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path>
                  </svg>
                </a>
                <a href="https://www.instagram.com/manmaru_app" className="text-zinc-500 hover:text-green-700" aria-label="Instagram">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.014 4.85.072 4.358.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.274-.115-5.912-3.295-9.494zM5.839 10.5c0 .428-.339.773-.756.773a.76.76 0 01-.756-.773v-3.61c0-.427.339-.773.756-.773.417 0 .756.346.756.773v3.61zm14.161 11.137c-2.7 3.037-7.033 3.282-8 3.282-.967 0-5.3-.245-8-3.282-2.336-2.627-2.91-6.361-2.91-8.137 0-1.776.574-5.51 2.91-8.137 2.7-3.036 7.033-3.282 8-3.282.967 0 5.3.246 8 3.282 2.336 2.627 2.91 6.361 2.91 8.137 0 1.776-.574 5.51-2.91 8.137z" />
                  </svg>
                </a>
                <a href="https://line.me/R/ti/p/@manmaru" className="text-zinc-500 hover:text-green-700" aria-label="LINE">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.365 9.89c.50 0 .866-.328.866-.744 0-.416-.386-.744-.866-.744H17.13v1.488h2.235zm-5.068 0h1.009c.466 0 .866-.328.866-.744 0-.416-.4-.744-.866-.744h-2.87c-.466 0-.866.328-.866.744v4.744c0 .416.4.744.866.744h2.87c.466 0 .866-.328.866-.744 0-.416-.4-.744-.866-.744h-1.009v-.782h.658c.466 0 .866-.328.866-.744 0-.416-.4-.744-.866-.744h-.658v-.73zm-3.36-1.488h-2.87c-.466 0-.866.328-.866.744v4.744c0 .416.4.744.866.744.466 0 .866-.328.866-.744v-1.16h2.004c.466 0 .866-.328.866-.744 0-.416-.4-.744-.866-.744zm9.768-5.755c-3.18-3.582-8.333-3.846-9.705-3.846-1.372 0-6.525.264-9.705 3.846-3.18 3.582-3.295 8.22-3.295 9.494 0 1.274.115 5.913 3.295 9.494 3.18 3.582 8.333 3.846 9.705 3.846 1.372 0 6.525-.264 9.705-3.846 3.18-3.582 3.295-8.22 3.295-9.494 0-1.274-.115-5.912-3.295-9.494zM5.839 10.5c0 .428-.339.773-.756.773a.76.76 0 01-.756-.773v-3.61c0-.427.339-.773.756-.773.417 0 .756.346.756.773v3.61zm14.161 11.137c-2.7 3.037-7.033 3.282-8 3.282-.967 0-5.3-.245-8-3.282-2.336-2.627-2.91-6.361-2.91-8.137 0-1.776.574-5.51 2.91-8.137 2.7-3.036 7.033-3.282 8-3.282.967 0 5.3.246 8 3.282 2.336 2.627 2.91 6.361 2.91 8.137 0 1.776-.574 5.51-2.91 8.137z" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-zinc-800 uppercase mb-4">サイトマップ</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="text-zinc-600 hover:text-green-700">特徴</a>
                </li>
                <li>
                  <a href="#how-it-works" className="text-zinc-600 hover:text-green-700">使い方</a>
                </li>
                <li>
                  <a href="#app-demo" className="text-zinc-600 hover:text-green-700">機能デモ</a>
                </li>
                <li>
                  <a href="/blog" className="text-zinc-600 hover:text-green-700">ブログ</a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-zinc-800 uppercase mb-4">サポート</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/terms" className="text-zinc-600 hover:text-green-700">利用規約</a>
                </li>
                <li>
                  <a href="/privacy" className="text-zinc-600 hover:text-green-700">プライバシーポリシー</a>
                </li>
                <li>
                  <a href="/contact" className="text-zinc-600 hover:text-green-700">お問い合わせ</a>
                </li>
                <li>
                  <a href="/faq" className="text-zinc-600 hover:text-green-700">よくある質問</a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-zinc-800 uppercase mb-4">お知らせ</h4>
              <p className="text-sm text-zinc-600 mb-4">
                最新情報やお得な情報をメールでお届けします
              </p>
              <div className="flex">
                <input
                  type="email"
                  placeholder="メールアドレス"
                  className="flex-1 px-3 py-2 text-sm border border-green-200 rounded-l-md focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-sm rounded-r-md">
                  登録
                </button>
              </div>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-xs text-zinc-500 mb-4 md:mb-0">
                &copy; {new Date().getFullYear()} manmaru All rights reserved.
              </p>
              <div className="flex space-x-4">
                <a href="/terms" className="text-xs text-zinc-500 hover:text-green-700">利用規約</a>
                <a href="/privacy" className="text-xs text-zinc-500 hover:text-green-700">プライバシーポリシー</a>
                <a href="/contact" className="text-xs text-zinc-500 hover:text-green-700">お問い合わせ</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
