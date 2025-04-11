MVP後の対応
================

この問題は、MVPリリース後のリファクタリング・改善フェーズにおける優先度の高いタスクとして、課題管理ツールに正式に登録してください。

解決策の検討
-------------

MVP後に、以下のいずれか、または組み合わせによる根本解決を目指します。

### 共通の型ガード関数/ユーティリティ

context.params を受け取り、期待するパラメータ（例: id）が存在し、string 型であることを検証して返すような関数を作成し、各APIルートで利用する。

### ミドルウェア/ハンドラーラッパーの改善

withAuthAndErrorHandling のようなラッパー関数で、リクエストパスに基づいて context.params の型をより具体的に推論または検証する仕組みを導入する（例: Zod スキーマでパスパラメータも検証する）。

### Next.js の将来的な改善

Next.js 自体の型定義が将来的に改善され、より型安全なパラメータアクセスが可能になる可能性も注視します。

## AI推定栄養価のフォールバック利用 (優先度: 中)

### 背景

画像/テキスト入力時にAIが食品を認識するが、その食品が内部の食品データベース(DB)に存在しない場合がある。現状ではDBに存在しない食品の栄養価は記録されない。

### 目的

DBに食品が見つからない場合に、AIが同時に推定した栄養価（`aiEstimatedNutrition`）をフォールバックとして利用し、記録される栄養情報の網羅性を向上させる。

### 実装方針案

1.  **API (`/api/meals` POST) 修正:**
    *   フロントエンドから、編集後の食品リスト (`editedFoodItems`) に加えて、AIが推定した栄養価 (`aiEstimatedNutrition`) も受け取る。
    *   `NutritionService.calculateNutritionFromNameQuantities` を呼び出し、DBベースの栄養計算結果と、**DBマッチングに失敗した食品名のリスト**を取得する（`calculateNutritionFromNameQuantities` の戻り値修正が必要）。
    *   DBマッチングに失敗した食品名に対応するAI推定栄養価を `aiEstimatedNutrition` から抽出する。
    *   DB計算結果と、抽出したAI推定栄養価を**マージ**して最終的な `StandardizedMealNutrition` を生成する。
    *   マージ後の `StandardizedMealNutrition` をDBに保存する。

2.  **`NutritionService.calculateNutritionFromNameQuantities` 修正:**
    *   戻り値 (`NutritionCalculationResult`) に、DBマッチングに成功した食品と失敗した食品を区別できる情報（例: `matchResults` 配列の各要素に `success: boolean` フラグを追加、または `notFoundFoodNames: string[]` を追加）を含めるように修正する。

3.  **AI推定栄養価 (`aiEstimatedNutrition`) の形式:**
    *   AI (Gemini) が返す `estimatedNutrition` の形式を確認・定義する必要がある。理想的には、認識された食品名ごとに栄養価リスト (`{ foodName: string, nutrients: Nutrient[] }[]` のような形式) が返ってくることが望ましい。現在のプロンプト (`food-analysis/v1.ts` や `text-input-analysis/v1.ts`) の修正が必要になる可能性がある。

4.  **マージロジック:**
    *   DB計算結果とAI推定値のマージ方法を詳細に設計する。
    *   単純な合算ではなく、見つかった食品はDB値、見つからなかった食品はAI推定値を使用する。
    *   量を考慮したスケーリングが必要。AI推定値が100gあたりなどで返ってくる場合、ユーザーが編集した量に合わせてスケーリングする必要がある。
    *   信頼度 (`confidence`) の扱いも考慮する (AI推定値の信頼度は低めにするなど)。

### 検討事項

*   AI推定値の精度と信頼性をどうユーザーに伝えるか。
*   AI推定値とDB計算値が混在する場合のUI表示方法。
*   AIプロンプトの調整による `aiEstimatedNutrition` の形式制御。