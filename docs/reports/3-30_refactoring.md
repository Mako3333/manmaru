# AIサービスおよびエラーハンドリング リファクタリングレポート

## 概要

本レポートは、AI関連サービス (`AIService`, `AIModelService`) およびエラーハンドリング機構のリファクタリング作業に関する記録です。責務の分離、型安全性の向上、および一貫したエラー処理の実現を目的として実施されました。

## 1. V2以降のディレクトリ構造案

今回のリファクタリングを踏まえ、以下のようなディレクトリ構造を想定しています。これにより、各コンポーネントの責務がより明確になります。

```
src/
├── lib/
│ ├── ai/ # AI関連機能のルート
│ │ ├── core/ # AIモデル呼び出しのコアロジック
│ │ │ ├── ai-model-factory.ts # (想定) AIモデルインスタンス生成
│ │ │ └── ai-model-service.ts # AIモデルとの直接対話
│ │ ├── prompts/ # プロンプト生成ロジック
│ │ │ └── prompt-service.ts
│ │ ├── ai-service.ts # AI機能全体のオーケストレーション
│ │ └── ai-response-parser.ts # (現状維持 or types/aiへ移動検討) AI応答解析
│ │
│ ├── error/ # 統一エラーハンドリング
│ │ ├── codes/
│ │ │ └── error-codes.ts # ErrorCode定義
│ │ ├── types/
│ │ │ ├── base-error.ts # AppError基底クラス
│ │ │ ├── ai-errors.ts # AI関連エラー (AIAnalysisErrorなど)
│ │ │ └── nutrition-errors.ts # 栄養関連エラー
│ │ └── index.ts # エラー関連モジュールの再エクスポート
│ │
│ ├── nutrition/ # 栄養関連機能
│ │ ├── database.ts # 栄養データベースインターフェース・旧実装
│ │ └── supabase-db.ts # Supabaseデータベース実装
│ │
│ └── ... # その他のライブラリ
│
├── types/ # 型定義
│ ├── nutrition.ts # 栄養関連の型 (FoodItemなど)
│ └── ai.ts # (提案) AI関連の型 (AIParseResultなど)
│
└── ... # その他のコード (components, pagesなど)
```

## 2. 実装内容詳細

今回のセッションでは、主に以下の実装および修正を行いました。

*   **エラーハンドリングの統一:**
    *   プロジェクト固有の `AIError` や `FoodAnalysisError` (旧) の使用を廃止しました。
    *   システム全体で共通の基底エラークラス `AppError` (`@/lib/error/types/base-error.ts`) を導入・使用するように変更しました。
    *   AI解析に特化したエラーとして `AIAnalysisError` (`@/lib/error/types/ai-errors.ts`) を導入し、`AIService` 内で使用するようにしました。これは `AppError` を継承しています。
    *   エラーコードを `@/lib/error/codes/error-codes.ts` で定義された `ErrorCode` オブジェクトに統一し、適切なネスト構造 (`ErrorCode.Base.XXX`, `ErrorCode.AI.XXX` など) でアクセスするように修正しました。
    *   エラーをラップする際に、元のエラー情報 (`originalError`) や追加の詳細情報 (`details`) を適切に含めるようにしました。
*   **クラス責務の明確化:**
    *   `AIService` (`@/lib/ai/ai-service.ts`):
        *   AIモデルの直接呼び出しを `AIModelService` に委譲しました。
        *   `analyzeMeal` および `analyzeTextInput` における高レベルなエラーハンドリング（ユーザー向けメッセージ生成、エラーのラップ）を担当するようにしました。
        *   入力検証には `AppError` と `ErrorCode.Base.DATA_VALIDATION_ERROR` を使用するように修正しました。
    *   `AIModelService` (`@/lib/ai/core/ai-model-service.ts`):
        *   テキストモデル (`invokeText`) および画像モデル (`invokeVision`) との直接的な通信を担当します。
        *   `AIModelFactory` を介して（静的メソッド呼び出しとして修正）適切なAIモデルインスタンスを取得します。
        *   モデル呼び出し時に発生した低レベルなエラーをキャッチし、適切な `ErrorCode` を持つ `AppError` にマッピングしてスローするようにしました。
*   **Linterエラーの修正:**
    *   `ai-service.ts` の `catch` ブロックにおける `unknown` 型エラーを、`instanceof` チェック後の明示的な型キャストや、プロパティの個別アクセスによって解消しました。
    *   `ai-model-service.ts` における `AIModelFactory` のメソッド呼び出しを、インスタンス経由から静的呼び出しに修正しました。
    *   インポートパスを修正し、エラー関連モジュールを `@/lib/error` から一元的にインポートするように整理しました。

## 3. 所感・懸念点

実装を進める中で、いくつか気づいた点や今後の課題となりそうな点を記載します。

*   **インポートパス/モジュール解決:**
    *   **最重要懸念:** `@/lib/nutrition/*`, `@/lib/error/*` (初期), `./ai-response-parser` などで頻発した「モジュールが見つかりません」というLinterエラーは、旧ファイル削除に伴うパスの不整合、あるいはTypeScriptのパスエイリアス (`@/`) 設定やビルド構成の問題を示唆しています。現在は一時的に無視していますが、**アプリケーションのビルドと正常動作のためには、これらのパス解決エラーを確実に修正する必要があります。**
*   **`AIParseResult` の位置づけ:**
    *   現在 `ai-service.ts` と同じディレクトリにある `./ai-response-parser` からインポートされている `AIParseResult` の型定義は、少し孤立しているように見えます。これがAIサービス内部でのみ使われる型なのか、あるいは他の場所でも参照される可能性があるのかによって、`@/types/ai.ts` のような共通の型定義ファイルに移動するか、`AIService` または `AIModelService` 内に閉じた型として定義する方が適切かもしれません。現状のままだと、将来的に `ai-service.ts` を移動した場合などにパスの問題が発生する可能性があります。
*   **エラークラスの粒度:**
    *   現在導入した `AIAnalysisError` はAI解析全般をカバーしていますが、ユースケースによってはさらに詳細なエラー分類（例: `ImageAnalysisError`, `TextAnalysisError`, `ContentFilterError` など）が必要になるかもしれません。現状は `AppError` の `code` や `details` で区別していますが、将来的な拡張性を考慮すると、より具体的なエラークラスの導入も検討の余地があります。
*   **データベースフォールバック処理:**
    *   `calculateNutritionUsingDatabase` や `enhanceResultWithDatabase` 内の、Supabase DBからローカルDBへのフォールバックロジックは、やや複雑に見受けられます。特に、ローカルDBを使用する際に `(this.nutritionDatabase as NutritionDatabase)` という型キャストが必要になっている点は、`NutritionDatabaseLLMAPI` インターフェースの設計、またはクラス間の依存関係に改善の余地がある可能性を示唆しています。多様な条件下（DB接続エラー、データ欠損など）での動作について、十分なテストが必要です。
*   **Zodスキーマ検証のタイミング:**
    *   `ai-service.ts` 内で `foodAnalysisSchema` を用いた検証は、AIからの応答を `parseAiResponse` でパースした後、または `calculateNutritionUsingDatabase` で代替データを生成した後に行われ、エラーは警告としてログ出力されるのみです。レスポンス形式の保証をより強固にするためには、`parseAiResponse` 内で生のJSON応答に対して早期に検証を行う、または `analyzeMeal`/`analyzeTextInput` の最終返却値に対して検証を行い、失敗した場合はエラーをスローする、といったアプローチも考えられます。
*   **`analyzeMeal` のエラーハンドリング:**
    *   `analyzeMeal` メソッド内の `catch (error)` ブロックでは、`AppError` を再スローする際にスプレッド構文 (`...error`) がまだ使用されています。これは `analyzeTextInput` で修正した箇所と同様の問題を潜在的に含んでいるため、型安全性を高めるためにプロパティを明示的に割り当てる形式に修正することが推奨されます。

*   **`NutritionService` との連携:**
    *   `AIService` が、新しく定義された `NutritionService` インターフェース (`@/lib/nutrition/nutrition-service.ts`) に依存するように変更しました。
    *   `NutritionService` インターフェースに `processParsedFoods(parsedFoods: FoodInputParseResult[]): Promise<FoodAnalysisResult>` メソッドを追加し、AI解析後の食品リストを受け取り、食品マッチング、栄養計算、結果強化を含む最終的な `FoodAnalysisResult` を返す責務を定義しました。
    *   `AIService` のコンストラクタ内で `FoodRepositoryFactory` および `NutritionServiceFactory` を使用して依存性を注入し、`NutritionService` のインスタンスを取得するようにしました。
    *   `AIService` の `analyzeTextInput` メソッドで、`GeminiResponseParser` による解析後、`nutritionService.processParsedFoods()` を呼び出して処理を委譲するように修正しました。
    *   `AIService` の `analyzeMeal` メソッドで、内部パーサー (`parseFoodAnalysisResponse`) の結果を `FoodInputParseResult[]` 形式に変換する一時的なアダプターを導入し、`nutritionService.processParsedFoods()` を呼び出すように修正しました。
    *   `AIService` のエラーハンドリング (`catch` ブロック) を更新し、`NutritionService` からスローされる可能性のあるエラーコード (`ErrorCode.Nutrition.FOOD_NOT_FOUND`, `ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR`) を考慮に入れ、適切なユーザーメッセージと提案を表示するように調整しました。
*   **型定義の整理:**
    *   AI関連の主要な型定義 (`AIParseResult`, `FoodAnalysisResult`, `NutritionAdviceResult` など) を `src/lib/ai/ai-service.ts` から新しいファイル `src/types/ai.ts` に移動し、関心事を分離しました。
*   **Linterエラーの修正 (連携部分):**
    *   `AIService` 内での `NutritionServiceFactory` および `FoodRepositoryFactory` の正しい使用方法（メソッド名 `createService`, `getRepository` の修正）に関する Linter エラーを解消しました。
    *   `analyzeTextInput` 内の `map` 関数における `FoodInputParseResult` の型インポート漏れと、それに伴う Linter エラーを修正しました。
    *   エラーハンドリングで使用していた `ErrorCode.Nutrition.CALCULATION_ERROR` を正しい `ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR` に修正しました。

**(新規) `analyzeMeal` パーサーのアダプター:**
*   画像解析 (`analyzeMeal`) で使用している内部パーサー (`parseFoodAnalysisResponse`) は、`NutritionService.processParsedFoods` が期待する `FoodInputParseResult[]` 形式を直接返しません。今回、一時的な変換アダプターを導入しましたが、これは場当たり的な対応です。将来的には以下のいずれかが必要です:
    *   `parseFoodAnalysisResponse` を修正し、`FoodInputParseResult[]` を返すようにする。
    *   `GeminiResponseParser` のような共通パーサーで画像解析レスポンスも扱えるように拡張する。
    *   `NutritionService.processParsedFoods` が複数の入力形式 (例: `FoodAnalysisInput` と `FoodInputParseResult[]`) を受け付けられるようにオーバーロードまたは修正する。

**(新規) `NutritionServiceImpl` の実装依存:**
*   今回のリファクタリングにより、`AIService` は `NutritionService` インターフェースに依存する形になりました。しかし、システム全体の動作は `NutritionServiceImpl` が `processParsedFoods` メソッドをインターフェースの定義通りに、かつ期待されるロジック（食品マッチング、計算、強化）で実装していることが前提となります。この実装が不完全な場合、`AIService` の動作も不完全になります。

**(新規) ファクトリの依存関係:**
*   `AIService` が `NutritionService` を取得するために、`FoodRepositoryFactory` と `NutritionServiceFactory` の両方を知っている必要があります (`FoodRepository` を取得して `NutritionService` の生成時に渡すため)。これは少し依存関係が複雑になっているようにも見えます。DI (Dependency Injection) コンテナなどの導入を検討するか、より上位の層で依存性を解決して `AIService` には完成した `NutritionService` インスタンスを渡すような設計も考えられます。
