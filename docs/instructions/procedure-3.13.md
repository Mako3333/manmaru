# manmaruアプリ レシピ提案機能 実装戦略

## 現状分析と実装方針

manmaruアプリは妊婦向け栄養管理アプリとして、すでに下記の機能を実装済みです：

- ユーザー認証（Supabase Auth）
- プロファイル管理（妊娠週数、身長、体重など）
- 食事記録（画像/テキスト入力）
- AI画像解析（Gemini API）
- 栄養ダッシュボード
- パーソナライズされた栄養アドバイス

現在のUIは洗練されており、モバイルファーストのレスポンシブデザインで妊婦に特化した栄養管理を実現しています。

MVPリリースまでの優先実装項目として、**レシピ提案機能**に焦点を当てます。

## レシピ提案機能の差別化戦略

### 1. 法的リスク回避と実用性を両立

**クリップボード方式の採用**
- 著作権侵害やスクレイピング禁止の問題を避ける
- 元サイトへトラフィックを還元するWin-Win関係
- 完全なコンテンツ複製を避け、利用規約違反を回避

**ビジネス展開の可能性**
- アフィリエイト連携による収益化ポテンシャル
- コンテンツ制作負担の軽減
- 様々なソース（レシピサイト、SNS）との連携

### 2. 妊婦に特化した栄養価値の提供

**「1汁3菜」の献立セット提案**
- 日本の食文化に根差した栄養バランス
- 不足栄養素に焦点を当てたパーソナライズ
- 主菜・副菜・汁物の組み合わせで効率的な栄養摂取

**妊娠期特有の安全配慮**
- 生もの・高水銀魚・高ビタミンA食品などの警告機能
- トライメスター別の適合レシピ表示
- 食事制限・アレルギー対応フィルタリング

## 技術実装アプローチ

### 1. データモデル設計

```sql
-- レシピテーブル
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  source_url TEXT NOT NULL,
  recipe_type TEXT NOT NULL, -- 'main_dish', 'side_dish', 'soup', 'rice'
  nutrition_per_serving JSONB NOT NULL,
  nutrition_focus TEXT[] NOT NULL,
  pregnancy_stage TEXT[],
  clipped_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);

-- 献立セットテーブル
CREATE TABLE meal_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  main_dish_id UUID REFERENCES recipes(id),
  side_dish1_id UUID REFERENCES recipes(id),
  side_dish2_id UUID OPTIONAL REFERENCES recipes(id),
  soup_id UUID REFERENCES recipes(id),
  rice_id UUID OPTIONAL REFERENCES recipes(id),
  total_nutrition JSONB NOT NULL,
  nutrition_focus TEXT[] NOT NULL,
  pregnancy_stage TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 禁忌食品テーブル
CREATE TABLE restricted_foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  food_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'raw', 'high_mercury', 'high_vitamin_a', 'high_iodine', 'high_caffeine'
  restriction_level TEXT NOT NULL, -- 'avoid', 'limit', 'caution'
  max_frequency TEXT,
  alternative_foods TEXT[],
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. 実装アプローチ

#### レシピクリップ機能

1. **栄養素抽出エンジン**
   - AIを活用してURLから栄養素情報を抽出
   - 材料リストから推定計算
   - 元サイトへのリンク保持

2. **レシピカードUI**
   - タイトル、写真、簡潔な説明のカード形式
   - 栄養フォーカスを視覚的に表示（タグやアイコン）
   - 「詳細を見る」ボタンで元サイトへ誘導

#### ハイブリッドキュレーション

1. **基本レシピライブラリ**
   - 妊婦の栄養ニーズに特化した30-50の核レシピをDB登録
   - 各カテゴリ（主菜、副菜、汁物、主食）ごとに10-15種類
   - すべてのレシピに栄養素フォーカス、トライメスター適合性のタグ付け

2. **献立セットのキュレーション**
   - 栄養士監修による20-30パターンの献立セットを事前登録
   - 各セットは不足しがちな栄養素（鉄分、葉酸、カルシウムなど）に対応
   - トライメスター別の最適献立を用意

## UI実装計画

### 1. ホーム画面の「レシピを探す」と「おすすめレシピ」

ホーム画面には以下のコンポーネントを追加:

- **レシピを探すカード**: 不足栄養素に基づく提案メッセージを表示
- **おすすめレシピセクション**: 不足栄養素を補うレシピを2件表示


### 2. 栄養素警告機能（NGフード対応）

妊娠時期に注意が必要な食材の警告機能:

- 生もの・非加熱食品
- 高水銀魚
- 高ビタミンA食品
- 過剰ヨウ素含有食品
- 高カフェイン飲料

## 実装計画とマイルストーン

### フェーズ1: レシピ提案機能のMVP実装（2週間）

1. **基本データ構造とサンプルレシピ登録** (3日)
   - テーブル設計・実装
   - 基本レシピデータ登録

2. **ダッシュボード用献立提案機能** (4日)
   - 不足栄養素に基づく献立組み合わせロジック
   - 献立セットのカードUI
   - 栄養素フォーカスの視覚化

3. **レシピ探索機能** (5日)
   - 検索・フィルタリング機能
   - カテゴリ別表示UI
   - レシピ詳細画面

4. **総合テストと調整** (2日)
   - ユーザーフロー検証
   - パフォーマンス最適化

### フェーズ2: MVP以降の拡張（3-6ヶ月）

1. レシピライブラリの拡充
2. パーソナライズ機能の高度化
3. ユーザーエンゲージメント向上機能
4. 購入支援機能

## MVPの成功指標

1. **ユーザーエンゲージメント**
   - DAU/MAU比率: 0.3以上
   - 継続率: 30日後の継続率60%以上
   - レシピ閲覧率: ユーザーの70%が週1回以上閲覧

2. **機能効果**
   - 栄養バランス改善率
   - レシピ提案クリック率: 20%以上
   - 警告機能有効性

## まとめ

レシピクリップ機能を通じて、manmaruアプリは妊婦向け栄養管理から一歩進んだ「具体的なアクション提案」を実現します。不足栄養素に基づく1汁3菜の献立提案は他のアプリとの明確な差別化ポイントとなり、ユーザーに具体的な行動指針を提供します。

すでに実装済みの栄養アドバイス機能を基盤として、「レシピ提案機能」と「避けるべき食品の警告機能」を優先的に実装することで、食事記録から栄養分析、そして実用的な献立提案までの一連のフローを完成させ、妊婦の日々の食生活における具体的な悩みを解決するアプリを目指します。