# Supabase Auth Helpers から SSR への移行ガイド

このドキュメントは、`@supabase/auth-helpers-nextjs` パッケージから `@supabase/ssr` パッケージへの移行手順を説明します。`@supabase/ssr` は Next.js App Router との互換性が高く、よりシンプルな API を提供します。

## 移行の目的

-   Next.js App Router (Server Components, Client Components, Route Handlers) との完全な互換性を確保する。
-   認証ヘルパーの API を簡素化し、コードの可読性を向上させる。
-   将来的な Supabase のアップデートに対応しやすくする。

## 主要な変更点

| 旧ヘルパー (`@supabase/auth-helpers-nextjs`) | 新ヘルパー (`@supabase/ssr`)     | 使用箇所                                     |
| :--------------------------------------- | :------------------------------- | :------------------------------------------- |
| `createClientComponentClient`            | `createBrowserClient`            | Client Components (`'use client'`)           |
| `createServerComponentClient`            | `createServerClient`             | Server Components (RSC)                      |
| `createRouteHandlerClient`               | `createServerClient`             | API Route Handlers (`src/app/api/...`) |

## 移行手順

### 1. `@supabase/ssr` パッケージのインストール

まず、新しいパッケージをプロジェクトに追加します。

```bash
npm install @supabase/ssr
```

### 2. 環境変数の確認

以下の環境変数が `.env.local` または同等のファイルに設定されていることを確認します。

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 3. Client Components (`'use client'`) の修正

Client Components 内で Supabase クライアントを初期化している箇所を探します。

**変更前:**

```typescript
// src/components/some-client-component.tsx
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// ...

const supabase = createClientComponentClient();
```

**変更後:**

```typescript
// src/components/some-client-component.tsx
import { createBrowserClient } from '@supabase/ssr';

// ...

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

-   `createClientComponentClient` を `createBrowserClient` に置き換えます。
-   `createBrowserClient` には、Supabase の URL と Anon Key を明示的に渡します。

### 4. Server Components (RSC) の修正

Server Components 内で Supabase クライアントを使用している箇所を探します。

**変更前:**

```typescript
// src/app/some-server-component/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// ...

export default async function Page() {
  const cookieStore = cookies(); // 同期的に取得
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  const { data: { user } } = await supabase.auth.getUser();
  // ...
}
```

**変更後:**

```typescript
// src/app/some-server-component/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr'; // CookieOptionsをインポート

// ...

export default async function Page() {
  const cookieStore = cookies(); // 同期的に取得

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Server Componentsは読み取り専用なので set/remove は不要
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  // ...
}
```

-   `createServerComponentClient` を `createServerClient` に置き換えます。
-   `createServerClient` には、URL、Anon Key、および `cookies` オブジェクトを渡します。
-   `cookies` オブジェクト内では `get` メソッドのみを実装します。Server Components は通常、Cookie の書き込みを行わないため、`set` と `remove` は不要です。
-   `cookies()` の呼び出しは同期的ですが、`createServerClient` は非同期処理を内部で扱います。

### 5. API Route Handlers (`src/app/api/.../route.ts`) の修正

API Route Handlers 内で Supabase クライアントを使用している箇所を探します。

**変更前:**

```typescript
// src/app/api/some-route/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const cookieStore = cookies(); // 同期的に取得
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // ... API ロジック ...

  return NextResponse.json({ message: 'Success' });
}
```

**変更後:**

```typescript
// src/app/api/some-route/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr'; // CookieOptionsをインポート
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const cookieStore = cookies(); // 同期的に取得

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );

  // ... API ロジック ...
  // 例: セッション更新など、Cookie の書き込みが発生する可能性がある
  const { data: { session } } = await supabase.auth.getSession();

  return NextResponse.json({ message: 'Success' });
}
```

-   `createRouteHandlerClient` を `createServerClient` に置き換えます。
-   `createServerClient` には、URL、Anon Key、および `cookies` オブジェクトを渡します。
-   `cookies` オブジェクト内では `get`、`set`、`remove` メソッドを実装します。API Route Handler はセッションの更新などで Cookie の書き込みを行う可能性があるため、全ての実装が必要です。
-   `next/headers` から `cookies` をインポートし、同期的に使用します。`createServerClient` が内部で非同期処理を扱います。

### 6. Middleware (`src/middleware.ts`) の修正

Middleware は `NextResponse` を介して Cookie を操作する必要があるため、特別な処理が必要です。

**変更前:**

```typescript
// src/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession(); // セッションをリフレッシュ
  return res;
}
```

**変更後:**

```typescript
// src/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // setメソッド内で response.cookies.set を呼ぶ
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // removeメソッド内で response.cookies.delete を呼ぶ
          response.cookies.delete({ name, ...options });
        },
      },
    }
  );

  // セッションをリフレッシュ（これにより set/remove が呼び出される可能性がある）
  await supabase.auth.getUser();

  // 更新されたCookieを含むレスポンスを返す
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

-   `createMiddlewareClient` を `createServerClient` に置き換えます。
-   `createServerClient` の `cookies` オプション内で、`get` は `request.cookies` から、`set`/`remove` は `response.cookies` を使用して操作します。
-   `supabase.auth.getUser()` (または `getSession()`) を呼び出してセッションをリフレッシュし、Cookie の更新をトリガーします。
-   最後に、更新された可能性のある Cookie を含む `response` オブジェクトを返します。

### 7. 不要なパッケージのアンインストール

全ての箇所で `@supabase/ssr` への移行が完了したら、古いパッケージをアンインストールします。

```bash
npm uninstall @supabase/auth-helpers-nextjs
```

### 8. 確認

プロジェクト全体で `grep` などを使用し、`@supabase/auth-helpers-nextjs` のインポートが残っていないか確認します。開発サーバーを再起動し、認証関連の機能が正しく動作するかテストします。
