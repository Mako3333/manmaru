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

1. **レシピ機能の設計方針（docs/features/recipe-feature-design.md）**
   - ナビゲーション構造
   - 詳細画面設計（ホーム、ダッシュボード、レシピページ、食事記録ページなど）
   - UI共通要素とデザイン指針
   - 実装優先順位とフェーズ計画

2. **MVPと将来の拡張機能の分類（docs/instructions/procedure-3.17.md）**
   - MVPに含める機能
   - 将来の拡張機能
   - MVP要件定義
   - DB設計
   - 実装ステップ

3. **データベース設計（docs/database/db.pu および schema.sql）**
   - ERダイアグラム
   - テーブル構造（clipped_recipes、meal_recipe_entries、caution_foodsなどのレシピ関連テーブル）

# manmaruアプリ レシピ機能 MVP実装ステップ計画

## 1. 実装ゴール

MVPのゴールは以下の2点です：
- ユーザーが好きなレシピサイトのURLをクリップし、栄養価を自動計算して保存・管理できる基本機能
- ナビゲーションメニューからのページと機能の作成

## 2. 実装フェーズと作業項目

### フェーズ1: 基盤構築（1週間）

#### 1-1. プロジェクト設定とナビゲーション構造（2日）
- **ナビゲーションメニュー実装**
  - ホーム、ダッシュボード、食事記録、レシピ、プロフィールの基本構造
  - タブバーまたはボトムナビゲーションの実装
  - 各画面への基本遷移設定

- **レシピ機能用の新規ルート追加**
  - `/recipes` (レシピメイン画面)
  - `/recipes/clip` (URLクリップ画面)
  - `/recipes/[id]` (レシピ詳細画面)
  - `/recipes/browser` (アプリ内ブラウザ)

#### 1-2. DBと基本APIエンドポイント（3日）
- **データベース設定**
  - `clipped_recipes`テーブルの確認・調整
  - `meal_recipe_entries`テーブルの確認・調整
  - `caution_foods`テーブルの初期データ登録

- **必要なAPIエンドポイント実装**
  - レシピ取得エンドポイント
  - レシピ保存エンドポイント
  - レシピ検索・フィルターエンドポイント
  - 食事記録連携エンドポイント

#### 1-3. 基本UIコンポーネント（2日）
- **レシピ関連の共通コンポーネント作成**
  - レシピカード（160dp×200dp）
  - 栄養素バッジ
  - 警告表示
  - ローディングインジケーター

### フェーズ2: URL解析機能実装（5日）

#### 2-1. URLクリップ基本機能（2日）
- **URLクリップ画面UI実装**
  - URL入力フォーム
  - クリップボタン
  - 処理中インジケーター

- **メタデータ取得機能実装**
  - OpenGraph/メタタグパーサー
  - サムネイル画像取得処理
  - サイト識別機能

#### 2-2. レシピサイト専用パーサー（2日）
- **主要レシピサイト対応パーサー**
  - クックパッド用パーサー
  - デリッシュキッチン用パーサー
  - 汎用パーサー(その他サイト用)

- **材料リスト抽出機能**
  - DOM解析による材料リスト抽出
  - 分量テキスト処理

#### 2-3. 栄養素計算エンジン（1日）
- **基本栄養素計算機能**
  - 食品成分データベース連携
  - 材料名マッチングロジック
  - 主要栄養素の計算処理
  - 妊婦向け重要栄養素計算

### フェーズ3: レシピ管理機能実装（4日）

#### 3-1. レシピ一覧画面（2日）
- **レシピライブラリUI**
  - グリッドレイアウト実装
  - タブナビゲーション（すべて/お気に入り/カテゴリ別）
  - 検索バーと絞り込み機能

- **データ取得と表示ロジック**
  - ユーザーのクリップレシピ取得
  - カテゴリ別分類表示
  - 無限スクロール実装

#### 3-2. レシピ詳細画面（2日）
- **詳細UI実装**
  - レシピ画像とタイトル表示
  - 栄養情報セクション
  - 材料リスト表示
  - 注意喚起セクション（該当時）

- **アクション機能実装**
  - お気に入りボタン
  - 「調理手順を見る」ボタン
  - 「今日食べた」ボタン

### フェーズ4: 食事記録連携と統合（4日）

#### 4-1. 食事記録連携機能（2日）
- **レシピから食事記録への連携**
  - 「今日食べた」機能
  - 分量選択UI
  - 食事タイプ選択UI
  - 連携データ処理

- **簡易食事記録モーダル**
  - カード「+」ボタンからの記録機能
  - ミニマル入力UI
  - 高速記録プロセス

#### 4-2. アプリ内ブラウザ実装（1日）
- **WebView実装**
  - 原サイト表示機能
  - ナビゲーションコントロール
  - セキュリティ設定

#### 4-3. ホーム画面連携（1日）
- **レシピを探すカード**
  - デザイン実装
  - タップアクション設定

- **おすすめレシピセクション**
  - カード表示実装
  - データ取得ロジック

### フェーズ5: テストと調整（2日）

#### 5-1. 総合テスト（1日）
- **エンドツーエンドテスト**
  - URLクリップから食事記録までの一連のフロー
  - 各種レシピサイト対応確認
  - エラーハンドリング検証

#### 5-2. パフォーマンス最適化と最終調整（1日）
- **パフォーマンス改善**
  - 画像最適化
  - API応答速度改善
  - キャッシュ戦略実装

- **最終UI調整**
  - デザイン一貫性確認
  - アクセシビリティ確認
  - レスポンシブ対応確認

## 3. コンポーネント設計

### 3.1 レシピカード
```typescript
// RecipeCard.tsx
interface RecipeCardProps {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  isFavorite: boolean;
  nutritionFocus?: string[];
  onCardClick: (id: string) => void;
  onFavoriteToggle: (id: string, isFavorite: boolean) => void;
  onQuickLog: (id: string) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({
  id,
  title,
  imageUrl,
  category,
  isFavorite,
  nutritionFocus,
  onCardClick,
  onFavoriteToggle,
  onQuickLog
}) => {
  return (
    <div 
      className="recipe-card" 
      onClick={() => onCardClick(id)}
      style={{ width: '160px', height: '200px' }}
    >
      <div className="recipe-card-thumbnail">
        <img src={imageUrl || '/placeholder-recipe.jpg'} alt={title} />
      </div>
      <div className="recipe-card-info">
        <h3 className="recipe-card-title">{title}</h3>
        <div className="recipe-card-category">{category}</div>
        {nutritionFocus && (
          <div className="recipe-card-nutrition">
            {nutritionFocus.map(nutrient => (
              <span key={nutrient} className={`nutrition-badge ${nutrient}`}>
                {nutrient}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="recipe-card-actions">
        <button 
          className={`favorite-button ${isFavorite ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle(id, !isFavorite);
          }}
        >
          ♥
        </button>
        <button 
          className="quick-log-button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickLog(id);
          }}
        >
          +
        </button>
      </div>
    </div>
  );
};
```

### 3.2 URLクリップコンポーネント
```typescript
// URLClipForm.tsx
interface URLClipFormProps {
  onSubmit: (url: string) => Promise<void>;
  isLoading: boolean;
}

const URLClipForm: React.FC<URLClipFormProps> = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!url) {
      setError('URLを入力してください');
      return;
    }
    
    try {
      await onSubmit(url);
    } catch (err) {
      setError('URLの解析に失敗しました。有効なレシピURLを入力してください。');
    }
  };

  return (
    <form className="url-clip-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h2>レシピをクリップする</h2>
        <p>レシピサイトのURLを入力して栄養情報を自動取得</p>
      </div>
      
      <div className="form-input">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://recipe-site.com/recipe/12345"
          disabled={isLoading}
        />
      </div>
      
      {error && <div className="form-error">{error}</div>}
      
      <button 
        type="submit" 
        className="clip-button"
        disabled={isLoading}
      >
        {isLoading ? 'クリップ中...' : 'クリップする'}
      </button>
      
      {isLoading && <div className="loading-indicator">レシピ情報を解析中...</div>}
    </form>
  );
};
```

## 4. APIエンドポイント設計

### 4.1 レシピ解析エンドポイント
```typescript
// api/parse-recipe-url
export async function POST(req: Request) {
  const { url } = await req.json();
  
  try {
    // 1. URLから基本メタデータを取得
    const metadata = await fetchUrlMetadata(url);
    
    // 2. サイトに合わせたパーサーを選択
    let ingredientsList = [];
    if (url.includes('cookpad.com')) {
      ingredientsList = await parseCookpadIngredients(metadata.html);
    } else if (url.includes('delishkitchen.tv')) {
      ingredientsList = await parseDelishKitchenIngredients(metadata.html);
    } else {
      ingredientsList = await parseGenericIngredients(metadata.html);
    }
    
    // 3. 材料から栄養素を計算
    const nutritionData = await calculateNutrition(ingredientsList);
    
    // 4. 妊婦向け注意食材を検出
    const cautionFoods = await detectCautionFoods(ingredientsList);
    const cautionLevel = determineCautionLevel(cautionFoods);
    
    return Response.json({
      title: metadata.title,
      imageUrl: metadata.image,
      sourcePlatform: determinePlatform(url),
      sourceUrl: url,
      ingredients: ingredientsList,
      nutritionPerServing: nutritionData,
      cautionFoods,
      cautionLevel
    });
  } catch (error) {
    console.error('Recipe parsing error:', error);
    return Response.json(
      { error: 'レシピの解析に失敗しました。URLを確認してください。' },
      { status: 400 }
    );
  }
}
```

### 4.2 レシピ保存エンドポイント
```typescript
// api/recipes
export async function POST(req: Request) {
  const { user } = await auth();
  if (!user) {
    return Response.json({ error: '認証が必要です' }, { status: 401 });
  }
  
  const recipeData = await req.json();
  
  try {
    const { data, error } = await supabase
      .from('clipped_recipes')
      .insert({
        user_id: user.id,
        title: recipeData.title,
        image_url: recipeData.imageUrl,
        source_url: recipeData.sourceUrl,
        source_platform: recipeData.sourcePlatform,
        recipe_type: recipeData.recipeType || 'main_dish',
        ingredients: recipeData.ingredients,
        nutrition_per_serving: recipeData.nutritionPerServing,
        caution_foods: recipeData.cautionFoods,
        caution_level: recipeData.cautionLevel,
        is_favorite: false,
        servings: 1,
        clipped_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return Response.json(data);
  } catch (error) {
    console.error('Recipe save error:', error);
    return Response.json(
      { error: 'レシピの保存に失敗しました。' },
      { status: 500 }
    );
  }
}
```

## 5. 実装におけるポイント

### 5.1 レシピ解析技術的アプローチ
- **サーバーサイドスクレイピング**：クライアントではなくサーバーでレシピサイトのHTMLを取得・解析
- **メタデータ優先**：OpenGraphタグなどのメタデータを優先的に取得し、不足している場合にDOMパースを行う
- **サイト別対応**：主要サイト(クックパッド、デリッシュキッチン)には専用パーサーを用意
- **エラーハンドリング**：解析できない場合は手動入力へのフォールバック機能を提供

### 5.2 栄養素計算アプローチ
- **食材名正規化**：「にんじん」「人参」「ニンジン」などのバリエーションを統一フォーマットに
- **分量推定**：「1個」「適量」などのあいまいな表現を推定アルゴリズムで処理
- **栄養価データベース**：日本食品標準成分表をベースに独自データベースを構築
- **計算精度**：MVP段階では±20%の誤差を許容し、後続フェーズで精度改善

### 5.3 UX最適化ポイント
- **ローディング時間最適化**：URLクリップから結果表示までの目標時間を3秒以内に設定
- **エラー時のグレースフルデグラデーション**：解析失敗時も部分的な情報があれば表示
- **簡易記録機能**：タップ数を最小限に抑えた「+」ボタンからの記録フロー
- **操作フィードバック**：各アクションに視覚的・触覚的フィードバックを提供

## 6. 実装スケジュール

| 週 | 日 | 主な作業項目 | 成果物 |
|----|----|--------------|--------------------|
| 1 | 1-2 | ナビゲーション構造とルート設定 | 基本ナビゲーションフレームワーク |
| 1 | 3-5 | DB設定とAPIエンドポイント | 基本CRUD機能 |
| 1 | 6-7 | 基本UIコンポーネント | 共通コンポーネントライブラリ |
| 2 | 1-2 | URLクリップ基本機能 | URL入力&メタデータ取得 |
| 2 | 3-4 | レシピサイトパーサー | 主要サイト対応パーサー |
| 2 | 5 | 栄養素計算エンジン | 基本計算機能 |
| 3 | 1-2 | レシピ一覧画面 | ライブラリ&検索UI |
| 3 | 3-4 | レシピ詳細画面 | 詳細表示&アクション |
| 3 | 5-6 | 食事記録連携 | レシピ→食事記録フロー |
| 3 | 7 | アプリ内ブラウザ | WebView実装 |
| 4 | 1 | ホーム画面連携 | ホーム画面コンポーネント |
| 4 | 2-3 | テストと最適化 | 完成したMVP |

## 7. 結論

このMVP実装計画では、約4週間でレシピクリップ機能の基本機能を実装し、ユーザーがレシピサイトのURLから栄養情報を自動取得して管理・活用できる機能を提供します。フェーズ分けにより段階的な開発が可能となり、各フェーズでの成果物が明確になります。

実装においては、ユーザー体験を最優先し、操作の簡便さと情報の正確性のバランスを重視します。MVP完成後は、ユーザーフィードバックを基に機能の改善と拡張を進めることで、より価値の高いアプリへと進化させていきます。
◤◢◤◢◤◢◤◢◤◢◤◢◤◢
