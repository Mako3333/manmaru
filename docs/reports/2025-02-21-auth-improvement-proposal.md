# 認証フローの改善提案

## 1. 課題の概要と解決策

### 1-1. 二重メール認証の解消

#### 現状の問題
- 新規登録後に再度ログインが必要
- メール認証が複数回要求される
- UXの低下

#### 提案する解決策
1. **Magic Link認証への一本化**
```typescript
// app/auth/register/page.tsx
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const supabase = createClientComponentClient()
  const router = useRouter()

  const handleRegister = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: {
          registration_flow: true  // 新規登録フラグ
        }
      }
    })

    if (error) {
      console.error('Registration error:', error)
      // エラー表示
      return
    }

    // 送信完了メッセージ表示
  }
}
```

2. **コールバックページでの適切なハンドリング**
```typescript
// app/auth/callback/page.tsx
'use client'

import { useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/auth/login')
        return
      }

      try {
        // プロフィール確認
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (!profile) {
          // 新規ユーザーの場合
          router.push('/profile')
        } else {
          // 既存ユーザーの場合
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('Profile check error:', error)
        router.push('/profile')
      }
    }

    handleCallback()
  }, [])

  return <div>認証中...</div>
}
```

### 1-2. プロフィール取得エラーの改善

#### 現状の問題
- 新規ユーザーのプロフィール取得でエラー
- エラーハンドリングが不適切
- UXの低下

#### 提案する解決策
1. **プロフィール取得のユーティリティ関数**
```typescript
// lib/utils/profile.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/database.types'

export async function getProfile(userId: string) {
  const supabase = createClientComponentClient<Database>()

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // データが見つからない場合は null を返す
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Profile fetch error:', error)
    return null
  }
}
```

2. **エラー表示コンポーネント**
```typescript
// components/ui/error-toast.tsx
'use client'

import { useToast } from './use-toast'

export function showError(message: string) {
  const { toast } = useToast()

  toast({
    variant: 'destructive',
    title: 'エラーが発生しました',
    description: message,
  })
}
```

### 1-3. ログイン済みユーザーのリダイレクト改善

#### 現状の問題
- ログイン済みユーザーが不要なページに遷移
- セッション管理が不適切
- 冗長な認証プロセス

#### 提案する解決策
1. **ミドルウェアの最適化**
```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // パスの取得
  const path = req.nextUrl.pathname

  // 認証済みユーザーの処理
  if (session) {
    // 認証不要ページへのアクセスをチェック
    if (
      path === '/' ||
      path === '/auth/login' ||
      path === '/auth/register' ||
      path === '/terms'
    ) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        return NextResponse.redirect(
          new URL(profile ? '/dashboard' : '/profile', req.url)
        )
      } catch (error) {
        console.error('Profile check error:', error)
        return NextResponse.redirect(new URL('/profile', req.url))
      }
    }
  }

  // 未認証ユーザーの保護されたルートへのアクセスをチェック
  if (!session) {
    if (
      path.startsWith('/dashboard') ||
      path.startsWith('/profile') ||
      path.startsWith('/meals')
    ) {
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
```

2. **クライアントサイドの認証状態管理**
```typescript
// hooks/useAuth.ts
'use client'

import { useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        router.refresh()
      }
      if (event === 'SIGNED_OUT') {
        router.push('/auth/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return supabase.auth
}
```

## 2. 実装手順

1. **Magic Link認証の統一**
   - 新規登録とログインで同じ`signInWithOtp`を使用
   - ユーザーメタデータで新規登録フラグを管理

2. **プロフィール管理の改善**
   - プロフィール取得のユーティリティ関数を実装
   - エラーハンドリングの強化
   - 適切なフォールバック処理

3. **リダイレクト制御の最適化**
   - ミドルウェアでのセッション確認
   - プロフィール状態に応じた遷移制御
   - クライアントサイドの認証状態監視

## 3. 技術的な注意点

### 3-1. セッション管理
- サーバーサイドとクライアントサイドで一貫したセッション管理
- Supabaseの`onAuthStateChange`を適切に利用
- セッショントークンの自動更新への対応

### 3-2. エラーハンドリング
- ネットワークエラーへの対応
- プロフィール未作成状態の適切な処理
- ユーザーへの分かりやすいエラー表示

### 3-3. パフォーマンス
- 不要なリダイレクトの最小化
- プロフィール情報のキャッシュ
- 認証状態の効率的な監視

## 4. 今後の改善点

1. **オフライン対応**
   - セッション情報のローカルストレージ活用
   - オフライン時のフォールバックUI

2. **UX向上**
   - ローディング状態の表示
   - スムーズなページ遷移
   - エラーメッセージの改善

3. **セキュリティ強化**
   - CSRF対策の徹底
   - セッショントークンの適切な管理
   - アクセス制御の細分化