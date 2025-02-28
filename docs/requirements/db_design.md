# 妊婦向け栄養管理アプリ 開発計画書

## 目的
忙しい妊婦が短時間で栄養バランスを管理し、献立に活かせるアプリを開発。手間を最小限にした食事記録・献立提案・食材管理の提供。

## 現状と次のステップ
- ユーザー認証：完了
- 基本UIコンポーネント：実装済み
- 食事記録機能：一部実装（画像解析API連携完了）
- データベース設計：改善必要

## 実装計画

### フェーズ1: データベース最適化（1週間）
1. **profilesテーブルの拡張**
   ```sql
   ALTER TABLE profiles 
   ADD COLUMN due_date DATE,                      -- 出産予定日
   ADD COLUMN trimester SMALLINT GENERATED ALWAYS AS (
     CASE 
       WHEN pregnancy_week BETWEEN 1 AND 13 THEN 1
       WHEN pregnancy_week BETWEEN 14 AND 27 THEN 2
       WHEN pregnancy_week >= 28 THEN 3
       ELSE NULL
     END
   ) STORED,                                      -- トライメスター（自動計算）
   ADD COLUMN dietary_restrictions TEXT[],        -- 食事制限・アレルギー
   ADD COLUMN auto_update_week BOOLEAN DEFAULT TRUE; -- 週数自動更新フラグ
   ```

2. **栄養素関連テーブルの追加**
   - `nutrition_targets`テーブル（トライメスター別推奨摂取量）
   - `meal_nutrients`テーブル（食事ごとの栄養素データ）
   - `weight_logs`テーブル（体重記録） 

3. **ビュー・関数の追加**
   - 日次栄養集計ビュー
   - 栄養目標達成率ビュー
   - 妊娠週数自動更新関数

### フェーズ2: APIエンドポイントの修正（3日間）
1. **`/api/analyze-meal`エンドポイントの修正**
   - プロンプトを妊婦向けに最適化
   - 栄養素解析結果をDB構造に合わせて形式化

2. **栄養集計APIの実装**
   - 日次・週次の栄養摂取状況集計
   - 目標に対する進捗計算

3. **レシピ推奨APIの実装**
   - 不足栄養素を補うレシピ提案ロジック

### フェーズ3: フロントエンド開発（1週間）
1. **プロフィール設定画面の拡張**
   - 出産予定日入力フォーム
   - 食事制限・アレルギー設定

2. **栄養管理ダッシュボードの開発**
   - 栄養バランス可視化チャート
   - 目標達成度プログレスバー
   - 週間・月間レポート

3. **レシピ提案機能の実装**
   - 不足栄養素に基づくレシピ表示
   - レシピ詳細画面

### フェーズ4: 統合とテスト（3日間）
1. **エンドツーエンドフロー検証**
   - 食事記録→栄養分析→レシピ提案フロー
   - データ同期の確認

2. **パフォーマンス最適化**
   - API応答速度の改善
   - クエリ最適化

3. **エラーハンドリング強化**
   - エッジケース対応
   - ユーザーフィードバック改善

## 詳細実装手順

### 1. データベース構造の更新
```bash
# Supabase SQLエディタで実行するスクリプトを作成

# 1. profilesテーブル拡張
ALTER TABLE profiles 
ADD COLUMN due_date DATE,
ADD COLUMN trimester SMALLINT GENERATED ALWAYS AS (
  CASE 
    WHEN pregnancy_week BETWEEN 1 AND 13 THEN 1
    WHEN pregnancy_week BETWEEN 14 AND 27 THEN 2
    WHEN pregnancy_week >= 28 THEN 3
    ELSE NULL
  END
) STORED,
ADD COLUMN dietary_restrictions TEXT[],
ADD COLUMN auto_update_week BOOLEAN DEFAULT TRUE;

# 2. nutrition_targetsテーブル作成
CREATE TABLE nutrition_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trimester SMALLINT NOT NULL CHECK (trimester IN (1, 2, 3)),
  calories INTEGER NOT NULL,
  protein NUMERIC NOT NULL,
  iron NUMERIC NOT NULL,
  folic_acid NUMERIC NOT NULL,
  calcium NUMERIC NOT NULL,
  vitamin_d NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

# デフォルト値挿入
INSERT INTO nutrition_targets 
(trimester, calories, protein, iron, folic_acid, calcium, vitamin_d)
VALUES
(1, 2000, 75, 27, 600, 1000, 15),
(2, 2200, 85, 27, 600, 1000, 15),
(3, 2400, 95, 27, 600, 1000, 15);

# 3. meal_nutrientsテーブル作成
CREATE TABLE meal_nutrients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  calories INTEGER NOT NULL,
  protein NUMERIC(6,2) NOT NULL,
  iron NUMERIC(6,2) NOT NULL,
  folic_acid NUMERIC(6,2) NOT NULL,
  calcium NUMERIC(6,2) NOT NULL,
  vitamin_d NUMERIC(6,2) NOT NULL,
  confidence_score NUMERIC(4,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

# 4. weight_logsテーブル作成
CREATE TABLE weight_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight NUMERIC NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, log_date)
);

# 5. ビュー・関数の作成
# 栄養目標達成率ビュー
CREATE OR REPLACE VIEW nutrition_goal_progress AS
SELECT 
  m.user_id,
  p.trimester,
  m.meal_date,
  nt.calories AS target_calories,
  nt.protein AS target_protein,
  nt.iron AS target_iron,
  nt.folic_acid AS target_folic_acid,
  nt.calcium AS target_calcium,
  nt.vitamin_d AS target_vitamin_d,
  SUM(mn.calories) AS actual_calories,
  SUM(mn.protein) AS actual_protein,
  SUM(mn.iron) AS actual_iron,
  SUM(mn.folic_acid) AS actual_folic_acid,
  SUM(mn.calcium) AS actual_calcium,
  SUM(mn.vitamin_d) AS actual_vitamin_d,
  ROUND((SUM(mn.calories)::NUMERIC / NULLIF(nt.calories, 0) * 100)) AS calories_percent,
  ROUND((SUM(mn.protein)::NUMERIC / NULLIF(nt.protein, 0) * 100)) AS protein_percent,
  ROUND((SUM(mn.iron)::NUMERIC / NULLIF(nt.iron, 0) * 100)) AS iron_percent,
  ROUND((SUM(mn.folic_acid)::NUMERIC / NULLIF(nt.folic_acid, 0) * 100)) AS folic_acid_percent,
  ROUND((SUM(mn.calcium)::NUMERIC / NULLIF(nt.calcium, 0) * 100)) AS calcium_percent,
  ROUND((SUM(mn.vitamin_d)::NUMERIC / NULLIF(nt.vitamin_d, 0) * 100)) AS vitamin_d_percent
FROM meals m
JOIN profiles p ON m.user_id = p.user_id
JOIN meal_nutrients mn ON m.id = mn.meal_id
JOIN nutrition_targets nt ON p.trimester = nt.trimester
GROUP BY m.user_id, p.trimester, m.meal_date, nt.calories, nt.protein, nt.iron, nt.folic_acid, nt.calcium, nt.vitamin_d;

# 妊娠週数自動更新関数
CREATE OR REPLACE FUNCTION update_pregnancy_weeks() RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET pregnancy_week = 40 - FLOOR(EXTRACT(DAY FROM (due_date - CURRENT_DATE)) / 7)
  WHERE auto_update_week = TRUE AND due_date > CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
```

### 2. 型定義の更新（TypeScript）
```typescript
// src/types/user.ts
export interface UserProfile {
  id: string;
  user_id: string;
  age: number;
  pregnancy_week: number;
  trimester: number; // 新規: 自動計算
  height: number;
  weight: number;
  due_date: string; // 新規
  dietary_restrictions: string[]; // 新規
  adult_family_members: number;
  child_family_members: number;
  auto_update_week: boolean; // 新規
  created_at: string;
  updated_at: string;
}

// src/types/nutrition.ts
export interface NutritionData {
  calories: number;
  protein: number;
  iron: number;
  folic_acid: number;
  calcium: number;
  vitamin_d: number;
  confidence_score?: number;
}

export interface NutritionGoal extends NutritionData {
  trimester: number;
}

export interface NutritionProgress {
  user_id: string;
  meal_date: string;
  trimester: number;
  target_calories: number;
  target_protein: number;
  target_iron: number;
  target_folic_acid: number;
  target_calcium: number;
  target_vitamin_d: number;
  actual_calories: number;
  actual_protein: number;
  actual_iron: number;
  actual_folic_acid: number;
  actual_calcium: number;
  actual_vitamin_d: number;
  calories_percent: number;
  protein_percent: number;
  iron_percent: number;
  folic_acid_percent: number;
  calcium_percent: number;
  vitamin_d_percent: number;
}
```

### 3. API改善

```typescript
// src/app/api/analyze-meal/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createImageContent } from '@/lib/utils/image-utils';

export async function POST(request: Request) {
  try {
    const { image, mealType } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: '画像データが含まれていません' },
        { status: 400 }
      );
    }

    // Gemini APIセットアップ
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: { temperature: 0.4 }
    });

    // 画像コンテンツの準備
    const imageContent = createImageContent(image);
    
    // 栄養素に焦点を当てたプロンプト
    const prompt = `
      この食事の写真から含まれている食品を識別し、栄養情報を推定してください。
      食事タイプは「${mealType}」です。

      特に妊婦に重要な栄養素に焦点を当てて詳細に分析してください:
      - 鉄分: 貧血予防に重要（mg）
      - 葉酸: 神経管閉鎖障害予防に必須（μg）
      - カルシウム: 骨の発達に必要（mg）
      - ビタミンD: カルシウム吸収を助ける（μg）
      - タンパク質: 胎児の発育に重要（g）
      - カロリー: 適切なエネルギー摂取（kcal）

      以下の形式でJSON形式で回答してください:
      {
        "foods": [
          {"name": "食品名", "quantity": "量の目安", "confidence": 信頼度(0.0-1.0)}
        ],
        "nutrition": {
          "calories": カロリー推定値,
          "protein": タンパク質(g),
          "iron": 鉄分(mg),
          "folic_acid": 葉酸(μg),
          "calcium": カルシウム(mg),
          "vitamin_d": ビタミンD(μg),
          "confidence_score": 信頼度(0.0-1.0)
        }
      }
    `;

    // Gemini APIを呼び出し
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: imageContent }
          ]
        }
      ]
    });

    const responseText = result.response.text();
    
    // JSONレスポンスの抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('APIからの応答を解析できませんでした');
    }
    
    const jsonResponse = JSON.parse(jsonMatch[0]);

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('画像解析エラー:', error);
    return NextResponse.json(
      { error: '画像の解析に失敗しました' },
      { status: 500 }
    );
  }
}
```

### 4. フロントエンド対応

```typescript
// src/lib/api.ts に追加
// 食事データ保存時に栄養情報も分離して保存する関数
export const saveMealWithNutrients = async (mealData) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('ログインセッションが無効です');
    }

    // 1. meals テーブルに挿入
    const { data: mealRecord, error: mealError } = await supabase
      .from('meals')
      .insert({
        user_id: session.user.id,
        meal_type: mealData.meal_type,
        meal_date: mealData.meal_date || new Date().toISOString().split('T')[0],
        photo_url: mealData.photo_url,
        food_description: { items: mealData.foods },
        nutrition_data: mealData.nutrition,
        servings: mealData.servings || 1
      })
      .select()
      .single();

    if (mealError) throw mealError;
    
    // 2. meal_nutrients テーブルに挿入
    const { error: nutrientError } = await supabase
      .from('meal_nutrients')
      .insert({
        meal_id: mealRecord.id,
        calories: mealData.nutrition.calories,
        protein: mealData.nutrition.protein,
        iron: mealData.nutrition.iron,
        folic_acid: mealData.nutrition.folic_acid,
        calcium: mealData.nutrition.calcium,
        vitamin_d: mealData.nutrition.vitamin_d || 0,
        confidence_score: mealData.nutrition.confidence_score
      });

    if (nutrientError) throw nutrientError;

    return { success: true, data: mealRecord };
  } catch (error) {
    console.error('食事データ保存エラー:', error);
    throw error;
  }
};

// 栄養目標進捗の取得
export const getNutritionProgress = async (date) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('ログインセッションが無効です');
    }

    const { data, error } = await supabase
      .from('nutrition_goal_progress')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('meal_date', date)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    return data || null;
  } catch (error) {
    console.error('栄養目標進捗取得エラー:', error);
    throw error;
  }
};
```

## 実装順序と優先度

1. **最優先**: データベース構造の更新
   - プロファイルテーブル拡張
   - 関連テーブル作成
   - ビュー・関数の実装

2. **高優先度**: API/バックエンド改善
   - 食事記録保存処理の修正
   - 栄養分析APIの強化
   - データ取得ロジックの最適化

3. **中優先度**: フロントエンド更新
   - プロフィール編集画面の拡張
   - 栄養管理ダッシュボードの実装
   - レシピ推奨コンポーネントの開発

4. **低優先度**: 拡張機能
   - 体重記録機能
   - 週間/月間レポート
   - カスタムレシピ保存

## テスト戦略

1. **単体テスト**
   - API応答の検証
   - データ変換ロジックのテスト
   - UIコンポーネントのテスト

2. **結合テスト**
   - 食事記録→栄養分析→レシピ提案フロー
   - プロフィール更新→栄養目標反映フロー

3. **エンドツーエンドテスト**
   - 実際のユーザーシナリオに沿ったテスト
   - データの永続化確認

## リスクと対策

1. **データ移行リスク**
   - 対策: 既存データのバックアップと段階的移行
   - 移行スクリプトのテスト実施

2. **パフォーマンス低下リスク**
   - 対策: インデックス最適化、クエリチューニング
   - 大量データでのテスト実施

3. **API連携リスク**
   - 対策: フォールバックメカニズム実装
   - エラー時のグレースフルデグラデーション

---

# 妊婦向け栄養管理アプリのER図

以下にアプリケーションの最終的なデータベース構造をER図で表します：

```
┌───────────────────┐         ┌───────────────────┐         ┌───────────────────┐
│     profiles      │         │       meals       │         │  meal_nutrients   │
├───────────────────┤         ├───────────────────┤         ├───────────────────┤
│ id            PK  │         │ id            PK  │         │ id            PK  │
│ user_id       FK ─┼─────────┼─► user_id     FK  │         │ meal_id       FK ─┼─► 
│ age               │         │ meal_type         │         │ calories          │
│ pregnancy_week    │         │ meal_date         │         │ protein           │
│ trimester     GEN │         │ photo_url         │         │ iron              │
│ height            │         │ food_description   │         │ folic_acid        │
│ weight            │         │ nutrition_data     │         │ calcium           │
│ due_date          │         │ servings           │         │ vitamin_d         │
│ dietary_restrict. │         │ created_at         │         │ confidence_score  │
│ adult_members     │         └─────────┬──────────┘         │ created_at        │
│ child_members     │                   │                    └───────────────────┘
│ auto_update_week  │                   │                    
│ created_at        │                   │                    
│ updated_at        │                   │                    
└────────┬──────────┘                   │                    
         │                              │                    
         │                              │                    
┌────────▼──────────┐         ┌─────────▼──────────┐         ┌───────────────────┐
│   weight_logs     │         │nutrition_goal_prog.│         │nutrition_targets  │
├───────────────────┤         │      (VIEW)        │         ├───────────────────┤
│ id            PK  │         ├───────────────────-┤         │ id            PK  │
│ user_id       FK ─┼─────────┼─► user_id          │         │ trimester     FK ◄┼───┐
│ log_date          │         │ trimester      FK ─┼─────────┼─►                 │   │
│ weight            │         │ meal_date          │         │ calories          │   │
│ comment           │         │ target_calories    │         │ protein           │   │
│ created_at        │         │ target_protein     │         │ iron              │   │
└───────────────────┘         │ target_iron        │         │ folic_acid        │   │
                              │ target_folic_acid  │         │ calcium           │   │
                              │ target_calcium     │         │ vitamin_d         │   │
┌───────────────────┐         │ target_vitamin_d   │         │ created_at        │   │
│daily_nutri_advice │         │ actual_calories    │         └───────────────────┘   │
├───────────────────┤         │ actual_protein     │                                 │
│ id            PK  │         │ actual_iron        │                                 │
│ user_id       FK ─┼─────────┼─► actual_folic_acid│                                 │
│ advice_date       │         │ actual_calcium     │         ┌───────────────────┐   │
│ advice_type       │         │ actual_vitamin_d   │         │      recipes      │   │
│ advice_content    │         │ calories_percent   │         ├───────────────────┤   │
│ is_read           │         │ protein_percent    │         │ id            PK  │   │
│ created_at        │         │ iron_percent       │         │ title             │   │
└───────────────────┘         │ folic_acid_percent │         │ description       │   │
                              │ calcium_percent    │         │ image_url         │   │
                              │ vitamin_d_percent  │         │ ingredients       │   │
┌───────────────────┐         └───────────────────-┘         │ instructions      │   │
│user_recipe_prefs  │                                        │ preparation_time  │   │
├───────────────────┤                                        │ difficulty        │   │
│ id            PK  │                                        │ calories          │   │
│ user_id       FK ─┼─┐                                      │ protein           │   │
│ preferred_tags    │ │                                      │ iron              │   │
│ disliked_ingred.  │ │                                      │ folic_acid        │   │
│ cooking_time_max  │ │                                      │ calcium           │   │
│ created_at        │ │                                      │ vitamin_d         │   │
│ updated_at        │ │                                      │ tags              │   │
└───────────────────┘ │                                      │ created_at        │   │
                      │                                      └───────────────────┘   │
                      │                                                              │
                      │                                                              │
┌─────────────────────────────────────────────────────────────────────────────────┐ │
│                                    auth.users                                    │ │
├─────────────────────────────────────────────────────────────────────────────────┤ │
│ id                                PK ◄─────────────────────────────────────────────┘
│ email                                                                            │
│ ... (他のSupabase Auth関連フィールド)                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## ER図の説明

### コアテーブル
1. **profiles**
   - ユーザー基本情報（妊娠週数、出産予定日など）
   - `trimester` は `pregnancy_week` から自動計算

2. **meals**
   - 食事記録の基本情報
   - `food_description` はJSONBで食品リスト保存
   - `nutrition_data` はJSONBで栄養データ保存（冗長化のため）

3. **meal_nutrients**
   - 食事ごとの栄養素データを構造化して保存
   - パフォーマンス向上のため正規化

4. **nutrition_targets**
   - トライメスター別の栄養摂取目標値
   - 推奨栄養素量のマスターデータ

### サポートテーブル
5. **weight_logs**
   - 体重記録の履歴管理
   - 妊娠中の体重変化を追跡

6. **daily_nutrition_advice**
   - AIが生成した栄養アドバイスを保存
   - 種類別にユーザーへのアドバイスを管理

7. **recipes**
   - レシピ情報（材料、栄養価など）
   - 栄養素に基づく献立提案に使用

8. **user_recipe_preferences**
   - ユーザーの食事嗜好設定
   - レシピ推奨のパーソナライズに使用

### ビュー
9. **nutrition_goal_progress** (VIEW)
   - 日次栄養目標と実績を集計したビュー
   - ダッシュボード表示用にクエリを簡素化

### 関連性
- `auth.users` テーブルは Supabase Auth が管理
- `profiles.user_id` ⇔ `auth.users.id` で認証と連携
- `trimester` は自動計算列で、`nutrition_targets` とのリレーション構築
- `meals` と `meal_nutrients` は1対1の関係で、構造化データと統計処理を効率化

