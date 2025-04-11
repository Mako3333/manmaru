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

*   **目的:** ユーザーが自身のプロフィール情報（年齢、身長、体重、出産予定日など）を編集・保存できるページを作成する。`profile/edit/page.tsx`
*   **担当範囲:**
    *   `src/app/(authenticated)/profile/edit/page.tsx` (新規作成)
    *   `src/app/(authenticated)/profile/page.tsx` (このページを参考にする)
    *   `src/app/api/profile/route.ts` (または `/api/settings/profile`) - APIエンドポイント (新規作成 or 既存修正)
    *   `src/lib/supabase/client.ts` (`getUserProfile`, `updateUserProfile` - 既存利用 or 新規作成)
    *   `src/types/user.ts` (`UserProfile`, `ProfileUpdateData`)
*   **詳細指示:**
    1.  **UI作成:**  `/profile/edit`ルートに、プロフィール編集フォームを持つページコンポーネントを作成する。既存の `/profile/page.tsx` を流用・修正しても良い。
        *   フォームには、年齢、身長、体重（妊娠前）、出産予定日、食事制限などの入力フィールドを含める。
        *   現在のプロフィール情報をフォームの初期値として表示する (`getUserProfile` を使用)。
    2.  **APIエンドポイント実装:**
        *   `/api/profile` (または `/api/settings/profile`) に `PATCH` または `PUT` メソッドハンドラーを実装する。
        *   リクエストボディから更新データを受け取り、入力値をバリデーションする。
        *   `updateUserProfile` (または直接 Supabase クライアント) を使用して `profiles` テーブルを更新する。
        *   認証ミドルウェア (`withAuthAndErrorHandling`) を適用する。
    3.  **フォーム送信処理:** 編集ページのフォームから、入力されたデータをAPIエンドポイントに送信し、プロフィールを更新するロジックを実装する。成功時・エラー時のフィードバック（トースト通知など）を表示する。
*   **完了条件:** ユーザーが設定編集ページでプロフィール情報を変更し、保存できること。変更内容がDBに反映され、再度表示した際に更新されていること。

---


### タスク 2.7: レシピURL解析の改善と栄養データ変換修正

*   **目的:** レシピクリップ機能 (`/recipes/clip`) におけるURL解析の精度向上（ハイブリッドアプローチ改善）と、レシピ取得時の栄養データ形式の整合性を確保する。
*   **担当範囲:**
    *   `src/app/api/v2/recipe/parse/route.ts` (ハイブリッドロジック、栄養計算呼び出し)
    *   `src/lib/recipe-parsers/` (各専用パーサー、ファクトリ、インターフェース)
    *   `src/lib/ai/services/gemini-service.ts` (`parseRecipeFromUrl`)
    *   `src/lib/ai/prompts/templates/recipe-url-analysis/v1.ts` (AI用プロンプト)
    *   `src/lib/services/recipe-service.ts` (`getRecipeById` - 栄養データ変換修正)
    *   `src/lib/nutrition/nutrition-type-utils.ts` (`convertDbFormatToStandardizedNutrition` - 呼び出し確認)
*   **詳細指示:**
    1.  **ハイブリッドアプローチ改善 (`recipe/parse/route.ts`):**
        *   **専用パーサーレビュー/修正:** 各専用パーサー (`cookpad.ts` など) が最新のサイト構造で動作するか確認し、必要ならセレクタ等を修正してください。エラーハンドリングを強化し、失敗時にAIフォールバックがトリガーされるようにしてください。
        *   **HTMLクリーンアップ強化:** `cheerio` を使用したHTMLクリーンアップ処理を改善し、AIに渡すテキストのノイズを減らし、材料リスト抽出の精度を高めてください。
        *   **AIプロンプト調整:** `recipe-url-analysis/v1.ts` のプロンプトを見直し、クリーンアップされたHTMLから材料名と量をより正確に抽出できるように指示を明確化・調整してください。
        *   **フォールバック連携確認:** 専用パーサー失敗時にスムーズにAI解析に移行し、結果が利用されることを確認してください。`meta.analysisSource` で解析元を返すようにしてください。
    2.  **栄養データ変換修正 (`recipe-service.ts`):**
        *   `RecipeService.getRecipeById` 関数内で、DBから取得した `nutrition_per_serving` (JSONB) を、タスク6で実装した `convertDbFormatToStandardizedNutrition` 関数を使用して `StandardizedMealNutrition` 型に正しく変換するように修正してください。
*   **完了条件:**
    *   レシピURL解析APIが、対応サイトでは専用パーサーを優先し、それ以外や失敗時には改善されたHTMLクリーンアップとAIプロンプトを用いて解析を行うこと。
    *   `RecipeService.getRecipeById` がDBから取得した栄養データを正しく `StandardizedMealNutrition` に変換すること。

