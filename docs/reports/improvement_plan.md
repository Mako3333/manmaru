# 食事解析システム改善計画

## 1. API設定の整理

### 1.1 環境変数の統一
```env
GEMINI_API_KEY=xxx  # Gemini APIキー（必須）
NUTRITION_DB_PATH=xxx  # 栄養データベースのパス（必須）
```

### 1.2 API設定の修正
- OpenAI APIキーチェックの削除
- 統一されたAPI設定の実装
- 環境変数の存在チェックの一元化

## 2. エラーハンドリングの強化

### 2.1 カスタムエラークラスの導入
```typescript
class FoodAnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'FoodAnalysisError';
  }
}
```

### 2.2 エラーケースの明確化
1. 設定エラー
   - API設定不足
   - データベース設定不足

2. 入力エラー
   - 画像データ不正
   - テキストデータ不正
   - リクエスト形式不正

3. AI解析エラー
   - API通信エラー
   - レスポンス形式エラー
   - タイムアウトエラー

4. データベースエラー
   - 読み込みエラー
   - マッチングエラー
   - データ不整合

### 2.3 エラーレスポンスの標準化
```typescript
interface ErrorResponse {
  code: string;        // エラーコード
  message: string;     // ユーザー向けメッセージ
  details?: unknown;   // 開発者向け詳細情報
  suggestions?: string[]; // 解決のための提案
}
```

## 3. JSON解析の改善

### 3.1 AIレスポンスパーサーの強化
```typescript
class AIResponseParser {
  static parseResponse(response: string): ParsedResponse {
    // 1. マークダウン解析
    // 2. JSON抽出
    // 3. スキーマ検証
    // 4. デフォルト値の補完
  }
}
```

### 3.2 スキーマ検証の強化
- より厳密なZodスキーマの定義
- バリデーションエラーの詳細なハンドリング
- デフォルト値の適切な設定

## 4. 栄養データベースの改善

### 4.1 データベース接続の安定化
- 読み込みエラー時のリトライ機能
- キャッシュ機能の実装
- 定期的な整合性チェック

### 4.2 マッチングアルゴリズムの改善
```typescript
class FoodMatcher {
  static findBestMatch(
    foodName: string,
    dbItems: NutritionDbItem[]
  ): MatchResult {
    // 1. 完全一致チェック
    // 2. 部分一致チェック
    // 3. レーベンシュタイン距離による類似度計算
    // 4. カテゴリベースのフォールバック
  }
}
```

## 5. 実装計画

### Phase 1: 基盤強化（1-2週間）
1. 環境変数の整理
2. カスタムエラークラスの実装
3. エラーハンドリングの統一

### Phase 2: 解析改善（2-3週間）
1. AIレスポンスパーサーの実装
2. スキーマ検証の強化
3. テストケースの拡充

### Phase 3: データベース改善（2-3週間）
1. データベース接続の安定化
2. マッチングアルゴリズムの改善
3. パフォーマンス最適化

### Phase 4: 統合テストと調整（1-2週間）
1. エンドツーエンドテスト
2. パフォーマンステスト
3. エラーケースの総合検証