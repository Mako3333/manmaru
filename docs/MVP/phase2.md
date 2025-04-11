## MVP計画 フェーズ2: コア機能実装と修正 (分割タスク指示書)

**全体目標:** MVPスコープの主要機能（食事記録、栄養ダッシュボード、設定編集、基本レシピ提案）を実装・修正し、一通り動作する安定した状態にする。フェーズ1での基盤改善（型定義、エラー処理、DB形式）を反映させる。

**共通の注意点:**

*   **ブランチ:** 各タスクごとにフィーチャーブランチを作成してください。
*   **コミット:** 意味のある単位でこまめにコミットしてください。
*   **テスト:** 修正後は関連するテストを実行してください（Jest設定問題が解決次第）。手動での動作確認も必ず行ってください。
*   **ビルド確認:** 修正後に `npm run build` を実行し、ビルドエラーがないことを確認してください。
*   **プルリクエスト:** 各タスク完了後、`develop` ブランチに対してプルリクエストを作成し、コードレビューを受けてください。
*   **ドキュメント参照:** 関連するガイドラインやフェーズ1の成果物を適宜参照してください。
*   **型:** アプリケーション内部では原則として `StandardizedMealNutrition` を使用してください。

---

### タスク 2.1: 食事記録フロー (写真入力) の安定化

*   **目的:** 写真アップロードから栄養計算結果表示、DB保存までの一連の流れを、フェーズ1の変更（`StandardizedMealNutrition`、新DB形式）に対応させ、安定動作させる。
*   **担当範囲:**
    *   `src/app/(authenticated)/meals/log/page.tsx` (写真入力関連のロジック、`handlePhotoCapture`, `analyzePhoto`, `handleSaveRecognition`)
    *   `src/components/meals/EnhancedRecognitionEditor.tsx` (データ表示・編集)
    *   `src/lib/api.ts` (`analyzeMealPhoto` 関数 - 呼び出し側)
    *   `src/app/api/v2/image/analyze/route.ts` (APIハンドラー - 応答形式確認)
    *   `src/app/api/meals/route.ts` (POSTハンドラー - 保存処理確認)
    *   `src/lib/services/meal-service.ts` (`saveMealWithNutrition` - 呼び出し確認)
    *   `src/lib/nutrition/nutrition-type-utils.ts` (`convertToDbNutritionFormat` - 呼び出し確認)
*   **詳細指示:**
    1.  **データフロー確認:** `meals/log/page.tsx` で写真が選択された後、`handlePhotoCapture` -> `analyzePhoto` が呼び出され、`/api/v2/image/analyze` API がコールされることを確認する。
    2.  **API応答処理:** `/api/v2/image/analyze` から返される `StandardizedMealNutrition` 形式のデータを `meals/log/page.tsx` で受け取り、`EnhancedRecognitionEditor` に正しく渡せることを確認・修正する。
    3.  **UI表示・編集:** `EnhancedRecognitionEditor` が `StandardizedMealNutrition` データを受け取り、食品リストや栄養サマリーを正しく表示・編集できることを確認・修正する。
    4.  **保存処理:** `EnhancedRecognitionEditor` で保存ボタンが押された際、`handleSaveRecognition` が呼び出され、編集後の `StandardizedMealNutrition` データが `/api/meals` (POST) に送信されることを確認する。
    5.  **API保存:** `/api/meals` (POST) ハンドラーが `StandardizedMealNutrition` データを受け取り、`convertToDbNutritionFormat` を使用してDB保存形式に変換し、`MealService.saveMealWithNutrition` を経由して `meals` テーブルの `nutrition_data` (JSONB) に正しく保存されることを確認・修正する (`meal_nutrients` には書き込まない)。
    6.  **エラーハンドリング:** 各ステップ（API呼び出し、データ変換、保存）でエラーが発生した場合、ユーザーに適切なフィードバックが表示されることを確認する。
*   **完了条件:** 写真をアップロードし、認識結果を（必要なら編集して）保存すると、`meals` テーブルに `StandardizedMealNutrition` に準拠したデータが保存されること。一連のフローでエラーが発生しないこと。

---

### タスク 2.2: 食事記録フロー (テキスト入力) の安定化

*   **目的:** テキスト入力から栄養計算結果表示、DB保存までの一連の流れを、フェーズ1の変更に対応させ、安定動作させる。
*   **担当範囲:**
    *   `src/app/(authenticated)/meals/log/page.tsx` (テキスト入力関連のロジック、`handleSaveTextInput`)
    *   `src/lib/api.ts` (`analyzeTextInput` 関数 - 呼び出し側)
    *   `src/app/api/v2/meal/text-analyze/route.ts` (APIハンドラー - 応答形式確認)
    *   `src/app/api/meals/route.ts` (POSTハンドラー - 保存処理確認)
    *   `src/lib/services/meal-service.ts` (`saveMealWithNutrition` - 呼び出し確認)
    *   `src/lib/nutrition/nutrition-type-utils.ts` (`convertToDbNutritionFormat` - 呼び出し確認)
*   **詳細指示:**
    1.  **データフロー確認:** `meals/log/page.tsx` でテキスト入力し、食品リストを編集後、保存ボタンを押すと `handleSaveTextInput` が呼び出されることを確認する。
    2.  **API呼び出し:** `handleSaveTextInput` 内で `/api/v2/meal/text-analyze` API が呼び出され、テキストから `StandardizedMealNutrition` データが返却されることを確認・修正する。
    3.  **保存処理:** `handleSaveTextInput` 内で、取得した `StandardizedMealNutrition` データが `/api/meals` (POST) に送信されることを確認する。
    4.  **API保存:** `/api/meals` (POST) ハンドラーが `StandardizedMealNutrition` データを受け取り、`convertToDbNutritionFormat` を使用してDB保存形式に変換し、`MealService.saveMealWithNutrition` を経由して `meals` テーブルの `nutrition_data` (JSONB) に正しく保存されることを確認・修正する。
    5.  **エラーハンドリング:** 各ステップでエラーが発生した場合、ユーザーに適切なフィードバックが表示されることを確認する。
*   **完了条件:** テキストで食事を入力・編集し、保存すると、`meals` テーブルに `StandardizedMealNutrition` に準拠したデータが保存されること。一連のフローでエラーが発生しないこと。

---

### タスク 2.3: 栄養管理ダッシュボード基本表示の実装・修正

*   **目的:** ダッシュボードページで、指定された日付の栄養摂取状況（主要栄養素の達成率、栄養スコア）を `StandardizedMealNutrition` ベースで正しく表示する。
*   **担当範囲:**
    *   `src/app/(authenticated)/dashboard/page.tsx`
    *   `src/components/dashboard/NutritionSummary.tsx` (または `src/components/home/nutrition-summary.tsx` - HomeClientから分離・再利用検討)
    *   `src/components/dashboard/NutritionChart.tsx`
    *   `src/lib/fetchers/home-fetchers.ts` (`progressFetcher` - 戻り値確認)
    *   `src/lib/nutrition/nutrition-display-utils.ts` (`calculateNutritionScore` など)
    *   `nutrition_goal_prog` ビュー (参照するデータソース確認)
*   **詳細指示:**
    1.  **データ取得:** `dashboard/page.tsx` で `progressFetcher` を使用し、`nutrition_goal_prog` ビューから指定日の栄養進捗データを取得するロジックを確認する。ビューが `meals.nutrition_data` (JSONB) を参照するように修正されていることを前提とする。
    2.  **データ変換:** 取得したデータ (ビューの形式) を `StandardizedMealNutrition` 形式に変換するロジックを実装または確認する（`nutrition-type-utils.ts` の関数を利用）。
    3.  **スコア計算:** `calculateNutritionScore` 関数に変換後の `StandardizedMealNutrition` と目標値 (`targets`) を渡し、栄養スコアを計算する。
    4.  **UIコンポーネント修正:**
        *   `NutritionSummary` コンポーネントが `StandardizedMealNutrition` を Props として受け取り、主要栄養素の達成率などを正しく表示できるように修正する。
        *   `NutritionChart` コンポーネントが `StandardizedMealNutrition` データ（または整形されたデータ）を受け取り、グラフを正しく描画できるように修正する。
    5.  **表示確認:** ダッシュボードページで、日付を変更した際にデータが再取得され、スコアやグラフが正しく更新されることを確認する。データがない日付の場合の表示も確認する。
*   **完了条件:** ダッシュボードページで、選択した日付の栄養スコアと主要栄養素の達成率が `StandardizedMealNutrition` データに基づいて正しく表示されること。

---

### タスク 2.4: 設定編集ページの実装

*   **目的:** ユーザーが自身のプロフィール情報（年齢、身長、体重、出産予定日など）を編集・保存できるページを作成する。
*   **担当範囲:**
    *   `src/app/(authenticated)/settings/page.tsx` (表示用)
    *   `src/app/(authenticated)/profile/page.tsx` (編集用 - 新規作成 or 既存修正)
    *   `src/app/api/profile/route.ts` (または `/api/settings/profile`) - APIエンドポイント (新規作成 or 既存修正)
    *   `src/lib/supabase/client.ts` (`getUserProfile`, `updateUserProfile` - 既存利用 or 新規作成)
    *   `src/types/user.ts` (`UserProfile`, `ProfileUpdateData`)
*   **詳細指示:**
    1.  **UI作成:** `/settings/edit` (または `/profile/edit`) ルートに、プロフィール編集フォームを持つページコンポーネントを作成する。既存の `/profile/page.tsx` を流用・修正しても良い。
        *   フォームには、年齢、身長、体重（妊娠前）、出産予定日、食事制限などの入力フィールドを含める。
        *   現在のプロフィール情報をフォームの初期値として表示する (`getUserProfile` を使用)。
    2.  **APIエンドポイント実装:**
        *   `/api/profile` (または `/api/settings/profile`) に `PATCH` または `PUT` メソッドハンドラーを実装する。
        *   リクエストボディから更新データを受け取り、入力値をバリデーションする。
        *   `updateUserProfile` (または直接 Supabase クライアント) を使用して `profiles` テーブルを更新する。
        *   認証ミドルウェア (`withAuthAndErrorHandling`) を適用する。
    3.  **フォーム送信処理:** 編集ページのフォームから、入力されたデータをAPIエンドポイントに送信し、プロフィールを更新するロジックを実装する。成功時・エラー時のフィードバック（トースト通知など）を表示する。
    4.  **設定ページ連携:** `/settings/page.tsx` から編集ページへのリンクを追加する。
*   **完了条件:** ユーザーが設定編集ページでプロフィール情報を変更し、保存できること。変更内容がDBに反映され、再度表示した際に更新されていること。

---

### タスク 2.5: 献立提案機能 (基本表示)

*   **目的:** ホーム画面などで、不足栄養素に基づいた基本的なレシピ提案を表示する。
*   **担当範囲:**
    *   `src/app/api/recommend-recipes/route.ts` (または `/api/recipes/recommend`) - APIエンドポイント
    *   `src/components/home/home-client.tsx` (提案表示箇所)
    *   `src/components/home/RecommendedRecipes.tsx` (表示コンポーネント)
    *   `src/lib/ai/prompts/templates/recipe-recommendation/v1.ts` (使用する場合)
*   **詳細指示:**
    1.  **API実装/修正:**
        *   `/api/recommend-recipes` エンドポイントを実装または修正する。
        *   リクエストからユーザーIDを受け取り、`nutrition_goal_prog` ビューなどから直近の不足栄養素を特定するロジックを実装する。
        *   **シンプルなロジック:** 不足栄養素を含むレシピを `clipped_recipes` テーブルから検索し、数件返す（例: 鉄分不足なら `ingredients` JSONBカラムに "レバー" や "ほうれん草" を含むレシピを検索）。
        *   **(オプション) AIロジック:** `PromptType.RECIPE_RECOMMENDATION` を使用してAIにレシピを提案させる。プロンプトを調整し、レシピIDやタイトル、画像URLなど、表示に必要な最低限の情報を返すようにする。
        *   APIはレシピの基本情報（ID, タイトル, 画像URLなど）のリストを返すようにする。
    2.  **UI実装:**
        *   `RecommendedRecipes` コンポーネントで、上記APIを呼び出し、取得したレシピ情報を表示する。
        *   各レシピは `RecipeCard` コンポーネント（または簡易版）を使用して表示し、クリックするとレシピ詳細ページ (`/recipes/[id]`) に遷移するようにする。
        *   ローディング状態やレシピがない場合の表示も考慮する。
*   **完了条件:** ホーム画面などで、不足栄養素に基づいて提案されたレシピ（最低限、タイトルと画像）が表示されること。

---

### タスク 2.6: AI連携部分の修正 (画像解析プロンプト)

*   **目的:** 画像解析プロンプトとパーサーの間の不整合を解消する。
*   **担当範囲:**
    *   `src/lib/ai/prompts/templates/food-analysis/v1.ts`
    *   `src/lib/ai/gemini-response-parser.ts`
    *   `src/app/api/v2/image/analyze/route.ts` (影響確認)
*   **詳細指示:**
    1.  **方針決定:** プロンプトから栄養素推定の要求を削除するか、パーサー (`GeminiResponseParser`) が栄養素情報を解析できるように修正するか、方針を決定する。**推奨は、プロンプトから栄養素推定要求を削除し、栄養計算は `NutritionService` に完全に任せる方針**です。これにより、AIの役割が食品特定に集中し、結果の安定性が向上する可能性があります。
    2.  **修正:**
        *   **(推奨方針の場合)** `food-analysis/v1.ts` のプロンプトテンプレートから `"nutrition": { ... }` の部分と、それに関する指示を削除する。
        *   **(パーサー修正方針の場合)** `gemini-response-parser.ts` の `parseResponse` メソッドを修正し、応答JSON内の `nutrition` オブジェクトを解析して `GeminiParseResult` の `nutrition` プロパティに格納するようにする。
    3.  **影響確認:** `/api/v2/image/analyze/route.ts` で、修正後のプロンプトまたはパーサーからの応答を正しく処理できているか確認する。特に、栄養データ (`aiEstimatedNutrition`) の取得方法が変わる可能性があるため注意する。
*   **完了条件:** 画像解析プロンプトとパーサーの間の不整合が解消され、`/api/v2/image/analyze` が意図通りに動作すること。

---

### タスク 2.7: AI連携部分の修正 (レシピURL解析)

*   **目的:** レシピURL解析の精度と安定性を向上させるため、専用パーサーを優先し、AIをフォールバックとして使用するハイブリッドアプローチを確立・改善する。
*   **担当範囲:**
    *   `src/app/api/v2/recipe/parse/route.ts`
    *   `src/lib/recipe-parsers/` (各パーサー、ファクトリ、インターフェース)
    *   `src/lib/ai/services/gemini-service.ts` (`parseRecipeFromUrl` - 呼び出し側)
    *   `src/lib/ai/prompts/templates/recipe-url-analysis/v1.ts` (AI用プロンプト)
*   **詳細指示:**
    1.  **処理フロー確認:** `/api/v2/recipe/parse/route.ts` の処理フローを確認する。
        *   HTML取得 → `getRecipeParser` でパーサー選択 → 専用パーサー実行 → 失敗 or 汎用パーサーならHTMLクリーンアップ → AI実行 (`aiService.parseRecipeFromUrl`) → 材料リスト取得 → 栄養計算、という流れになっているか確認する。
    2.  **専用パーサーの改善:**
        *   既存の専用パーサー (`cookpad.ts`, `delishkitchen.ts` など) が最新のサイト構造に対応しているか確認し、必要であればセレクタ等を修正する。
        *   エラーハンドリングを強化し、解析失敗時に明確なエラーまたは空の結果を返すようにする。
    3.  **HTMLクリーンアップ改善:** AIに渡す前のHTMLクリーンアップ処理 (`cheerio` を使用) を改善し、不要な要素（広告、ヘッダー、フッター、コメント欄など）をより効果的に除去し、レシピ本文（特に材料リスト）を抽出しやすくする。これによりAIの解析精度向上とトークン数削減を目指す。
    4.  **AIプロンプト調整:** `recipe-url-analysis/v1.ts` のプロンプトが、クリーンアップされたHTMLから材料名と量を正確に抽出するように最適化されているか確認・調整する。JSON形式の指示を明確にする。
    5.  **フォールバック連携:** 専用パーサーが失敗した場合に、スムーズにAI解析にフォールバックし、その結果を利用して処理が継続されることを確認する。解析ソース（`parser` or `ai`）をメタデータとして返すようにする。
*   **完了条件:** レシピURL解析において、対応サイトでは専用パーサーが優先的に使用され、未対応サイトや解析失敗時にはAIによる解析が行われ、材料リストが取得できること。HTMLクリーンアップ処理が改善されていること。
