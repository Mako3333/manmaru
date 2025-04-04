# システムアーキテクチャ詳細

## 1. コアコンポーネント

### 1.1 栄養計算システム
- **src/lib/nutrition/**
  - `nutrition-service.ts` - 栄養計算サービスのインターフェース定義
  - `nutrition-service-impl.ts` - 栄養計算の具体的な実装
  - `nutrition-service-factory.ts` - 栄養計算サービスのファクトリー
  - `quantity-parser.ts` - 食品量の解析ユーティリティ
  - `nutrition-type-utils.ts` - 栄養データの型変換ユーティリティ
  - `nutrition-utils.ts` - 一般的な栄養計算ユーティリティ
  - `nutrition-display-utils.ts` - 栄養情報の表示用ユーティリティ

### 1.2 食品データ管理
- **src/lib/food/**
  - `food-repository.ts` - 食品データアクセスのインターフェース
  - `basic-food-repository.ts` - 基本的な食品リポジトリの実装
  - `food-matching-service.ts` - 食品マッチングのインターフェース
  - `food-matching-service-impl.ts` - 食品マッチングの実装
  - `food-input-parser.ts` - ユーザー入力の食品情報解析

### 1.3 AI解析システム
- **src/lib/ai/**
  - `ai-service.interface.ts` - AI解析サービスのインターフェース
  - `gemini-service.ts` - Gemini AIの実装
  - `prompts/` - AIプロンプトテンプレート
    - `food-analysis/v1.ts` - 食品解析プロンプト
    - `nutrition-advice/v1.ts` - 栄養アドバイスプロンプト

## 2. APIエンドポイント

### 2.1 栄養関連API
- **src/app/api/v2/**
  - `food/parse/route.ts` - 食品テキスト解析API
  - `image/analyze/route.ts` - 食品画像解析API
  - `meal/analyze/route.ts` - 食事全体の解析API
  - `meal/text-analyze/route.ts` - テキストベースの食事解析API

### 2.2 レシピ関連API
- **src/app/api/recipes/**
  - `calculate-nutrients/route.ts` - レシピの栄養価計算
  - `parse-social-url/route.ts` - SNSレシピURLの解析

## 3. フロントエンドコンポーネント

### 3.1 栄養情報表示
- **src/components/nutrition/**
  - `nutrition-summary.tsx` - 栄養概要の表示
  - `reliability-indicator.tsx` - 信頼度インジケータ
  - `NutritionDataDisplay.tsx` - 詳細な栄養データ表示

### 3.2 食品入力・編集
- **src/components/food/**
  - `food-edit-modal.tsx` - 食品情報編集モーダル
  - `food-list-editor.tsx` - 食品リストエディタ
  - `confidence-indicator.tsx` - 確信度表示
  - `food-match-badge.tsx` - 食品マッチング結果バッジ

### 3.3 食事記録
- **src/components/meals/**
  - `meal-photo-input.tsx` - 食事写真入力
  - `recognition-editor.tsx` - 認識結果エディタ
  - `enhanced-recognition-editor.tsx` - 拡張認識エディタ
  - `meal-type-selector.tsx` - 食事種類選択

## 4. ダッシュボード機能

### 4.1 栄養管理
- **src/components/dashboard/**
  - `daily-nutrition-scores.tsx` - 日々の栄養スコア
  - `nutrition-chart.tsx` - 栄養バランスチャート
  - `nutrition-advice.tsx` - 栄養アドバイス表示
  - `meal-history-list.tsx` - 食事履歴リスト

### 4.2 データ型定義
- **src/types/**
  - `nutrition.ts` - 栄養関連の型定義
  - `food.ts` - 食品関連の型定義
  - `meal.ts` - 食事関連の型定義
  - `recipe.ts` - レシピ関連の型定義

## 5. エラー処理

### 5.1 エラー定義
- **src/lib/error/**
  - `types/nutrition-errors.ts` - 栄養計算関連のエラー定義
  - `types/ai-errors.ts` - AI解析関連のエラー定義
  - `codes/error-codes.ts` - エラーコード定義

## 6. テスト構成

### 6.1 単体テスト
- **__tests__/lib/nutrition/**
  - `test.ts` - 栄養計算システムのテスト
  - `nutrition-utils.test.ts` - ユーティリティのテスト

### 6.2 システムテスト
- **src/lib/tests/**
  - `nutrition-system-test.ts` - 栄養計算システムの統合テスト