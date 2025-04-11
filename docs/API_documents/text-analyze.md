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

フェーズ2の実装により、テキスト入力と画像入力の保存フローが標準化され、一貫して`StandardizedMealNutrition`型を使用するようになりました。以下は、入力から保存までの詳細な流れです。

### 1. フロントエンド - ユーザー入力受付

**テキスト入力の場合:**
1. ユーザーが食事内容をテキストで入力（例: "ごはん 茶碗1杯、味噌汁、焼き鮭"）
2. UIで食品リスト`FoodItem[]`として管理（`src/app/(authenticated)/meals/log/page.tsx`）
3. ユーザーが「保存」ボタンを押すと`handleSaveTextInput`関数が呼び出される

**写真入力の場合:**
1. ユーザーが食事の写真をアップロード
2. 写真データが自動的に解析され、食品リストを表示
3. ユーザーが「保存」ボタンを押すと`handleSaveRecognition`関数が呼び出される

### 2. フロントエンド - 入力データの処理とAPI呼び出し

**テキスト入力処理 (`handleSaveTextInput`関数):**
```typescript
// 1. 入力された食品リストのバリデーション
if (foodItems.length === 0) {
    toast.error('食品が入力されていません');
    return;
}

// 2. AI解析による食品情報の強化
const enhancedFoods = await enhanceFoodItems(foodItems);

// 3. 強化された食品リストをテキスト形式に変換
const foodText = enhancedFoods.map(food => `${food.name} ${food.quantity}`.trim()).join('、');

// 4. テキスト解析APIを呼び出し
const nutritionResult = await analyzeTextInput(foodText);

// 5. 返された栄養データ（StandardizedMealNutrition型）を取得
const standardizedNutrition = nutritionResult.data.nutritionResult.nutrition;

// 6. 保存用データの準備
const mealData = {
    meal_type: mealType,
    meal_date: formattedDate,
    food_description: {
        items: enhancedFoods.map(/*...食品データ変換...*/)
    },
    // StandardizedMealNutrition型のデータをそのまま使用
    nutrition_data: standardizedNutrition
};

// 7. データのバリデーション
validateMealData(mealData);

// 8. /api/mealsエンドポイントに保存リクエスト送信
const response = await fetch('/api/meals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mealData),
});
```

### 3. バックエンド - API処理とデータベース保存

**APIエンドポイント処理 (`src/app/api/meals/route.ts`):**
```typescript
// 1. リクエストデータの検証
if (!requestData || typeof requestData !== 'object') {
    throw new AppError({ /*...エラー詳細...*/ });
}

// 2. 認証ユーザーのIDを取得
const userId = session.user.id;

// 3. 食事データの構築
const mealData = {
    user_id: userId,
    meal_type: requestData.meal_type,
    meal_date: requestData.meal_date,
    photo_url: requestData.photo_url,
    food_description: requestData.food_description,
    // ...その他の属性
};

// 4. nutrition_dataがStandardizedMealNutrition型かを確認
let standardizedNutritionData: StandardizedMealNutrition | undefined = undefined;
if (requestData.nutrition_data) {
    // 型チェック: StandardizedMealNutrition型の場合は直接使用
    if (
        typeof requestData.nutrition_data === 'object' &&
        'totalCalories' in requestData.nutrition_data &&
        'totalNutrients' in requestData.nutrition_data &&
        'foodItems' in requestData.nutrition_data
    ) {
        standardizedNutritionData = requestData.nutrition_data;
    } else {
        // 旧形式の場合は変換処理
        standardizedNutritionData = convertToStandardizedNutrition(requestData.nutrition_data);
    }
}

// 5. MealServiceを使用してデータベースに保存
const result = await MealService.saveMealWithNutrition(supabase, {
    // ...mealDataの各フィールド
    ...(standardizedNutritionData && { nutrition_data: standardizedNutritionData }),
});
```

**データベース保存処理 (`src/lib/services/meal-service.ts`):**
```typescript
// MealService.saveMealWithNutrition関数
// 1. データのバリデーション
const { isValid, errors } = this.validateData(mealData);
if (!isValid) {
    throw new AppError({ /*...エラー詳細...*/ });
}

// 2. 栄養データの検証（StandardizedMealNutrition型であることを確認）
if (mealData.nutrition_data) {
    if (!this.validateStandardizedNutrition(mealData.nutrition_data)) {
        throw new AppError({ /*...エラー詳細...*/ });
    }
}

// 3. データベースへの保存
const { data, error } = await supabase
    .from('meals')
    .insert({
        user_id: mealData.user_id,
        meal_type: mealData.meal_type,
        meal_date: mealData.meal_date,
        photo_url: mealData.photo_url,
        food_description: mealData.food_description,
        // nutrition_dataカラムにStandardizedMealNutrition型のデータを直接保存
        nutrition_data: mealData.nutrition_data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    })
    .select('id')
    .single();

// 4. 保存結果を返却
return { id: data.id };
```

### 4. データフロー図: ユーザー入力からデータベース保存まで

```
ユーザー入力（テキスト/写真）
       ↓
フロントエンド処理
 ┌───────────────────────────────────┐
 │ 1. 入力データの検証                                │
 │ 2. テキスト解析/画像解析API呼び出し                   │
 │ 3. StandardizedMealNutrition型データ取得         │
 │ 4. 保存用データの構築                               │
 └───────────────────────────────────┘
       ↓
/api/meals POST API
 ┌───────────────────────────────────┐
 │ 1. リクエストデータの検証                           │
 │ 2. ユーザー認証・セッション確認                       │
 │ 3. StandardizedMealNutrition型の検証・変換      │
 │ 4. MealServiceを使用した保存処理呼び出し            │
 └───────────────────────────────────┘
       ↓
MealService.saveMealWithNutrition
 ┌───────────────────────────────────┐
 │ 1. データのバリデーション                           │
 │ 2. StandardizedMealNutrition型の検証           │
 │ 3. meals テーブルへの保存                         │
 │   - nutrition_dataカラムに直接保存                │
 └───────────────────────────────────┘
       ↓
データベース（Supabase）
 ┌───────────────────────────────────┐
 │ meals テーブル                                  │
 │  - nutrition_data: StandardizedMealNutrition型 │
 │  - food_description: テキスト入力/AIの解析結果         │
 │  - その他のメタデータ                               │
 └───────────────────────────────────┘
```

### 5. フェーズ2実装による主な改善点

1. **型の一貫性**: 入力から保存までの全フローで`StandardizedMealNutrition`型を一貫して使用
2. **エラーハンドリングの強化**: 各段階でのデータ検証とエラーハンドリングを追加
3. **不要な変換処理の削減**: 旧形式への変換処理を削減し、処理の効率化
4. **データベース保存の簡素化**: `meal_nutrients`テーブルへの書き込みを廃止し、すべての栄養データを`meals.nutrition_data`カラムに格納
5. **型安全性の向上**: TypeScriptの型チェックを活用した安全なデータ処理

これらの改善により、食事データの入力から保存までのフローが安定化し、エラーが発生するリスクが大幅に低減されました。

