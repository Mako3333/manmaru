# AIアドバイザー機能実装計画（未実装）

## 1. 概要
妊婦の栄養管理をサポートするAIアドバイザー機能を実装。食事記録や栄養バランスに基づいて、パーソナライズされたアドバイスを提供する。

## 2. 主要機能

### 2.1 アドバイスの種類
1. **日次栄養アドバイス**
   - その日の栄養摂取状況に基づくアドバイス
   - 不足している栄養素の補給方法提案
   - 食事バランスの改善提案

2. **食事ごとのアドバイス**
   - 食事記録直後のフィードバック
   - 次回の食事での改善ポイント
   - 具体的な食品提案

3. **妊娠週数別アドバイス**
   - 各週数で重要な栄養素の説明
   - 胎児の発育状況に応じたアドバイス
   - 時期特有の注意点

### 2.2 技術仕様
1. **使用API**
   - Gemini Pro API
   - プロンプトエンジニアリングによる最適化
   - レスポンスパーサーの実装

2. **データ連携**
   - Supabaseとの連携
   - キャッシュ戦略
   - エラーハンドリング

## 3. データベース設計

### 3.1 daily_nutrition_advice テーブル
```sql
CREATE TABLE daily_nutrition_advice (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  advice_type TEXT NOT NULL, -- 'daily', 'meal', 'pregnancy_week'
  advice_content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, advice_date, advice_type)
);

-- RLSポリシー
ALTER TABLE daily_nutrition_advice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分のアドバイスのみ参照可能" 
ON daily_nutrition_advice FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のアドバイスのみ作成可能" 
ON daily_nutrition_advice FOR INSERT 
WITH CHECK (auth.uid() = user_id);
```

## 4. API設計

### 4.1 アドバイス生成API
```typescript
// /api/nutrition/generate-advice
interface GenerateAdviceRequest {
  userId: string;
  adviceType: 'daily' | 'meal' | 'pregnancy_week';
  nutritionData?: NutritionData;
  pregnancyWeek?: number;
}

interface GenerateAdviceResponse {
  success: boolean;
  advice?: {
    id: string;
    advice_content: string;
    created_at: string;
  };
  error?: string;
}
```

### 4.2 アドバイス取得API
```typescript
// /api/nutrition/get-advice
interface GetAdviceRequest {
  userId: string;
  date: string;
  type: 'daily' | 'meal' | 'pregnancy_week';
}

interface GetAdviceResponse {
  success: boolean;
  advice?: {
    id: string;
    advice_content: string;
    is_read: boolean;
    created_at: string;
  };
  error?: string;
}
```

## 5. フロントエンド実装

### 5.1 AIアドバイスコンポーネント
```tsx
// components/nutrition/ai-advisor.tsx
interface AIAdvisorProps {
  adviceType: 'daily' | 'meal' | 'pregnancy_week';
  className?: string;
}

// コンポーネントの実装内容は未定
```

### 5.2 表示場所
1. **ダッシュボード**
   - 日次の栄養アドバイス
   - 妊娠週数に応じたアドバイス

2. **食事記録後**
   - 食事内容に基づくアドバイス
   - 次回の改善提案

## 6. プロンプト設計

### 6.1 日次アドバイス
```typescript
const dailyPrompt = `
あなたは妊婦向けの栄養アドバイザーです。以下の情報に基づいて、親しみやすく、温かみのある短い栄養アドバイスを作成してください。

妊娠週数: ${pregnancyWeek}週（第${trimester}期）
本日の栄養摂取状況:
カロリー: 目標の${nutritionData.calories_percent}%
タンパク質: 目標の${nutritionData.protein_percent}%
鉄分: 目標の${nutritionData.iron_percent}%
葉酸: 目標の${nutritionData.folic_acid_percent}%
カルシウム: 目標の${nutritionData.calcium_percent}%
ビタミンD: 目標の${nutritionData.vitamin_d_percent}%

特に不足している栄養素や過剰な摂取に注意するようアドバイスし、妊娠${pregnancyWeek}週目に重要な栄養素について触れてください。
アドバイスは200文字以内で、親しみやすく実用的なものにしてください。専門用語は避け、簡単な言葉で説明してください。
`;
```

### 6.2 食事アドバイス
```typescript
const mealPrompt = `
あなたは妊婦向けの栄養アドバイザーです。以下の食事内容に基づいて、次回の食事で補うと良い栄養素についての親しみやすいアドバイスを作成してください。

妊娠週数: ${pregnancyWeek}週（第${trimester}期）
今回の食事内容: ${foods.map(f => f.name).join('、')}

この食事の良い点と、次回補うと良い栄養素について具体的な食品例を挙げて150文字以内でアドバイスしてください。
`;
```

## 7. 実装優先順位

### フェーズ1: 基本機能実装（2週間）
1. データベース構築
2. アドバイス生成API実装
3. 基本UIコンポーネント作成

### フェーズ2: 機能拡張（1週間）
1. プロンプト最適化
2. レスポンス品質向上
3. エラーハンドリング強化

### フェーズ3: UI/UX改善（1週間）
1. アニメーション追加
2. インタラクション改善
3. レスポンシブ対応

## 8. 評価指標
1. アドバイスの的確性
2. レスポンス生成時間
3. ユーザー満足度
4. エラー発生率

## 9. 制限事項
1. プロンプトの文字数制限
2. API呼び出し頻度制限
3. レスポンス生成時間の目標（3秒以内）