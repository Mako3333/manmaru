## MVPと将来の拡張機能の分類

### 【MVPに含める機能】
1. **基本的なURLクリップ機能**
   - URLからのメタデータ取得（タイトル、画像）
   - 主要レシピサイト（クックパッド、デリッシュキッチン）対応

2. **シンプルな栄養素計算**
   - 主要栄養素（カロリー、タンパク質、脂質、炭水化物）
   - 妊婦に重要な栄養素（鉄分、葉酸、カルシウム）

3. **レシピの保存と分類**
   - カテゴリ分類（主菜、副菜、汁物、主食）
   - お気に入り機能

4. **基本的な食事記録連携**
   - クリップしたレシピから食事記録への登録

5. **シンプルな妊婦安全機能**
   - 生もの、高水銀魚など基本的な注意食材のアラート

### 【将来の拡張機能】
1. **高度なパーサー機能**
   - SNS（Instagram、TikTok）対応
   - 未対応サイト用の汎用パーサー
   - 画像認識による料理分析

2. **詳細な栄養素計算**
   - 調理方法による栄養価変化の計算
   - 材料置換による栄養価再計算
   - より多くの微量栄養素の計算

3. **AIレコメンデーション**
   - 1汁3菜の自動組み合わせ提案
   - 不足栄養素を補う最適な献立提案
   - 季節や旬を考慮した提案

4. **高度なパーソナライズ機能**
   - ユーザーの好み学習
   - トライメスター別最適化
   - 食事履歴に基づく多様性確保

5. **ソーシャル機能**
   - レシピの共有
   - 人気レシピランキング
   - コミュニティ機能
◤◢◤◢◤◢◤◢◤◢◤◢◤◢

◤◢◤◢◤◢◤◢◤◢◤◢◤◢
## MVP要件定義

### 1. URLクリップ基本機能
- **入力**
  - URLテキスト入力フィールド
  - 「クリップする」ボタン
  - 処理中プログレスインジケーター

- **取得情報**
  - レシピタイトル
  - サムネイル画像（利用可能な場合）
  - ソースサイト情報
  - レシピカテゴリの選択（主菜、副菜、汁物、主食）

### 2. 栄養素計算（MVP版）
- **自動取得情報**
  - 材料リスト取得
  - 簡易的な分量推定

- **計算対象栄養素**
  - 基本栄養素：カロリー、タンパク質、脂質、炭水化物
  - 重要栄養素：鉄分、葉酸、カルシウム、食物繊維

- **手動調整**
  - 材料の追加/削除
  - 分量の調整
  - 人数の調整

### 3. レシピ保存と管理
- **分類機能**
  - カテゴリ別表示（主菜、副菜、汁物、主食）
  - お気に入りマーク機能

- **一覧表示**
  - サムネイル付きカードUI
  - 栄養素サマリー表示
  - ソースサイトへのリンク

- **検索と絞り込み**
  - タイトル検索
  - カテゴリ絞り込み

### 4. 食事記録連携
- **ワンタップ記録**
  - 「今日食べた」ボタン
  - 分量調整オプション（全量、1/2、1/3など）
  - 食事タイプ選択（朝食、昼食、夕食、間食）

### 5. 妊婦安全機能（MVP版）
- **基本的な注意喚起**
  - 生食材検出時の警告表示
  - 高水銀魚検出時の警告表示
  - アルコール含有検出時の警告表示
◤◢◤◢◤◢◤◢◤◢◤◢◤◢

◤◢◤◢◤◢◤◢◤◢◤◢◤◢
## MVP用DB設計

```sql
-- レシピクリップテーブル
CREATE TABLE clipped_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  source_url TEXT NOT NULL,
  source_platform TEXT, -- 'cookpad', 'delishkitchen', etc.
  recipe_type TEXT, -- 'main_dish', 'side_dish', 'soup', 'rice'
  
  -- 材料情報
  ingredients JSONB, -- [{"name": "にんじん", "amount": "1本", "estimated_grams": 200}, ...]
  
  -- 栄養素情報（MVPでは基本栄養素のみ）
  nutrition_per_serving JSONB NOT NULL, -- {"calories": 350, "protein": 15, "fat": 10, "carbs": 45, "iron": 2.5, "folate": 200, "calcium": 120, "fiber": 5}
  
  -- 妊婦安全情報
  caution_foods TEXT[], -- ['生魚', '高水銀魚', 'アルコール']
  caution_level TEXT, -- 'safe', 'caution', 'avoid'
  
  -- 分類と管理
  is_favorite BOOLEAN DEFAULT false,
  servings INTEGER DEFAULT 1,
  
  -- 時間管理
  clipped_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- 食事記録連携用の中間テーブル
CREATE TABLE meal_recipe_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_entry_id UUID REFERENCES meal_entries(id) NOT NULL, -- 既存の食事記録テーブルへの参照
  clipped_recipe_id UUID REFERENCES clipped_recipes(id) NOT NULL,
  portion_size FLOAT DEFAULT 1.0, -- 1.0 = 全量、0.5 = 半分、など
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 基本的な注意食材マスターテーブル
CREATE TABLE caution_foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  food_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'raw', 'high_mercury', 'alcohol', etc.
  caution_level TEXT NOT NULL, -- 'caution', 'avoid'
  reason TEXT NOT NULL,
  alternative_suggestion TEXT
);
```
◤◢◤◢◤◢◤◢◤◢◤◢◤◢

◤◢◤◢◤◢◤◢◤◢◤◢◤◢
## MVP実装ステップ

### フェーズ1：基盤構築（1週間）

#### 日1-2：データモデルと基本UI
1. **DBテーブル作成**
   - 上記設計に基づくテーブル作成（完了）
   - shema.sqlファイル作成（完了）

2. **レシピクリップ基本UI**
   - URL入力フォーム
   - 基本的なレイアウト設計
   - APIエンドポイント設計

#### 日3-5：URL解析機能
3. **メタデータ取得機能**
   - OpenGraph/メタタグパーサー実装
   - 主要レシピサイト（クックパッド、デリッシュキッチン）用パーサー
   - サムネイル画像取得・保存機能

4. **材料リスト抽出機能**
   - DOM解析による材料リスト抽出
   - 分量テキスト処理
   - エラーハンドリング

#### 日6-7：栄養素計算基盤
5. **基本栄養素計算エンジン**
   - 食品成分データベース連携
   - 材料名マッチングロジック
   - 基本栄養素計算関数

6. **注意食材検出機能**
   - 基本的な注意食材のキーワードマッチング
   - アラート表示ロジック

### フェーズ2：UI実装とユーザー体験（1週間）

#### 日8-10：レシピ管理UI
7. **レシピカードUI**
   - カード表示コンポーネント
   - お気に入り機能
   - カテゴリ選択UI

8. **レシピ一覧画面**
   - グリッドレイアウト
   - カテゴリフィルター
   - 検索機能

#### 日11-12：詳細画面と食事記録連携
9. **レシピ詳細画面**
   - 材料・栄養素表示
   - 元サイトへのリンク
   - 注意喚起表示

10. **食事記録連携機能**
    - 「今日食べた」ボタン
    - 分量選択UI
    - 既存の食事記録機能との統合

#### 日13-14：テストと調整
11. **総合テスト**
    - ユーザーフロー検証
    - 異なるURLでのテスト
    - エラーハンドリング改善

12. **最終調整**
    - パフォーマンス最適化
    - UI/UX調整
    - ドキュメント作成

### 技術的実装詳細

#### URLパーサー実装アプローチ
```javascript
// 簡易的なURLパーサー例
async function parseRecipeUrl(url) {
  try {
    // メタデータ取得
    const response = await fetch('/api/fetch-url-metadata', {
      method: 'POST',
      body: JSON.stringify({ url }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    const metadata = await response.json();
    
    // サイト別パーサー選択
    let ingredients = [];
    if (url.includes('cookpad.com')) {
      ingredients = parseCookpadIngredients(metadata.html);
    } else if (url.includes('delishkitchen.tv')) {
      ingredients = parseDelishKitchenIngredients(metadata.html);
    } else {
      ingredients = parseGenericIngredients(metadata.html);
    }
    
    // 栄養素計算
    const nutrition = calculateNutrition(ingredients);
    
    // 注意食材検出
    const cautionFoods = detectCautionFoods(ingredients);
    
    return {
      title: metadata.title,
      imageUrl: metadata.image,
      sourcePlatform: determinePlatform(url),
      ingredients,
      nutrition,
      cautionFoods,
      cautionLevel: determineCautionLevel(cautionFoods)
    };
  } catch (error) {
    console.error('Recipe parsing error:', error);
    throw new Error('レシピの解析に失敗しました。URLを確認してください。');
  }
}
```

#### 栄養素計算エンジン（シンプル版）
```javascript
// 簡易的な栄養素計算エンジン例
function calculateNutrition(ingredients) {
  let nutrition = {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    iron: 0,
    folate: 0,
    calcium: 0,
    fiber: 0
  };
  
  for (const ingredient of ingredients) {
    // 食材データベースから栄養素情報を取得
    const foodData = getFoodData(ingredient.name);
    if (!foodData) continue;
    
    // 分量推定
    const grams = estimateGrams(ingredient.amount, ingredient.name);
    
    // 栄養素計算と集計
    for (const nutrient in nutrition) {
      if (foodData[nutrient]) {
        nutrition[nutrient] += (foodData[nutrient] * grams) / 100; // 100g当たりから計算
      }
    }
  }
  
  return nutrition;
}
```
◤◢◤◢◤◢◤◢◤◢◤◢◤◢

◤◢◤◢◤◢◤◢◤◢◤◢◤◢
## MVP成功指標と評価計画

### 1. 機能的成功指標
- **パース成功率**: 
  - 目標: 主要レシピサイトで80%以上のURLが正常にパース可能
  - 測定: エラーログとユーザーフィードバック分析

- **栄養素計算信頼度**:
  - 目標: 手動計算と比較して±20%以内の誤差
  - 測定: サンプルレシピのクロスチェック

- **妊婦安全機能精度**:
  - 目標: 注意食材の90%以上を検出
  - 測定: サンプル危険レシピによるテスト

### 2. ユーザー体験指標
- **レシピクリップ操作時間**:
  - 目標: URLからレシピ保存までの平均時間30秒以内
  - 測定: ユーザーテスト時間計測

- **食事記録利用率**:
  - 目標: クリップしたレシピの25%以上が食事記録に使用
  - 測定: データ分析

### 3. ビジネス指標
- **機能採用率**:
  - 目標: 月間アクティブユーザーの30%以上がクリップ機能利用
  - 測定: アナリティクス分析

- **ユーザーリテンション向上**:
  - 目標: クリップ機能利用者の継続率10%向上
  - 測定: コホート分析

## MXP後の展開計画

MVP完成後は、ユーザーフィードバックを基に優先度を決定し、以下の拡張機能を段階的に実装していきます：

1. **より多くのサイト対応**:
   - Instagram、TikTokなどSNSからのレシピ対応
   - より多くのレシピサイト専用パーサー

2. **献立提案機能**:
   - 1汁3菜の組み合わせ推奨
   - 不足栄養素を補う最適な組み合わせ提案

3. **AIによる高度な食材解析**:
   - 画像認識による料理タイプ判定
   - テキスト解析による調理法推定

4. **パーソナライズ機能強化**:
   - トライメスター別最適化
   - 個人の好みと食歴に基づく推奨

## まとめ

レシピクリップ機能のMVPでは、ユーザーが好きなレシピサイトのURLをクリップし、栄養価を自動計算して保存・管理できる基本機能に焦点を当てます。この機能により、妊婦が様々なソースから得たレシピ情報を一元管理し、自身の栄養状態と照らし合わせることが容易になります。

MVPは2週間での完成を目指し、主要レシピサイトからのメタデータ取得、基本的な栄養素計算、シンプルな分類・管理機能を実装します。これにより、より少ない負担で食事記録を行えるという明確な価値をユーザーに提供します。

MVP完成後は、ユーザーフィードバックを基に機能を拡張し、より高度なAI分析や献立提案機能を段階的に追加していくことで、アプリの利便性と差別化をさらに高めていきます。
◤◢◤◢◤◢◤◢◤◢◤◢◤◢
