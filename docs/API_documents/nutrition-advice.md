# API ドキュメント: 栄養アドバイス生成・取得

このドキュメントは、ユーザーにパーソナライズされた栄養アドバイスを生成、取得、管理するための API エンドポイントについて説明します。

## エンドポイント

- `GET /api/v2/nutrition-advice`
- `PATCH /api/v2/nutrition-advice`

## 概要

ユーザーのプロファイル情報（出産予定日から計算される妊娠週数など）や過去の食事記録（不足栄養素の特定など）を考慮し、AIを用いて指定された日付やタイプに応じた栄養アドバイス（概要、詳細、推奨食品リストを含む）を生成します。生成されたアドバイスはデータベースに保存され、再取得が可能です。また、アドバイスの既読状態を管理する機能も提供します。

---

## GET /api/v2/nutrition-advice

指定された日付とタイプに基づいて栄養アドバイスを取得します。条件に応じて、既存のアドバイスを返すか、AIで新規生成します。

### リクエスト

#### ヘッダー

| 名前           | 値                 | 説明    |
| :------------- | :----------------- | :------ |
| `Authorization`| `Bearer <token>`   | 必須 (認証) |

#### クエリパラメータ

| 名前              | 型        | 説明                                                                                             | 必須 | デフォルト       |
| :---------------- | :-------- | :----------------------------------------------------------------------------------------------- | :--- | :------------- |
| `date`            | `string`  | アドバイス対象日 (YYYY-MM-DD形式)。                                                               | 否   | 現在の日本日付 |
| `type`            | `string`  | アドバイスタイプ (`DAILY_INITIAL`, `AFTER_MEALS`, `MANUAL_REFRESH`)。生成上限の判定に使用。       | 否   | `DAILY_INITIAL` |
| `forceRegenerate` | `boolean` | `true` の場合、上限に関わらず強制的にAIでアドバイスを再生成します。DBにはUpsertで保存されます。   | 否   | `false`        |

### 処理フロー

1.  **認証:** ユーザー認証を行います。
2.  **パラメータ検証:** クエリパラメータ (`type`, `forceRegenerate`) を検証します。
3.  **ユーザープロファイル取得:** データベースからユーザープロファイル（特に `due_date`）を取得します。予定日未設定の場合はエラー。
4.  **上限チェック:** 指定された `type` と `date` に対して、当日のアドバイス生成回数が上限に達しているか確認します (`isAdviceLimitReached` 関数)。
5.  **生成要否判断:** `forceRegenerate` が `true` であるか、または上限に達していない場合にアドバイスを生成する必要があると判断します。
6.  **既存アドバイス取得 (生成不要時):** 生成不要と判断された場合、DBから指定された `type` と `date` に一致する最新のアドバイスを検索し、存在すればそれを返します。
7.  **AIアドバイス生成 (生成必要時):**
    a.  ユーザー情報（妊娠週数、妊娠期、季節）を取得します。
    b.  過去の食事記録から不足栄養素を特定します (`getPastNutritionData`, `identifyDeficientNutrients`)。
    c.  上記情報を元にプロンプトコンテキストを作成します (`promptContext`)。
    d.  AIサービス (`GeminiService`) を呼び出し、栄養アドバイス（概要、詳細、推奨食品）を生成します (`getNutritionAdvice`)。
    e.  生成されたアドバイスをデータベース (`daily_nutri_advice`) に Upsert します (user\_id, advice\_date, advice\_type がコンフリクトキー)。
    f.  生成・保存されたアドバイスデータを返します。
8.  **レスポンス返却:** 取得または生成したアドバイスデータを成功レスポンスとして返します。エラー発生時はエラーレスポンスを返します。

### レスポンス (成功時: 200 OK)

```json
{
  "success": true,
  "data": {
    "id": "string", // アドバイスレコードのUUID
    "advice_date": "string", // アドバイス対象日 (YYYY-MM-DD)
    "advice_type": "'DAILY_INITIAL' | 'AFTER_MEALS' | 'MANUAL_REFRESH'", // アドバイスタイプ
    "advice_summary": "string", // アドバイスの短い要約
    "advice_detail": "string", // 詳細なアドバイス内容 (Markdown形式の可能性あり)
    "recommended_foods": [ // 推奨食品リスト (オブジェクト配列)
      {
        "name": "string", // 食品名
        "description": "string" // 食品の説明や推奨理由
      }
      // ... more food items
    ],
    "is_read": "boolean", // 既読フラグ
    "generated_at": "string", // アドバイス生成/更新日時 (ISO 8601形式)
    "source": "'database' | 'ai'" // このレスポンスのデータソース ('database': 既存取得, 'ai': 新規生成)
  },
  "meta": {
    "processingTimeMs": "number" // 処理時間 (ミリ秒)
  }
}
```

### レスポンス (エラー時)

エラー発生時は `success: false` となり、`error` オブジェクトが含まれます。

```json
{
  "success": false,
  "error": {
    "code": "string", // エラーコード (下記参照)
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

*   `ErrorCode.Base.AUTH_ERROR`: 認証トークンが無効または不足。
*   `ErrorCode.Base.DATA_VALIDATION_ERROR`: クエリパラメータ (`type`) が不正。
*   `ErrorCode.Base.DATA_NOT_FOUND`: ユーザープロファイルが見つからない、または出産予定日が未設定。
*   `ErrorCode.Base.API_ERROR`: データベースアクセスエラー（上限チェック、プロファイル取得、アドバイス取得/保存）。
*   `ErrorCode.AI.MODEL_ERROR`: AIモデルによるアドバイス生成に失敗、または必要な情報が不足している。
*   `ErrorCode.Base.UNKNOWN_ERROR`: その他の予期せぬサーバーエラー。

---

## PATCH /api/v2/nutrition-advice

特定のアドバイスを既読状態にします。

### リクエスト

#### ヘッダー

| 名前           | 値                 | 説明    |
| :------------- | :----------------- | :------ |
| `Content-Type` | `application/json` | 必須    |
| `Authorization`| `Bearer <token>`   | 必須 (認証) |

#### ボディ (JSON)

```json
{
  "id": "string (必須, UUID)"
}
```

*   `id`: 既読にしたいアドバイスレコードのUUID。

### 処理フロー

1.  **認証:** ユーザー認証を行います。
2.  **パラメータ検証:** リクエストボディの `id` が有効なUUIDか検証します。
3.  **DB更新:** `daily_nutri_advice` テーブルで、指定された `id` と認証ユーザーの `user_id` に一致するレコードの `is_read` カラムを `true` に更新します。
4.  **レスポンス返却:** 更新が成功した場合は成功レスポンス、失敗した場合はエラーレスポンスを返します。

### レスポンス (成功時: 200 OK)

```json
{
  "success": true,
  "data": { // 更新後のアドバイスデータ（またはシンプルな成功メッセージの場合あり）
    "id": "string",
    "advice_date": "string",
    "advice_type": "string",
    // ... 他のフィールド
    "is_read": true // 更新されたフラグ
  },
  "meta": {
    "processingTimeMs": "number"
  }
}
```
*注意: 現在の実装では、成功時に `data` を返さないか、あるいは固定の成功メッセージを返す可能性があります。要確認。*

### レスポンス (エラー時)

`GET` リクエストと同様のエラー構造で返されます。

**主なエラーコード:**

*   `ErrorCode.Base.AUTH_ERROR`: 認証エラー。
*   `ErrorCode.Base.DATA_VALIDATION_ERROR`: リクエストボディ (`id`) が不正。
*   `ErrorCode.Base.API_ERROR`: データベース更新エラー。
*   `ErrorCode.Base.DATA_NOT_FOUND`: 指定されたIDのアドバイスが存在しない、またはユーザーに権限がない。
*   `ErrorCode.Base.UNKNOWN_ERROR`: その他の予期せぬサーバーエラー。

---

## 注意事項と改善点

*   **推奨食品の形式:** `recommended_foods` は `{ name: string, description: string }` 形式のオブジェクト配列として返されます。以前の `string[]` 形式や `{ name, benefits }` 形式とは異なります。
*   **AIプロンプト:** AIが生成するアドバイスの内容（特に `advice_detail` や `recommended_foods` の `description`）は、`src/lib/ai/prompts/templates/nutrition-advice/v1.ts` のプロンプトテンプレートに依存します。不要な接頭辞（例：「旬の食材を使ったアドバイス：」）が含まれないよう、プロンプトが調整されています。
*   **フロントエンド連携:** フロントエンド (`src/components/dashboard/nutrition-advice.tsx`) でこのAPIを利用する際、特に強制更新 (`forceRegenerate=true`) をトリガーする際の useEffect や状態管理の依存関係には注意が必要です。意図しない複数回のAPI呼び出しを避けるため、ロジックは簡潔に保つべきです（修正済み）。
*   **エラーハンドリング:** APIは `AppError` クラスと `ErrorCode` を使用して構造化されたエラーを返します。クライアント側ではこれを適切に処理し、ユーザーに分かりやすいメッセージを表示する必要があります。プロファイル未設定時のリダイレクト提案なども `error.details.redirect` に含まれる場合があります。
*   **データベース:** 関連する主なテーブルは `daily_nutri_advice`, `profiles`, `food_log` です。`daily_nutri_advice` の `recommended_foods` カラムは `jsonb` 型です。 