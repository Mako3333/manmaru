# ドキュメント: Next.js 15+ Route Handler での cookies() と Supabase SSR の連携ガイド

**対象:** Next.js v15 以降、App Router、Route Handler (`src/app/api/.../route.ts` など)、Supabase SSR (`@supabase/ssr`)

**目的:** Next.js 15 で変更された `cookies()` 関数の仕様と、Supabase SSR (`createServerClient`) を Route Handler で正しく連携させる方法を理解し、よくあるエラーを回避する。

## TL;DR (要約)

*   Next.js 15 から Route Handler 内の `cookies()` は **非同期** になり、`await cookies()` が必要。
*   `createServerClient` の `cookies` オプション:
    *   `get`: `await cookies()` で取得したストアを使い、**同期的に** 値を返す。
    *   `set`/`remove`: **空の関数 (no-op)** にする（読み取り専用ストアへの書き込みは不可）。
*   Route Handler 内で `NextResponse.next()` は **使用禁止** (500 エラーの原因)。

## 1. Next.js 15 での `cookies()` の変更点

Next.js 14 までは、Route Handler 内で `import { cookies } from 'next/headers';` を使って取得した `cookies()` は同期的に `ReadonlyRequestCookies` オブジェクトを返していました。

**Next.js 15 から:**
この `cookies()` 関数は**非同期関数**に変更され、`Promise<ReadonlyRequestCookies>` を返すようになりました。

**したがって、値を取得するには `await` が必須です。**

```typescript
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  // NG (Next.js 14以前の書き方): Promiseに対してgetを呼ぶことになりエラー
  // const cookieStore = cookies();
  // const token = cookieStore.get('token');

  // OK (Next.js 15以降): awaitでPromiseを解決してからアクセス
  const cookieStore = await cookies();
  const token = cookieStore.get('token');
  // ...
}
```

## 2. Supabase SSR (`createServerClient`) との連携パターン

`@supabase/ssr` の `createServerClient` は、サーバーサイドで認証状態などを管理するためにクッキーへのアクセス（読み取り、設定、削除）が必要です。Route Handler でこれを行う際の正しいパターンは以下の通りです。

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers'; // next/headers から cookies をインポート
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(_req: NextRequest) {
    try {
        // 1. await を使ってクッキーストアを取得 (Next.js 15+)
        const cookieStore = await cookies();

        // 2. createServerClient を初期化
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    // 3. get: 同期的に値を返す (関数自体は async にしない！)
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    // 4. set: no-op (空の関数)
                    set(name: string, value: string, options: CookieOptions) {
                        // Route Handler 内の cookieStore は読み取り専用のため、
                        // ここで cookieStore.set() を呼ぶことはできない。
                        // Supabase がクッキーを設定する必要がある場合、
                        // それは最終的な NextResponse のヘッダーで行われる。
                    },
                    // 5. remove: no-op (空の関数)
                    remove(name: string, options: CookieOptions) {
                        // set と同様の理由で no-op にする。
                    },
                },
            }
        );

        // これで supabase クライアントが使える
        const { data: { session } } = await supabase.auth.getSession();

        // ... (APIのロジック)

        return NextResponse.json({ message: 'Success', session });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

**重要なポイント:**

*   **`get` 関数は同期的:** `createServerClient` は `get` が同期的に値を返すことを期待しています。`get` 関数自体を `async` にしないでください。`await cookies()` は `createServerClient` の**外側**で行います。
*   **`set`/`remove` は no-op:** Route Handler 内の `cookies()` から得られるストアは読み取り専用です。`set` や `remove` で `cookieStore.set()` や `cookieStore.delete()` を呼び出すとエラーになります。型定義を満たすために空の関数を設定します。Supabase によるクッキーの変更は、最終的な `NextResponse` を介して行われます。

## 3. やってはいけないこと (エラーの原因)

*   **`NextResponse.next()` の使用:**
    ```typescript
    // NG: Route Handler 内での NextResponse.next() はサポートされておらず、500エラーになる
    // const response = NextResponse.next();
    // const supabase = createServerClient(..., {
    //   cookies: {
    //     set(name, value, options) { response.cookies.set(...) },
    //     remove(name, options) { response.cookies.delete(...) },
    //   }
    // });
    // return NextResponse.json(data, { headers: response.headers });
    ```
*   **`get` 関数内での `await`:**
    ```typescript
    // NG: get 関数は同期的である必要がある
    // cookies: {
    //   async get(name: string) {
    //     const store = await cookies(); // NG: get 関数内で await
    //     return store.get(name)?.value;
    //   }, ...
    // }
    ```
*   **`set`/`remove` での書き込み試行:**
    ```typescript
    // NG: cookieStore は読み取り専用なのでエラーになる
    // cookies: {
    //   set(name: string, value: string, options: CookieOptions) {
    //     const cookieStore = await cookies(); // これ自体も get 同様 async にできない
    //     cookieStore.set(name, value, options); // NG: Readonly ストアへの書き込み
    //   }, ...
    // }
    ```
*   **`await` なしの `cookies()` アクセス (Next.js 15+):**
    ```typescript
    // NG: Next.js 15以降では cookies() は Promise を返す
    // const cookieStore = cookies();
    // return cookieStore.get(name)?.value; // NG: Promise に .get はない
    ```

## まとめ

Next.js 15 の `cookies()` の非同期化は重要な変更点です。特に Supabase SSR のようなライブラリと連携する場合、`await` の適切な配置と、`createServerClient` の `cookies` オプション（特に `set`/`remove` の扱い）を正しく理解することが、エラーを回避し安定した動作を実現する鍵となります。
