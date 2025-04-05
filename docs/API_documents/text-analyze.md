## API ドキュメント: テキスト入力による食事解析・栄養計算

このドキュメントは、テキスト入力に基づいて食事内容を解析し、栄養価を計算する API エンドポイントについて説明します。

### エンドポイント

`POST /api/v2/meal/text-analyze`

### 概要

ユーザーが入力した食事に関するテキスト（例: "ごはん 茶碗1杯、味噌汁、焼き鮭"）を受け取り、含まれる食品を特定し、それらの栄養価（カロリー、タンパク質、鉄など）を計算して返します。

内部的には、まず正規表現ベースのパーサーで解析を試み、解析できない場合は AI (Gemini) を利用して食品を抽出します。その後、食品データベースと照合し、栄養計算を行います。

### リクエスト

#### ヘッダー

| 名前           | 値                   | 説明     |
| :------------- | :------------------- | :------- |
| `Content-Type` | `application/json` | 必須     |
| `Authorization`| `Bearer <token>`     | 必須 (認証) |

#### ボディ (JSON)

```json
{
  "text": "string (必須)",
  "mealType": "string (任意, デフォルト: '食事')",
  "trimester": "number (任意, 1, 2, or 3)"
}
```

*   `text`: ユーザーが入力した食事内容のテキスト。
*   `mealType`: 食事の種類（例: 'breakfast', 'lunch', 'dinner', 'snack'）。レスポンスに含まれますが、現在の計算ロジックでは直接使用されていません。
*   `trimester`: 妊娠期（1, 2, 3）。栄養目標値の計算などに将来的に使用される可能性がありますが、現在の栄養計算ロジックには直接影響しません。

### レスポンス (成功時: 200 OK)

```json
{
  "success": true,
  "data": {
    "foods": [ // 解析された食品リスト (FoodInputParseResult[])
      {
        "foodName": "string", // 検出された食品名
        "quantityText": "string | null", // 検出された量のテキスト (例: "1杯", "100g")、不明な場合は null
        "confidence": "number" // 食品名の認識信頼度 (主にAI解析時)
      }
      // ... more food items
    ],
    "originalText": "string", // リクエストで送信された元のテキスト
    "mealType": "string", // リクエストで送信された (またはデフォルトの) 食事タイプ
    "trimester": "number | undefined", // リクエストで送信された妊娠期 (あれば)
    "nutritionResult": {
      "nutrition": { // 計算された栄養情報 (StandardizedMealNutrition)
        "totalCalories": "number", // 総カロリー (kcal)
        "totalNutrients": [ // 総栄養素リスト (Nutrient[])
          {
            "name": "string", // 栄養素名 (例: "protein", "iron")
            "value": "number", // 量
            "unit": "string" // 単位 (例: "g", "mg", "μg")
          }
          // ... more nutrients
        ],
        "foodItems": [ // 各食品アイテムの栄養情報 (FoodItem[])
          {
            "id": "string", // データベース内の食品ID
            "name": "string", // マッチングされた食品名
            "nutrition": { // この食品アイテムの栄養価 (FoodItemNutrition)
              "calories": "number",
              "nutrients": [ { "name": "...", "value": ..., "unit": "..." } ]
            },
            "amount": "number", // 計算された量 (グラム換算後)
            "unit": "g", // 単位 (現在は 'g' 固定)
            "confidence": "number", // この食品アイテムの総合信頼度 (マッチングx量解析)
            "originalInput": { // 元の入力情報
                "name": "string",
                "quantity": "string | undefined"
            },
            "matchResult": { // 食品マッチングの詳細
                "similarity": "number",
                "source": "string" // マッチング元 (例: "name", "alias")
            }
          }
          // ... more food items
        ],
        "pregnancySpecific": { // 妊娠期特有の目標値に対する充足率など (現在はダミーデータ/未実装)
          "folate_percentage": "number | null",
          "iron_percentage": "number | null",
          "calcium_percentage": "number | null"
        }
        // ... 他の StandardizedMealNutrition プロパティ
      },
      "reliability": { // 栄養計算全体の信頼度情報
        "confidence": "number", // 総合的な信頼度スコア (0-1)
        "warnings": "string[]" // 警告メッセージ (例: 低確信度の食品があった場合)
      },
      "matchResults": "any[]", // (現状 any[] だが) 食品マッチングの詳細結果リスト
      "legacyNutrition": { ... } // 後方互換性のための旧形式 (NutritionData)
    },
    // AI 解析が実行された場合のみ含まれるフィールド
    "recognitionConfidence": "number | undefined", // AIによるテキスト全体の解析信頼度
    "aiEstimatedNutrition": "object | undefined" // AIが直接推定した栄養価 (参考情報)
  },
  "meta": {
    "processingTimeMs": "number", // サーバーサイドでの処理時間 (ミリ秒)
    "analysisSource": "'parser' | 'ai'", // テキスト解析に使用されたソース ('parser' または 'ai')
    "warning": "string | undefined" // 信頼度が低い場合などの警告メッセージ
  }
}
```

### レスポンス (エラー時)

エラー発生時は `success: false` となり、`error` オブジェクトが含まれます。HTTP ステータスコードはエラーの種類に応じて 4xx または 5xx となります。

```json
{
  "success": false,
  "error": {
    "code": "string", // エラーコード (例: "data_validation_error", "food_not_found", "unknown_error")
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

*   `ErrorCode.Base.DATA_VALIDATION_ERROR`: リクエストボディの形式が不正（例: `text` が空）。
*   `ErrorCode.Nutrition.FOOD_NOT_FOUND`: 入力テキストから食品を一つも検出できなかった。
*   `ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR`: 栄養計算中にエラーが発生した。
*   `ErrorCode.AI.ANALYSIS_ERROR`: AIによるテキスト解析に失敗した。
*   `ErrorCode.AI.API_REQUEST_ERROR`: AIサービスへの接続に失敗した。
*   `ErrorCode.Base.UNKNOWN_ERROR`: その他の予期せぬサーバーエラー。
*   `ErrorCode.Base.AUTH_ERROR`: 認証エラー。

### 注意事項

*   `data.foods` は、あくまでテキストから解析された食品名と量のリストであり、データベースとマッチングされた後の食品情報ではありません。マッチング後の情報は `data.nutritionResult.nutrition.foodItems` に含まれます。
*   `data.nutritionResult.nutrition` は `StandardizedMealNutrition` 型に準拠します。詳細は `src/types/nutrition.ts` を参照してください。
*   `data.nutritionResult.legacyNutrition` は後方互換性のために提供されており、将来的には削除される可能性があります。可能な限り `data.nutritionResult.nutrition` を使用してください。
*   AIによる解析 (`analysisSource: 'ai'`) の場合、結果の精度は入力テキストの具体性や曖昧さに依存します。`recognitionConfidence` や `nutritionResult.reliability.confidence` を参考にしてください。


◤◢◤◢◤◢◤◢◤◢◤◢◤◢

## テキスト入力と画像入力の保存フロー

1. **フロントエンド側の保存処理**:
   - **画像入力の場合**: `src/app/(authenticated)/meals/log/page.tsx` の `handleSaveRecognition` 関数
   - **テキスト入力の場合**: 同ファイル内の `handleSaveTextInput` 関数

2. **データの加工と送信**:
   どちらの入力方法でも、最終的にはデータを標準形式 (`StandardizedMealData`) に変換し、`/api/meals` エンドポイントに POST リクエストを送信します：

   ```typescript
   // APIリクエスト用にデータを変換（レガシーシステムとの互換性のため）
   const mealData = prepareForApiRequest(standardizedMealData);

   // APIを使用してデータを保存
   const response = await fetch('/api/meals', {
       method: 'POST',
       headers: {
           'Content-Type': 'application/json',
       },
       body: JSON.stringify(mealData),
   });
   ```

3. **バックエンド側の処理**:
   実際のデータベース保存処理は `src/app/api/meals/route.ts` で行われています。ここで:
   - Supabase (PostgreSQL) への実際の保存処理
   - `meals` テーブルと `meal_nutrients` テーブルへのデータ挿入
   - 必要に応じて画像の保存処理

4. **データ構造**:
   - `meals` テーブル: 食事の基本情報（日時、タイプ、画像URL等）
   - `meal_nutrients` テーブル: 栄養素の詳細値
   - `meal_items` テーブル: 食品アイテムの詳細（任意選択）

