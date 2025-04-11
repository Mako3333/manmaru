# 栄養計算アルゴリズム

## 概要

manmaruアプリケーションにおける栄養計算アルゴリズムは、ユーザーが記録した食事（写真またはテキスト入力）から栄養素の摂取量を推定し、個々の妊婦さんにとっての栄養充足状況を評価するための中核機能です。Phase 2.1の実装により、このアルゴリズムは大幅に改善され、特に以下の点で進化しました：

1. データ構造の標準化：`StandardizedMealNutrition`型への統一
2. AI推定値の直接活用と食品マッチングの組み合わせによるハイブリッドアプローチ
3. 食事全体と個別食品の両方のレベルでの栄養素管理の実現

このドキュメントでは、現在の栄養計算アルゴリズムの仕組み、使用されるデータ構造、計算プロセス、および既知の制約について説明します。

## データ構造

### 標準化された栄養データ型：`StandardizedMealNutrition`

栄養計算のコア部分では、`StandardizedMealNutrition`型（`src/types/nutrition.ts`で定義）を採用しています。この型は以下の特徴を持ちます：

```typescript
interface StandardizedMealNutrition {
  totalCalories: number;                 // 総カロリー (kcal)
  totalNutrients: Nutrient[];            // 全栄養素のリスト
  foodItems: FoodItem[];                 // 個別食品アイテムのリスト
  reliability?: { confidence: number };  // 栄養計算の信頼性スコア
  pregnancySpecific?: {                 // 妊娠特有の栄養充足率情報
    nutrientSufficiency: {
      [key: string]: { percentage: number, isRecommended: boolean }
    }
  };
}

// 個別の栄養素データ
interface Nutrient {
  name: string;   // 栄養素名（例: "たんぱく質", "鉄分"）
  value: number;  // 数値
  unit: string;   // 単位（例: "g", "mg", "μg"）
}

// 個別の食品アイテム
interface FoodItem {
  id: string;
  name: string;           // 食品名
  amount: number;         // 量
  unit: string;           // 単位（例: "g", "個", "人前"）
  nutrition: FoodItemNutrition; // 食品単体の栄養情報
}

// 食品単体の栄養情報
interface FoodItemNutrition {
  calories: number;       // カロリー
  nutrients: Nutrient[];  // 栄養素リスト
  servingSize?: {         // 提供量情報
    value: number;
    unit: string;
  };
}
```

この構造により、食事全体の総栄養素と各食品アイテムの詳細な栄養情報を同時に管理できるようになりました。フェーズ2実装では、アプリケーション内の食事記録フロー全体で`StandardizedMealNutrition`型を一貫して使用するように修正されました。

## 栄養計算アルゴリズムのフロー

現在の栄養計算は以下のステップで行われます：

### 1. 食品特定段階

**写真入力の場合：**
1. ユーザーが食事の写真をアップロード
2. `/api/v2/meal/analyze`エンドポイントを呼び出し
3. `GeminiService.analyzeMealImage`を通じてAI（Gemini Vision）に画像を送信
4. AIは写真に含まれる食品を特定し、リスト（`foods: [{ foodName, quantityText, confidence }]`）として返却
5. **重要な変更点**：フェーズ2実装により、AIプロンプトから栄養素推定部分を削除し、食品特定に集中する形に修正

**テキスト入力の場合：**
1. ユーザーが食事内容をテキストで入力
2. `/api/v2/meal/text-analyze`エンドポイントを呼び出し
3. `GeminiService.analyzeMealText`を通じてAI（Gemini）にテキストを送信
4. AIはテキストから食品を特定し、リスト（`foods: [{ foodName, quantityText, confidence }]`）として返却

### 2. 栄養計算段階

1. 特定された食品リストを`NutritionService.calculateNutrition`に渡す
2. 各食品に対して:
   a. 食品データベース（FOODEX）とのマッチングを試行
   b. AIによる直接解析結果と食品DBのマッチング結果を統合
   c. 適切な量単位変換を適用
3. 個別食品の栄養情報を基に`foodItems`配列を構築
4. 全食品の栄養素を合計して`totalNutrients`と`totalCalories`を算出
5. `StandardizedMealNutrition`オブジェクトを生成・返却

### 3. データ保存段階

1. フロントエンドで、必要に応じて`EnhancedRecognitionEditor`で食品データを編集
2. 保存時には`StandardizedMealNutrition`型のデータを直接APIに送信（フェーズ2実装による改善点）
3. `/api/meals`エンドポイントで`MealService.saveMealWithNutrition`を呼び出し
4. `meals`テーブルの`nutrition_data`カラムに`StandardizedMealNutrition`型のデータをJSONB形式で保存
5. **重要な変更点**：フェーズ2実装により、`meal_nutrients`テーブルへの書き込みが廃止され、すべての栄養データは`meals.nutrition_data`カラムに格納されるようになった

## 栄養計算の精度と妊婦向け栄養管理

manmaruアプリケーションの特性上、栄養計算は一般的な栄養素（カロリー、タンパク質、脂質、炭水化物など）に加え、妊婦に特に重要な栄養素（鉄、葉酸、カルシウム、ビタミンDなど）を重点的に計算・表示します。

### 妊婦向け栄養管理の特別対応

1. **重点栄養素**:
   - 鉄分（非ヘム鉄・ヘム鉄）
   - 葉酸
   - カルシウム
   - ビタミンD
   - タンパク質
   - 食物繊維

2. **妊娠週数別の推奨摂取量**: 
   - 妊娠初期（〜15週）
   - 妊娠中期（16〜27週）
   - 妊娠後期（28週〜）

3. **表示方法**:
   - 摂取栄養素の充足率（%）を視覚的に表示
   - 不足している栄養素に警告表示

### AI直接推定値と食品マッチングの統合アプローチ

フェーズ2実装では、AIの栄養素直接推定機能をクライアント側で活用しつつも、サーバー側では食品データベースとのマッチングを主体とするハイブリッドアプローチを採用しています。

1. **食品DBマッチングの優先度向上**:
   - 食品名のマッチング精度向上のための前処理（料理名分解、同義語対応など）の強化
   - マッチングアルゴリズムの最適化（類似度計算の改善）

2. **信頼性スコアの改善**:
   - マッチング確度に基づく信頼性スコアの算出
   - ユーザーへの透明性向上のためのUI表示の改善

## フェーズ2実装による主な改善点

フェーズ2実装では、以下の重要な改善が行われました：

1. **`StandardizedMealNutrition`型への一貫した移行**:
   - 食事記録フロー全体（写真入力・テキスト入力）で一貫して`StandardizedMealNutrition`型を使用
   - API応答から受け取った`StandardizedMealNutrition`型のデータを直接活用するよう修正

2. **AIプロンプトの最適化**:
   - 食品分析AIプロンプトから栄養素推定部分を削除し、食品特定に集中
   - AIの役割を明確化し、各コンポーネントの責任を整理

3. **データ保存プロセスの簡素化**:
   - `meal_nutrients`テーブルへの書き込みを削除
   - すべての栄養データを`meals.nutrition_data`カラムに`StandardizedMealNutrition`形式で保存

4. **型変換の削減**:
   - 不要な型変換（`prepareForApiRequest`など）を削除
   - データフローの簡素化によるバグリスクの低減

5. **フェーズ2.2での安定化と改善（最新）**:
   - テキスト入力フローにおける`StandardizedMealNutrition`型のバリデーション強化
   - API応答の厳密な検証により、不正なデータ形式を早期検出
   - 一連のフローにおけるエラーハンドリングの強化と改善
   - 特に以下の検証が追加されました：
     ```typescript
     // StandardizedMealNutrition型の検証例（テキスト解析API）
     if (!standardizedNutrition ||
         typeof standardizedNutrition.totalCalories !== 'number' ||
         !Array.isArray(standardizedNutrition.totalNutrients) ||
         !Array.isArray(standardizedNutrition.foodItems) ||
         !standardizedNutrition.reliability ||
         typeof standardizedNutrition.reliability.confidence !== 'number') {
         throw new AppError({/*...エラー詳細...*/});
     }
     ```

これらの改善により、食事記録フローの安定性が向上し、栄養計算結果の一貫性が強化されました。特にフェーズ2.2での実装によって、テキスト入力から保存までの一連のデータフローにおける型の一貫性とエラー耐性が大幅に向上しました。

## テキスト入力フローの最適化（フェーズ2.2）

フェーズ2.2の主要な目標は、テキスト入力による食事記録フローの安定化でした。具体的には以下の改善が実施されました：

1. **テキスト入力フローの詳細化**:
   ```
   ユーザーテキスト入力 → 食品リスト(FoodItem[]) → テキスト解析API 
   → StandardizedMealNutrition取得 → 検証 → 保存API → DB保存
   ```

2. **厳密なデータ検証**:
   - フロントエンド: 入力データの空チェック、最小限の入力検証
   - API層: `StandardizedMealNutrition`形式の厳密な検証
   - サービス層: DB保存前の最終的なデータ整合性チェック

3. **エラーリカバリ戦略**:
   - 各層での詳細なエラーメッセージとユーザーフレンドリーな通知
   - エラー発生時のデータ保持と再試行機能
   - エラーログの拡充によるデバッグ容易性の向上

4. **型安全性の強化**:
   - TypeScriptの型システムを最大限活用
   - 実行時の型チェックと静的型チェックの組み合わせ
   - 想定外のデータ形式への堅牢な対応

これらのフェーズ2.2での最適化により、テキスト入力から栄養計算、DB保存までの一連のフローが安定し、`StandardizedMealNutrition`型を一貫して使用する体制が確立されました。

## 今後の課題

現在の栄養計算アルゴリズムには以下の制約があります：

1. **食品認識の精度**: AIによる食品認識は、特に複雑な料理や複数の食品が混在する状況で誤認識が発生することがあります。

2. **食品DBのカバレッジ**: 現在の食品データベースでは、日本の一般的な料理の一部がカバーされていないことがあります。特に、地域特有の料理や特定の調理法については対応が十分でない場合があります。

3. **量の換算精度**: 「一人前」や「お茶碗一杯」などの曖昧な量表現を正確なグラム数に変換する際の精度に課題があります。

4. **妊婦特有の栄養充足率計算**: 現在の`pregnancySpecific`フィールドの計算ロジックは未最適化であり、完全に正確な充足率を表現できていない可能性があります。

### 今後の改善方針

1. **AIモデルの改善**:
   - より高精度な食品認識モデルの導入
   - 複合料理の構成食材推定の精度向上

2. **食品データベースの拡充**:
   - 日本の一般家庭料理のカバレッジ拡大
   - ユーザーフィードバックに基づくデータ補完

3. **量換算アルゴリズムの精緻化**:
   - より正確な標準提供量データベースの構築
   - 地域・料理ジャンル別の量換算係数の導入

4. **妊婦特有の栄養管理機能強化**:
   - 妊娠週数に応じたより詳細な栄養推奨値の適用
   - 個人差（体重、活動量等）を考慮した推奨量の調整
   - 栄養バランスを考慮した食事アドバイス機能

5. **データフローのさらなる最適化**:
   - 残りのアプリ機能における`StandardizedMealNutrition`型への完全移行
   - 栄養管理ダッシュボードでのデータ表示とフィルタリングの改善
   - レガシーコードと変換関数の整理・削除

