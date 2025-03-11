# 妊婦向け栄養管理アプリ「manmaru」データベース統合計画

## 目的

このドキュメントは、栄養素データベース「food_nutrition_database.json」をアプリケーションに統合するための実装計画を提供します。妊婦向け栄養管理アプリの目的を最大化するための、段階的な実装アプローチを説明します。

## ゴール

1. **栄養アドバイスの精度向上**: 包括的な食品データベースの統合
2. **トライメスター対応**: 妊娠期間別の栄養ニーズへの対応
3. **パーソナライズ**: ユーザー固有の推奨システムの強化
4. **使いやすさ**: データベース拡張によるUX向上
5. **パフォーマンス最適化**: 大規模データベースの効率的な管理

## 実装ステップ

### ステップ 1: プロジェクト準備とデータ分析

**タスク:**
1. 新しいブランチを作成（例: `feature/nutrition-db-integration`）
2. データの完全性と構造を確認
3. 既存のデータベースとの差異を分析
4. 型定義の更新計画を策定

**コード例: 型定義の更新（必要な場合）**

```typescript
// src/types/nutrition.ts の既存の型定義を拡張
export interface DatabaseFoodItem {
    name: string;
    id?: string;           // 新規追加
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d: number;     // 既存だが値を更新
    standard_quantity: string;
    category?: FoodCategory;
    aliases?: string[];
    notes?: string;
    tags?: string[];       // 新規追加: 妊婦向けタグ等
}
```

### ステップ 2: データの前処理と変換

**タスク:**
1. データをアプリに適した形式に変換
2. 食品のカテゴリ分類（未分類の場合）
3. 妊婦向けの重要な食品にタグ付け
4. データの分割（必要に応じて）

**実装方針:**
- Node.jsスクリプトを使用してデータを前処理
- カテゴリは食品名からの推論やマッピングテーブルを使用して割り当て
- 妊婦に重要な栄養素（鉄分、葉酸、カルシウムなど）が豊富な食品にタグ付け

**コード例: データ前処理スクリプト（概念）**

```typescript
// scripts/process-food-database.js
const fs = require('fs');
const path = require('path');

// 元のJSONデータを読み込み
const rawData = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../data/food_nutrition_database.json'), 
  'utf8'
));

// カテゴリマッピングの定義（一部の例）
const categoryMapping = {
  'こめ': 'GRAINS',
  'パン': 'GRAINS',
  'にく': 'PROTEIN',
  'ぎゅう': 'PROTEIN',
  'ぶた': 'PROTEIN',
  'とり': 'PROTEIN',
  'やさい': 'VEGETABLES',
  'くだもの': 'FRUITS',
  'ミルク': 'DAIRY',
  // ...その他のマッピング
};

// 食品にカテゴリを割り当て、タグ付けするロジック
const processedFoods = {};
for (const [key, food] of Object.entries(rawData.foods)) {
  const processedFood = {
    ...food,
    tags: food.tags || [],
    category: assignCategory(food.name)
  };
  
  // 妊婦に重要な栄養素のタグ付け
  if (food.iron > 3.0) processedFood.tags.push('high_iron');
  if (food.folic_acid > 100.0) processedFood.tags.push('high_folic_acid');
  if (food.calcium > 200.0) processedFood.tags.push('high_calcium');
  if (food.protein > 15.0) processedFood.tags.push('high_protein');
  
  processedFoods[key] = processedFood;
}

// カテゴリ別にデータを分割して保存
// ...

// ヘルパー関数: 食品名からカテゴリを推測
function assignCategory(name) {
  for (const [keyword, category] of Object.entries(categoryMapping)) {
    if (name.includes(keyword)) return category;
  }
  return 'OTHER';
}
```

### ステップ 3: データベースロード機能の実装

**タスク:**
1. データロードの最適化戦略実装
2. ハイブリッドロード方式の構築
3. 必要に応じてキャッシング機能追加

**実装アプローチ:**
- 基本食品はコアデータとして直接
- 完全なデータは必要に応じて動的ロード
- インデックス作成による検索最適化

**コード例: NutritionDatabaseクラスの拡張**

```typescript
// src/lib/nutrition/database.ts
export class NutritionDatabase {
  private static instance: NutritionDatabase;
  private foodDatabase: Record<string, DatabaseFoodItem>;
  private isFullDatabaseLoaded: boolean = false;
  private foodIndices: {
    byCategory: Record<FoodCategory, string[]>;
    byNutrient: Record<string, string[]>;
    byTag: Record<string, string[]>;
  };

  private constructor() {
    // 基本データを初期化
    this.foodDatabase = FOOD_DATABASE;
    this.foodIndices = {
      byCategory: {},
      byNutrient: {},
      byTag: {}
    };
    this.buildIndices();
  }

  private async loadFullDatabase() {
    if (this.isFullDatabaseLoaded) return;
    
    try {
      // 環境に応じてデータをロード（例：静的インポートまたはAPIロード）
      const fullData = process.env.NODE_ENV === 'production'
        ? await import('../../data/processed_foods.json')
        : await fetch('/api/food-database').then(res => res.json());
        
      this.foodDatabase = {
        ...this.foodDatabase,
        ...fullData
      };
      
      this.buildIndices();
      this.isFullDatabaseLoaded = true;
    } catch (error) {
      console.error('栄養データベースの読み込みに失敗しました:', error);
    }
  }
  
  // 検索インデックスを構築
  private buildIndices() {
    // カテゴリ、栄養素、タグによるインデックス作成
    // ...
  }
  
  // インデックスを使った高速検索メソッド
  // ...
}
```

### ステップ 4: 検索・推奨機能の強化

**タスク:**
1. 検索機能の強化
2. トライメスター別推奨システムの実装
3. パーソナライズされた食品推奨機能の追加

**実装アプローチ:**
- 検索アルゴリズムの改善
- 妊娠期間別の栄養素優先順位付け
- ユーザー履歴に基づく学習式推奨

**コード例: トライメスター別推奨機能**

```typescript
// src/lib/nutrition/recommendations.ts
export function getRecommendedFoodsForTrimester(
  nutritionData: NutritionData,
  trimester: number,
  count: number = 5
): DatabaseFoodItem[] {
  const db = NutritionDatabase.getInstance();
  
  // トライメスター別の優先栄養素
  const priorityNutrients = {
    1: { folic_acid: 3, iron: 2, protein: 1 },      // 第1期: 葉酸が最重要
    2: { calcium: 3, protein: 2, iron: 1 },         // 第2期: カルシウムが重要
    3: { iron: 3, protein: 3, calcium: 2 }          // 第3期: 鉄分とタンパク質が重要
  }[trimester] || { iron: 1, folic_acid: 1, calcium: 1, protein: 1 };
  
  // 不足している栄養素
  const deficientNutrients = nutritionData.deficient_nutrients;
  
  // 不足栄養素と優先栄養素を組み合わせたスコアリングで食品を推奨
  return db.findOptimalFoods(deficientNutrients, priorityNutrients, count);
}
```

### ステップ 5: UI/UX更新

**タスク:**
1. 食品検索UIの改善
2. 推奨表示の強化
3. 栄養素情報の詳細表示

**実装アプローチ:**
- 検索ページのUX改善
- カテゴリフィルタリングの追加
- 栄養素データのグラフィカル表示の強化

**コード例は省略（UIコンポーネントの更新など）**

### ステップ 6: テストと最適化

**タスク:**
1. ユニットテストの作成
2. パフォーマンステスト
3. ユーザビリティテスト
4. 必要に応じたパフォーマンス最適化

**テストアプローチ:**
- 検索機能のユニットテスト
- 大規模データでのパフォーマンス評価
- メモリ使用量とロード時間の測定
- 実際のユーザーシナリオに基づくテスト

### ステップ 7: デプロイと監視

**タスク:**
1. ステージング環境へのデプロイ
2. パフォーマンスと使用状況の監視
3. フィードバックに基づく調整
4. 本番環境へのリリース

## 実装スケジュール

| ステップ | 推定期間 | 優先度 |
|---------|---------|-------|
| 1. 準備とデータ分析 | 2日 | 高 |
| 2. データ前処理・変換 | 3日 | 高 |
| 3. データベースロード機能 | 3日 | 高 |
| 4. 検索・推奨機能強化 | 5日 | 高 |
| 5. UI/UX更新 | 4日 | 中 |
| 6. テストと最適化 | 3日 | 高 |
| 7. デプロイと監視 | 2日 | 中 |

## 技術的考慮事項

1. **メモリ使用量**: 大規模データはメモリ使用に影響する可能性があります。遅延ロードを検討してください。
2. **バンドルサイズ**: クライアントのバンドルサイズを監視し、必要に応じてチャンク分割を使用してください。
3. **検索パフォーマンス**: インデックスと効率的なアルゴリズムで高速検索を確保してください。
4. **オフラインサポート**: プログレッシブウェブアプリのためのオフラインデータ戦略を検討してください。
5. **データ最新性**: 定期的なデータ更新メカニズムを検討してください。

## 成功指標

- **検索の応答時間**: <200ms以内
- **メモリ使用量**: クライアント側で5MB未満の増加
- **推奨の適合率**: ユーザーの80%以上が推奨食品に満足
- **栄養追跡の精度**: 90%以上の食品が正確に識別される

---

このプランは開発チームのガイドとして機能し、妊婦向け栄養管理アプリ「manmaru」の栄養データベース統合に関する体系的なアプローチを提供します。各ステップは必要に応じて調整可能です。 