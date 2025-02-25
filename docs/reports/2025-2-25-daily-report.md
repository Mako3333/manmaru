

# まんまるアプリ実装引継ぎレポート

◤◢◤◢◤◢◤◢◤◢◤◢◤◢

## 1. 実装概要

妊婦向け栄養管理アプリ「manmaru」のMVP実装において、Google Gemini 2.0 Flashを活用したAI機能を中心に実装しました。主な実装内容は以下の通りです：

- LangChain.jsとGemini APIの連携基盤
- 食事画像分析API
- レシピ推奨API
- 栄養ログ更新API

## 2. 実装済みコンポーネント

### 2.1 LangChain連携基盤
**ファイル**: `src/lib/langchain/langchain.ts`

- Gemini 2.0 Flash（`gemini-2.0-flash-001`）モデルの設定
- 画像処理ユーティリティ（Base64変換など）
- モデル生成関数と安全性設定

```typescript
export enum GeminiModel {
    PRO = "gemini-pro",
    VISION = "gemini-pro-vision",
    FLASH = "gemini-2.0-flash-001" // 正しいGemini 2.0 Flashモデル名
}
```

### 2.2 食事分析API
**ファイル**: `src/app/api/analyze-meal/route.ts`

- 食事画像のAI解析（Gemini Vision）
- 検出された食品から栄養素を計算
- 栄養データベースとのマッチング処理

### 2.3 レシピ推奨API
**ファイル**: `src/app/api/recommend-recipes/route.ts`

- ユーザーの不足栄養素に基づくレシピ提案
- Gemini 2.0 Flashを使用した最適なレシピ生成
- JSON形式でのレシピ情報返却

### 2.4 栄養ログ更新API
**ファイル**: `src/app/api/update-nutrition-log/route.ts`

- 日次の食事データから栄養摂取量を集計
- 推奨摂取量との比較による不足栄養素の特定
- Supabaseへの栄養ログ保存

### 2.5 栄養計算ユーティリティ
**ファイル**: `src/lib/nutrition/nutritionUtils.ts`

- 食品の量から栄養素を推定する関数
- 栄養関連の型定義
- 食品検出スキーマ

## 3. データフロー

1. **食事記録フロー**:
   - ユーザーが食事画像をアップロード
   - `analyze-meal` APIが画像をGemini Visionで解析
   - 検出された食品から栄養素を計算
   - 結果をフロントエンドに返却し、確認・編集後に保存

2. **栄養ログ更新フロー**:
   - ユーザーの食事記録から `update-nutrition-log` APIが栄養摂取量を集計
   - 不足栄養素を特定
   - 日次の栄養ログをSupabaseに保存

3. **レシピ推奨フロー**:
   - 不足栄養素に基づき `recommend-recipes` APIがGemini 2.0 Flashでレシピを生成
   - 生成されたレシピをフロントエンドに表示

## 4. 実装上の注意点

### 4.1 環境変数
- `GEMINI_API_KEY`: Google Gemini APIキー
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL
- `SUPABASE_SERVICE_KEY`: Supabaseサービスキー

### 4.2 栄養データベース
- `src/data/nutrition_data.json` に基本的な食品の栄養データを格納
- 食品名と栄養素（カロリー、タンパク質、鉄分、葉酸、カルシウム）の対応を定義

### 4.3 エラーハンドリング
- 各APIエンドポイントで適切なエラーハンドリングを実装
- AI解析失敗時のフォールバック処理を考慮

## 5. 未実装・課題事項

1. **フロントエンドとの連携**:
   - APIエンドポイントは実装済みですが、フロントエンドからの呼び出しテストが未実施

2. **栄養データの精度向上**:
   - 現状の栄養データベースは限定的
   - 食品の量の推定精度向上が必要

3. **パフォーマンス最適化**:
   - Gemini APIの応答時間が長い場合の対策
   - キャッシュ戦略の検討

## 6. 次のテストステップ

### 6.1 APIテスト

1. **単体テスト**:
   ```bash
   # 食事分析APIのテスト
   curl -X POST http://localhost:3000/api/analyze-meal \
     -H "Content-Type: application/json" \
     -d '{"imageBase64": "BASE64_ENCODED_IMAGE", "mealType": "breakfast"}'
   
   # レシピ推奨APIのテスト
   curl -X POST http://localhost:3000/api/recommend-recipes \
     -H "Content-Type: application/json" \
     -d '{"userId": "USER_ID", "servings": 2}'
   
   # 栄養ログ更新APIのテスト
   curl -X POST http://localhost:3000/api/update-nutrition-log \
     -H "Content-Type: application/json" \
     -d '{"userId": "USER_ID"}'
   ```

2. **フロントエンド連携テスト**:
   - `useMeals.ts`フックからの食事分析API呼び出しテスト
   - `useNutrition.ts`フックからの栄養ログ更新API呼び出しテスト
   - 画像アップロードから食品検出までの一連のフロー確認

3. **エラーケーステスト**:
   - 画像なしでのAPI呼び出し
   - 無効なユーザーIDでのAPI呼び出し
   - Gemini APIの応答タイムアウト時の挙動確認

### 6.2 統合テスト

1. **エンドツーエンドフロー**:
   - ユーザー登録→食事記録→栄養ログ確認→レシピ推奨の一連のフロー確認

2. **モバイル表示テスト**:
   - 実機でのレスポンシブ表示確認
   - 画像アップロード機能の動作確認

3. **パフォーマンステスト**:
   - API応答時間の計測
   - 複数ユーザーによる同時アクセス時の挙動確認

### 6.3 テスト環境設定

```bash
# 開発環境での実行
npm run dev

# テスト用データの準備
# Supabaseにテスト用ユーザーとサンプル食事データを登録

# APIテスト用のスクリプト実行
npm run test:api

# E2Eテスト実行
npm run test:e2e
```

## 7. 今後の展開

1. **UI/UX改善**:
   - ローディング表示の最適化
   - エラーメッセージの改善

2. **機能拡張**:
   - 妊娠週数に応じた栄養アドバイス
   - 食事履歴の可視化
   - お気に入りレシピの保存

3. **パフォーマンス向上**:
   - 画像圧縮処理の追加
   - APIレスポンスのキャッシュ

以上が現在の実装状況と次のステップです。引き続き、フロントエンドとの連携テストを進め、MVPの完成を目指します。
