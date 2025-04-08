
◤◢◤◢◤◢◤◢◤◢◤◢
# インシデント報告：ホーム画面 おすすめレシピ表示不具合

## 1. インシデント概要

**発生事象:**
ホーム画面の「おすすめレシピ」セクションにおいて、ユーザーにレシピが表示されず、フロントエンドのコンソールに `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON` というエラーが表示されました。

**技術的影響:**
APIエンドポイント `/api/recommendations/home-recipes` が正常なJSONレスポンスを返さず、ステータスコード 500 (Internal Server Error) と共にHTML形式のエラーページを返していました。これにより、フロントエンドでのデータ取得と表示が失敗していました。

## 2. 発生日時

[報告日時 2025/04/08] ごろ発覚、調査・修正を実施。
(もし正確な発生開始日時が分かれば追記してください)

## 3. 影響範囲

*   **機能:** ホーム画面における「おすすめレシピ」表示機能全体。
*   **ユーザー影響:** すべてのログインユーザーが、自身のクリップに基づいたおすすめレシピを見ることができない状態でした。

## 4. 調査プロセス（時系列）

1.  **初期調査 (フロントエンド):**
    *   ブラウザコンソールの `SyntaxError` から、APIがJSONではなくHTMLを返していることを確認。
    *   ネットワークタブで `/api/recommendations/home-recipes` へのリクエストが 500 エラーとなり、レスポンスボディがHTML（エラーページ）であることを確認。
2.  **初期仮説 (バックエンド - APIハンドラー内部):**
    *   APIハンドラー (`src/app/api/recommendations/home-recipes/route.ts` の `GET` 関数) 内のデータ処理ロジックに問題がある可能性を疑う。
    *   具体的には、Supabaseから取得したデータ（特に `clipped_recipes` の `ingredients` や `nutrition_per_serving` JSONBカラム）のパースエラー、`recentlyUsedIds` の作成ロジックエラー、レシピ選択の分岐ロジックのエッジケース、`shuffleArray` 関数の不具合などを想定。
3.  **デバッグログ追加とサーバーログ確認:**
    *   APIハンドラー内の各処理ステップ（DBアクセス、IDセット作成、分岐処理）に詳細な `console.log` を追加。
    *   しかし、これらのログが出力される前にエラーが発生していることが、Next.js開発サーバーのターミナルログから判明。
    *   ターミナルログで **`Error: Failed to load chunk server/chunks/[root of the server]__...js`** および **`[cause]: SyntaxError: Unexpected token '<'`** を発見。これは、APIハンドラーのコード自体、またはその依存関係のJavaScriptチャンクファイルをサーバーが読み込もうとして失敗していることを示唆。
4.  **原因切り分け（コードの段階的復元）:**
    *   APIルートのコードを最小限（固定JSONを返すのみ）に置き換え → **エラー解消**。問題がAPIルート内の特定のコードにあることを確認。
    *   `next/headers` の `cookies()` を追加 → 問題なし。
    *   `@supabase/ssr` の `createServerClient` を追加 → 問題なし。
    *   `supabase.auth.getSession()` を追加 → 問題なし。
    *   `supabase.from('clipped_recipes')...` を追加 → 問題なし。
    *   `supabase.from('meal_recipe_entries')...` と `recentlyUsedIds` 作成を追加 → 問題なし。
    *   **レコメンドロジック（`if/else if/else` 分岐）と `shuffleArray` 関数の呼び出しを元に戻した段階で、「Failed to load chunk」エラーが再発。**
5.  **Turbopack互換性の調査:**
    *   サーバーサイド専用機能 (`@supabase/ssr`, `next/headers`) と複雑なレコメンドロジックの組み合わせが、開発サーバーのTurbopack環境で問題を起こしている可能性を疑う。
    *   `package.json` の `dev` スクリプトから `--turbopack` フラグを削除し、`next.config.ts` で `dev: { turbopack: false }` を設定して**Turbopackを無効化**。
6.  **Webpackでの新たなエラー:**
    *   Turbopack無効化後、Webpack環境でビルド時に新たなエラー **`SyntaxError: Not a pattern`** が発生。エラー箇所は `shuffleArray` 関数内の配列要素入れ替えを行う分割代入 `[a, b] = [b, a]` の部分。
7.  **構文修正:**
    *   `shuffleArray` 関数内の要素入れ替えを、一時変数を使う古典的な方法に修正。
8.  **最終確認:**
    *   Webpack環境でビルドエラー、ランタイムエラー共に解消し、おすすめレシピが正常に表示されることを確認。

## 5. 根本原因

1.  **主原因: Turbopack との互換性問題**
    *   Next.js開発サーバーでTurbopackが有効な場合に、APIルート (`route.ts`) 内でサーバーサイド専用のSupabaseクライアント (`@supabase/ssr`) 機能と、やや複雑な条件分岐および配列操作（`filter`, `slice`, `shuffleArray`呼び出し等）を含むレコメンドロジックが組み合わさったコードを処理する際に、TurbopackがサーバーサイドのJavaScriptチャンクファイルを正しく読み込めず、「Failed to load chunk」エラーを引き起こしていた。
2.  **副次的原因: Webpack での構文解釈の問題**
    *   Turbopack無効化後に使用されたWebpackが、`shuffleArray` 関数内で使用されていたnon-null assertion (`!`) を含む分割代入による配列要素入れ替え構文 `[newArray[i]!, newArray[j]!] = [newArray[j]!, newArray[i]!]` を正しく解釈できず、「Not a pattern」という構文エラーを引き起こしていた。

## 6. 実施した対応

*   **Turbopackの無効化:**
    *   `package.json` の `scripts.dev` から `--turbopack` フラグを削除。
    *   `next.config.ts` に `dev: { turbopack: false }` を追加。
*   **コード修正:**
    *   `src/app/api/recommendations/home-recipes/route.ts` 内の `shuffleArray` 関数の要素入れ替えロジックを、一時変数を使用する方式に変更。
*   **クリーンアップ:**
    *   デバッグ用に挿入した `console.log` ステートメントを削除（エラーハンドリング用の `console.error` は保持）。

## 7. 再発防止策 / 今後の推奨事項

*   **Turbopackの利用について:**
    *   現時点では、開発環境において **Turbopackを無効 (`dev: { turbopack: false }`) にした状態を維持する**ことを推奨します。
    *   将来的にNext.jsおよびTurbopackのバージョンアップで安定性が向上した場合に、再度有効化を検討します。
*   **APIルートの実装について:**
    *   APIルート内でサーバーサイド専用ライブラリ（`@supabase/ssr` など）と複雑な同期/非同期処理、条件分岐、ループ、配列操作などが混在する場合、Turbopackなどのビルドツールとの互換性問題が発生するリスクがあります。
    *   可能な範囲で、APIルートのロジックはシンプルに保つことを検討します（例：複雑な処理は別の関数やモジュールに分離する、Server Components側で一部処理を行うなど）。
*   **構文の互換性:**
    *   比較的新しいJavaScript/TypeScript構文（特にビルドツールによる解釈が必要なものや、`!` のようなTypeScript特有の記法）を使用する際は、ターゲット環境やビルドツール（Webpack, Turbopack, Babelなど）での互換性に注意が必要です。問題が発生した場合は、より広くサポートされている代替構文への書き換えを検討します。
*   **段階的な開発とテスト:**
    *   機能追加やライブラリ更新を行う際は、小さなステップで進め、各ステップで動作確認（特に開発サーバーと本番ビルドの両方）を行うことが、問題の早期発見と切り分けに繋がります。

