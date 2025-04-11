## MVP計画 フェーズ1: 基盤安定化と型定義改善 (分割タスク指示書)

**全体目標:** アプリケーションの安定性を高め、コードの可読性・保守性を向上させ、MVPリリース後の開発をスムーズにするための基盤を整備する。

**共通の注意点:**

*   **ブランチ:** 各タスクごとにフィーチャーブランチを作成してください (例: `refactor/eliminate-any-types`, `refactor/review-type-assertions`)。
*   **コミット:** 意味のある単位でこまめにコミットし、コミットメッセージを明確に記述してください。
*   **テスト:** 修正後は必ず関連するテスト (`npm run test` または `yarn test`) を実行し、リグレッションがないことを確認してください。必要に応じてテストケースを追加・修正してください。
*   **ビルド確認:** 修正後に `npm run build` を実行し、ビルドエラーが発生しないことを確認してください。
*   **プルリクエスト:** 各タスク完了後、`develop` ブランチ (またはメインの開発ブランチ) に対してプルリクエストを作成し、コードレビューを受けてください。
*   **ドキュメント参照:** 作業中は関連するガイドライン (`lint_error.md`, `nutrition-type-standardization.md`, `ERROR_HANDLING.md`, `cookie.md`, `docs\database\schema.sql`) を適宜参照してください。

---

### タスク 1: `any` 型の排除と型定義の具体化

*   **目的:** コードベースから `any` 型を排除し、TypeScriptの型安全性を最大限に活用する。
*   **担当範囲:** コードベース全体。特に `src/lib/ai/ai-service.interface.ts` や、型推論が効かずに暗黙的に `any` となっている箇所。
*   **詳細指示:**
    1.  プロジェクト全体で `any` 型が明示的・暗黙的に使用されている箇所を特定する (`@typescript-eslint/no-explicit-any` ルールや `tsc --noImplicitAny` で検出)。
    2.  各 `any` 型について、本来意図されているデータ構造や型を特定する。
    3.  **修正:**
        *   可能な限り、具体的なインターフェース、型エイリアス、または組み込み型 (`string`, `number`, `boolean`, `Array<T>`, `Record<K, V>` など) に置き換える。
        *   型が実行時まで不明な場合や、外部APIの応答などで型保証が難しい場合は、`unknown` 型を使用する。
        *   `unknown` 型を使用した場合は、必ず利用箇所で適切な型ガード (`typeof`, `instanceof`, `in` 演算子、ユーザー定義型ガード `isXxx`) を行い、安全に型を絞り込んでから使用する。
    4.  修正後、`tsc --noEmit` および ESLint を実行し、新たな型エラーや `any` 型が残っていないことを確認する。
*   **完了条件:** コードベースから `any` 型が原則として排除され、具体的な型または `unknown` + 型ガードに置き換えられていること。ビルドおよびLintがエラーなく通ること。

---

### タスク 2: 型アサーション (`as`) のレビューと削減

*   **目的:** 不必要または危険な型アサーションを削減し、コードの型安全性を向上させる。
*   **担当範囲:** コードベース全体。特に `src/lib/api/api-adapter.ts`, `src/lib/ai/prompts/version-manager.ts`, `src/lib/validation/response-validators.ts` など、`as` キーワードで検索して見つかる箇所。
*   **詳細指示:**
    1.  `as` キーワードでコードベースを検索し、全ての型アサーションの使用箇所をリストアップする。
    2.  各箇所について、なぜ型アサーションが使用されているのか理由を分析する。
    3.  **代替手段の検討:**
        *   より厳密な型ガードで代替できないか？
        *   関数のシグネチャや変数の初期型定義を修正することで、アサーションが不要にならないか？
        *   `JSON.parse` の結果など、外部データの型保証には `zod` などのスキーマバリデーションライブラリの導入を検討する（導入自体はこのタスクの範囲外でも可）。
    4.  **修正:** 安全な代替手段が見つかった場合は、型アサーションを削除し、コードを書き換える。
    5.  **やむを得ない場合:** 代替手段がなく、開発者が型の安全性を100%確信できる場合に限り `as` の使用を許可する。その際は、**必ずアサーションの直前の行に、なぜ安全と言えるのか具体的な理由と根拠をコメントで明記**する (`// 型アサーション: 外部APIの仕様により string 型であることが保証されているため` など)。`as any` は絶対に使用しない。
*   **完了条件:** コードベース内の型アサーションがレビューされ、不要なものは削除、必要なものには理由がコメントされていること。ビルドおよびLintがエラーなく通ること。

---

### タスク 3: 型定義の配置整理とヘルパー関数移動

*   **目的:** 型定義の配置ルールを統一し、関連性の低いヘルパー関数を適切な場所に移動することで、コードの構造を改善する。
*   **担当範囲:** `src/types/`, `src/lib/nutrition/nutrition-type-utils.ts`
*   **詳細指示:**
    1.  `src/types/api-interfaces.ts` 内でローカル定義されている `NutritionReliability` と `RecognizedFood` を特定する。
    2.  これらの型が他の場所でも利用される共通の概念であるかを判断し、それぞれ `src/types/nutrition.ts` (または `food.ts` や `ai.ts`) に移動する。
    3.  元のファイル (`api-interfaces.ts`) および、移動した型を参照していた他のファイルで、インポートパスを修正する。
    4.  `src/types/nutrition.ts` 内に含まれているヘルパー関数 (`parseNutritionFromJson`, `serializeNutritionToJson`, `convertToNutrientDisplayData`) を特定する。
    5.  これらの関数を `src/lib/nutrition/nutrition-type-utils.ts` に移動する。
    6.  これらの関数をインポートしていた箇所で、インポートパスを修正する。
*   **完了条件:** `api-interfaces.ts` 内のローカル型定義が移動され、`src/types/nutrition.ts` からヘルパー関数が移動され、全ての参照箇所のインポートパスが修正されていること。ビルドおよびLintがエラーなく通ること。

---

### タスク 4: エラーハンドリングの統一

*   **目的:** アプリケーション全体で一貫したエラー処理を確立し、エラー発生時のデバッグとユーザーへのフィードバックを改善する。
*   **担当範囲:** コードベース全体（APIルート、サービス層、ユーティリティ関数など）。
*   **詳細指示:**
    1.  コード全体で `throw new Error(...)` やカスタムエラーが使用されている箇所を検索する。
    2.  これらの箇所を、`src/lib/error/` で定義されている `AppError` クラスと `ErrorCode` Enum を使用するように修正する。
        *   状況に最も適した `ErrorCode` を選択する。
        *   `message` (開発者向け) と `userMessage` (ユーザー向け) を適切に設定する。
        *   可能であれば `originalError` や `details` に関連情報を含める。
    3.  全てのAPIルートハンドラー (`src/app/api/.../route.ts`) が `withErrorHandling` または `withAuthAndErrorHandling` ミドルウェア (`src/lib/api/middleware.ts`) でラップされていることを確認する。ラップされていない場合は追加する。
    4.  `try...catch` ブロック内でエラーを捕捉している箇所を見直し、`error instanceof AppError` で型ガードを行い、`AppError` の情報（特に `userMessage`, `suggestions`）を活用するように修正する。一般的な `Error` を捕捉した場合は、適切な `AppError` に変換して再スローするか、`handleError` ユーティリティを使用する。
    5.  `src/lib/error/utils.ts` の `handleError` 関数を確認し、必要であれば `AppError` の情報をより活用できるように改善する（例: `suggestions` の表示など）。
*   **完了条件:** コードベース全体のエラー処理が `AppError` と `ErrorCode` に統一され、APIルートがエラーハンドリングミドルウェアで保護されていること。ビルドおよびLintがエラーなく通ること。

---

### タスク 5: Supabaseクライアント (`createServerClient`) の使用方法統一

*   **目的:** `@supabase/ssr` パッケージの `createServerClient` の使い方を、Next.js App Router の各コンテキスト（Server Components, Client Components, Route Handlers, Middleware）で統一し、認証関連の動作を安定させる。
*   **担当範囲:** `src/app/`, `src/components/`, `src/lib/supabase/client.ts`, `src/middleware.ts` など、Supabaseクライアントを使用している全ての箇所。
*   **詳細指示:**
    1.  `@supabase/auth-helpers-nextjs` のインポート (`createClientComponentClient`, `createServerComponentClient`, `createRouteHandlerClient`, `createMiddlewareClient`) が残っていないか確認し、残っていれば `@supabase/ssr` の `createBrowserClient` または `createServerClient` に置き換える。
    2.  `createServerClient` を使用している箇所（Server Components, Route Handlers, Middleware）で、`cookies` オプションの実装が `docs/guidelines/cookie.md` および `docs/supabase-ssr-migration.md` のガイドラインに準拠しているか確認・修正する。
        *   **Server Components:** `cookies` オプションでは `get` のみ実装（読み取り専用）。
        *   **Route Handlers (GETなど読み取り主体):** `cookies` オプションでは `get` のみ実装（読み取り専用）。
        *   **Route Handlers (POST/PATCH/DELETEなど書き込み可能性あり):** `cookies` オプションで `get`, `set`, `remove` を実装するが、`set`/`remove` 内で `cookieStore` (from `next/headers`) への書き込みは行わない（no-op または警告ログ）。実際のCookie操作は `NextResponse` で行う。**注意:** `docs/guidelines/cookie.md` では Route Handler の `set`/`remove` は no-op 推奨。
        *   **Middleware:** `cookies` オプション内で、`get` は `request.cookies` から、`set`/`remove` は `response.cookies` を使用して実装する。`supabase.auth.getUser()` または `getSession()` を呼び出してセッションをリフレッシュし、最後に `response` を返す。
    3.  `createBrowserClient` を使用している箇所（Client Components）で、URLとAnon Keyが正しく渡されているか確認する。
*   **完了条件:** Supabaseクライアントの初期化方法が `@supabase/ssr` に統一され、各コンテキストでの `cookies` オプションの実装がガイドラインに準拠していること。認証関連の動作に問題がないこと。

---

### タスク 6: DB JSONB構造標準化とデータ変換ロジック実装

*   **目的:** DBに保存されるJSONB形式の栄養データを `StandardizedMealNutrition` に準拠させ、データの一貫性を確保し、アプリケーション内部での型変換を容易にする。
*   **担当範囲:** `src/lib/nutrition/nutrition-type-utils.ts`, DBアクセス関連のサービス (`src/lib/services/meal-service.ts` など), データを読み書きするAPIルート。
*   **詳細指示:**
    1.  **方針確認:** `meals.nutrition_data`, `clipped_recipes.nutrition_per_serving`, `daily_nutrition_logs.nutrition_data` カラムに保存するJSON構造を、`StandardizedMealNutrition` の主要なプロパティ（`totalCalories`, `totalNutrients`, `foodItems`, `reliability` など）を含む形式に決定する。DBの制約やパフォーマンスも考慮する（例: `foodItems` のネストが深すぎる場合は一部フラット化するなど）。
    2.  **`convertToDbNutritionFormat` 修正:** `src/lib/nutrition/nutrition-type-utils.ts` の `convertToDbNutritionFormat` 関数を修正し、引数の `StandardizedMealNutrition` オブジェクトから、上記 1. で決定したDB保存用のJSON構造を生成するように実装する。
    3.  **DB読み込み時の変換ロジック実装:** DBからJSONBデータを読み込んだ際に、それを `StandardizedMealNutrition` オブジェクトに変換する関数を `nutrition-type-utils.ts` に実装する（例: `convertDbFormatToStandardizedNutrition`）。この関数は、上記 1. で決定したJSON構造をパースし、`StandardizedMealNutrition` の各プロパティにマッピングする。
    4.  **適用:**
        *   食事データ保存時 (`MealService.saveMealWithNutrition` など) に、`convertToDbNutritionFormat` を使用してJSONBデータを生成し、DBに保存するように修正する。
        *   食事データ取得時 (`MealService.getMealsByDate` など) に、DBから取得したJSONBデータを `convertDbFormatToStandardizedNutrition` (新設) を使用して `StandardizedMealNutrition` に変換してから返すように修正する。
        *   レシピクリップ保存時 (`/api/recipes/save` POST) や日次ログ保存時 (`saveDailyNutritionLog`) も同様に修正する。
*   **完了条件:** 対象となるJSONBカラムのデータ構造が標準化され、`convertToDbNutritionFormat` およびDB読み込み時の変換関数が実装・適用されていること。データの保存・取得が正しく行われること。

---

### タスク 7: `meal_nutrients` テーブル廃止と関連箇所の修正

*   **目的:** データの冗長性を排除し、データ管理を簡素化するため、`meal_nutrients` テーブルを廃止し、関連するコードを修正する。
*   **前提:** タスク6が完了し、`meals.nutrition_data` (JSONB) に信頼できる栄養データが格納されていること。
*   **担当範囲:** DBスキーマ、`src/lib/services/meal-service.ts`, `docs/database/schema.sql`, `docs/database/db.pu`, `src/app/api/meals/route.ts` (POST), `src/app/api/meals/summary/route.ts`, `src/app/api/meals/range/route.ts`, `nutrition_goal_prog` ビュー定義。
*   **詳細指示:**
    1.  **`meal_nutrients` への書き込み停止:** `MealService.saveMealWithNutrition` (または `/api/meals` POST ハンドラ) から、`meal_nutrients` テーブルへの `insert` 処理を削除する。
    2.  **トリガー削除:** `update_meal_nutrition_after_recipe_entry` トリガーをDBから削除するSQLを実行する (`DROP TRIGGER IF EXISTS update_meal_nutrition_after_recipe_entry ON public.meal_recipe_entries;`)。関連するトリガー関数 (`update_meal_nutrition_from_recipe`) も不要であれば削除する。
    3.  **`nutrition_goal_prog` ビュー修正:**
        *   ビュー定義を修正し、`meal_nutrients` テーブルへのJOINを削除する。
        *   代わりに `meals` テーブルの `nutrition_data` (JSONB) カラムから主要な栄養素の値（calories, protein, iron, folic_acid, calcium, vitamin_d）を抽出するようにロジックを変更する。JSONB内のパスを指定して値を取得するSQL関数（例: `->>`, `jsonb_extract_path_text`）を使用する。`COALESCE` や型キャスト (`::numeric`) も適切に使用する。
        *   `daily_nutrients` CTE (共通テーブル式) の集計ロジックを `meals.nutrition_data` ベースに変更する。
    4.  **関連API修正:** `/api/meals/summary/route.ts` や `/api/meals/range/route.ts` など、`meal_nutrients` を直接参照していたAPIがあれば、`meals.nutrition_data` を参照するように修正する。
    5.  **ドキュメント更新:** `schema.sql` および `db.pu` (ER図) から `meal_nutrients` テーブルと関連リレーションを削除する。
    6.  **(任意) テーブル削除:** 動作確認後、問題がなければ `meal_nutrients` テーブル自体をDBから削除する (`DROP TABLE IF EXISTS public.meal_nutrients;`)。
*   **完了条件:** `meal_nutrients` テーブルへの書き込みがなくなり、関連トリガーが削除され、`nutrition_goal_prog` ビューおよび関連APIが `meals.nutrition_data` を参照して正しく動作すること。ドキュメントが更新されていること。

