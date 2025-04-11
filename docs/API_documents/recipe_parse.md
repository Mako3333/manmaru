# API ドキュメント: レシピURL解析・栄養計算

このドキュメントは、指定されたURLからレシピ情報を解析し、栄養計算を実行する API エンドポイントについて説明します。

## エンドポイント

`POST /api/v2/recipe/parse`

## 概要

ユーザーがレシピページのURLを提供すると、APIは以下の処理を実行します。

1.  **URL解析:** 対応サイト（クックパッド、デリッシュキッチン等）の場合は専用パーサーを使用し、それ以外または専用パーサーが失敗した場合はAI（Gemini）を使用してHTMLコンテンツからレシピ情報（タイトル、材料リスト、分量など）を抽出します (ハイブリッドアプローチ)。
2.  **栄養計算:** 抽出された材料リストに基づき、`NutritionService` を使用して食品データベースとのマッチングを行い、栄養価（カロリー、主要栄養素など）を計算します。
3.  **結果返却:** 解析されたレシピ情報と計算された栄養データ (`StandardizedMealNutrition` 形式) を返します。

**注意:** このAPIは解析と計算のみを行い、データベースへの**保存は行いません**。レシピの保存（クリップ）は、別途フロントエンドからの保存リクエスト (`/api/recipes` POST など、別途定義される想定) によって行われます。

## リクエスト

### ヘッダー

| 名前           | 値                 | 説明    |
| :------------- | :----------------- | :------ |
| `Content-Type` | `application/json` | 必須    |
| `Authorization`| `Bearer <token>`   | 必須 (認証) |

### ボディ (JSON)

```json
{
  "url": "string (必須)"
}
```

* `url`: 解析したいレシピページの有効なURL。

## レスポンス (成功時: 200 OK)

```json
{
  "success": true,
  "data": {
    "recipe": { // 解析されたレシピ情報
      "title": "string", // レシピタイトル
      "servings": "string | null", // 何人分か (例: "2人分", "作りやすい分量", null)
      "servingsNum": "number", // 人数 (数値、抽出・計算された場合)
      "ingredients": [ // 材料リスト
        {
          "name": "string", // 材料名
          "quantity": "string | null" // 分量 (例: "100g", "大さじ1", "少々", null)
        }
        // ... more ingredients
      ],
      "sourceUrl": "string" // 元のレシピURL
    },
    "nutritionResult": { // 栄養計算結果
      "nutrition": { /* StandardizedMealNutrition */ }, // レシピ全体の標準化栄養データ (合計値)
      "perServing": { /* StandardizedMealNutrition | undefined */ }, // 1人前あたりの標準化栄養データ (計算可能な場合)
      "legacyNutrition": { /* NutritionData */ }, // 互換性のための旧栄養データ形式 (合計値)
      "legacyPerServing": { /* NutritionData | undefined */ }, // 互換性のための旧1人前データ
      "reliability": { // 信頼性情報
        "confidence": "number", // 総合的な信頼度 (食品DBマッチング精度など)
        "completeness": "number" // 食品DBで見つかった割合など (NutrituionServiceが計算)
      },
      "matchResults": [ /* FoodMatchResult[] */ ] // 各材料の食品DBマッチング結果 (NutritionServiceが返す)
    }
  },
  "meta": {
    "processingTimeMs": "number", // 処理時間 (ミリ秒)
    "analysisSource": "'parser' | 'ai'", // 材料抽出に使用されたソース ('parser': 専用パーサー, 'ai': AI)
    "warning": "string | undefined" // 警告メッセージ (あれば)
  }
}
```

*   `StandardizedMealNutrition` の詳細な型定義は `src/types/nutrition.ts` を参照してください。
*   `NutritionData` の詳細な型定義は `src/types/nutrition.ts` を参照してください。
*   `FoodMatchResult` の詳細な型定義は `src/lib/nutrition/nutrition-service.interface.ts` を参照してください。

## レスポンス (エラー時)

エラー発生時は `success: false` となり、`error` オブジェクトが含まれます。HTTP ステータスコードはエラーの種類に応じて 4xx または 5xx となります。

```json
{
  "success": false,
  "error": {
    "code": "string", // エラーコード (例: ErrorCode.Base.DATA_VALIDATION_ERROR)
    "message": "string", // ユーザー向けのエラーメッセージ
    "details": "any (開発時のみ)", // デバッグ用の詳細情報
    "suggestions": "string[] | undefined" // 解決策の提案 (あれば)
  },
  "meta": {
    "processingTimeMs": "number"
  }
}
```

**主なエラーコード:**

*   `ErrorCode.Base.DATA_VALIDATION_ERROR`: リクエストデータが不正（例: URLが無効）。
*   `ErrorCode.Base.NETWORK_ERROR`: 指定されたURLへの接続に失敗した。
*   `ErrorCode.Base.TIMEOUT_ERROR`: URLからのHTML取得がタイムアウトした。
*   `ErrorCode.AI.ANALYSIS_FAILED`: AIによるレシピ解析に失敗した。
*   `ErrorCode.Nutrition.FOOD_NOT_FOUND`: レシピから材料が検出されなかった、または食品DBでマッチする食品が見つからなかった。
*   `ErrorCode.Base.API_ERROR`: その他の予期せぬサーバーエラー。

## 注意事項

*   **ハイブリッド解析:** このAPIは、まずURLに対応する専用パーサー（Cookpad, Delish Kitchenなど）を試みます。専用パーサーが存在しないか、解析に失敗した場合、AI（Gemini）を使用してHTMLコンテンツから情報を抽出します。解析ソースはレスポンスの `meta.analysisSource` で確認できます。
*   **HTMLクリーンアップ:** AI解析を行う前に、`cheerio` を用いてHTMLから不要な要素（スクリプト、スタイル、広告など）を除去し、テキストコンテンツを抽出する前処理を行いますが、複雑なサイト構造やJavaScriptで動的に生成されるコンテンツには限界があります。
*   **栄養計算:** 抽出された材料リストに基づいて `NutritionService` が栄養計算を実行します。食品データベース（FOODEX）とのマッチング精度や、量の解釈によって計算結果の精度は変動します。DBにマッチしない材料は現状計算に含まれません。
*   **保存:** このAPIはレシピ情報の解析と栄養計算のみを行い、結果をDBに保存しません。

## 技術的負債と改善点

*   **URL解析精度:** 専用パーサーはサイト構造の変更に影響を受けやすく、定期的なメンテナンスが必要です。AI解析も、HTMLの構造やノイズによって精度が変動します。特に材料と分量の正確な抽出は課題です。
*   **HTMLクリーンアップの限界:** `cheerio` による静的なHTML解析では、JavaScriptで動的にレンダリングされるコンテンツを完全に取得・解析することは困難です。Puppeteerなどのヘッドレスブラウザ導入も検討できますが、パフォーマンスとのトレードオフになります。
*   **栄養計算の精度:**
    *   食品データベース（FOODEX）のカバレッジ: 一般的な料理名や新しい食品に対応できていない場合があります。
    *   量の解釈: 「少々」「適量」などの曖昧な表現や、「1/2個」のような単位の解釈精度に課題があります。
    *   DBにマッチしない食品の扱い: 現状、計算から除外されています。AI推定値の活用や代替DBの検討が必要です。
*   **エラーハンドリング:** 特定のパーサーエラーや栄養計算時の詳細なエラー（どの食品がマッチしなかったか等）をより具体的にクライアントにフィードバックする改善の余地があります。
*   **AI依存:** AIフォールバックに依存しているため、AIサービスのコストや安定性、API仕様変更の影響を受けます。

``` 