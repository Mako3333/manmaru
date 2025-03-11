# 栄養データベース統合実装計画

## 1. 型定義の更新

既存の `DatabaseFoodItem` インターフェースに変更が必要ないか確認しました。既存の型定義には `vitamin_d` がすでに含まれていますが、`id` フィールドを追加する必要があります。以下の変更が必要です：

```typescript
// src/types/nutrition.ts の型定義を更新
export interface DatabaseFoodItem {
    name: string;
    id?: string;           // 新規追加
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d: number;     // 既存
    standard_quantity: string;
    category?: FoodCategory;
    aliases?: string[];
    notes?: string;
}
```

## 2. データベースローダー機能の実装

新しいJSON形式を読み込むための機能を `NutritionDatabase` クラスに追加します：

```typescript
// src/lib/nutrition/database.ts

export class NutritionDatabase {
    private static instance: NutritionDatabase;
    private foodDatabase: Record<string, DatabaseFoodItem>;
    private isFullDatabaseLoaded: boolean = false;

    private constructor() {
        // 基本データを初期化
        this.foodDatabase = FOOD_DATABASE;
    }

    /**
     * 外部の食品データベースJSONを読み込む
     */
    public async loadExternalDatabase(): Promise<void> {
        if (this.isFullDatabaseLoaded) return;
        
        try {
            // JSON読み込み（環境に応じた方法で）
            const response = await fetch('/data/food_nutrition_database.json');
            const data = await response.json();
            
            if (data && data.foods) {
                // 既存のデータベースとマージ
                this.foodDatabase = {
                    ...this.foodDatabase,
                    ...data.foods
                };
                
                console.log(`拡張食品データベースを読み込みました: ${Object.keys(data.foods).length}件`);
                this.isFullDatabaseLoaded = true;
            }
        } catch (error) {
            console.error('食品データベースの読み込みに失敗しました:', error);
        }
    }

    /**
     * データベースがフル読み込み済みかどうか
     */
    public isFullyLoaded(): boolean {
        return this.isFullDatabaseLoaded;
    }

    /**
     * 利用可能な食品の総数を返す
     */
    public getFoodCount(): number {
        return Object.keys(this.foodDatabase).length;
    }
}
```

## 3. データベース統合のアプローチ

### 3.1 段階的ロード方式

1. **基本データ**: アプリ起動時に基本的な食品データ（FOOD_DATABASE）を読み込み
2. **拡張データ**: 必要に応じて拡張データベースを遅延ロード
3. **バックグラウンドロード**: ユーザーエクスペリエンスを妨げないバックグラウンドでの読み込み

### 3.2 データマージ戦略

1. **キーの重複**: キーが重複する場合、新しいデータで上書き
2. **差分更新**: 差分のみを更新し、不要なメモリ使用を避ける
3. **カテゴリ自動割り当て**: カテゴリが指定されていない食品には自動でカテゴリを付与

## 4. 検索およびアクセス最適化

### 4.1 インデックス作成

重要な検索パターンに基づいてインデックスを作成し、検索パフォーマンスを向上させます：

```typescript
private buildIndices() {
    // カテゴリ別インデックス
    this.categoryIndex = {};
    // 栄養素含有量別インデックス
    this.nutrientIndex = {
        iron: {},
        calcium: {},
        protein: {},
        folic_acid: {}
    };
    
    // インデックス構築ロジック
    for (const [key, food] of Object.entries(this.foodDatabase)) {
        // カテゴリインデックス
        if (food.category) {
            if (!this.categoryIndex[food.category]) {
                this.categoryIndex[food.category] = [];
            }
            this.categoryIndex[food.category].push(key);
        }
        
        // 栄養素インデックス（例：高鉄分食品）
        if (food.iron > 2.0) {
            this.nutrientIndex.iron.high = this.nutrientIndex.iron.high || [];
            this.nutrientIndex.iron.high.push(key);
        }
        
        // 他の栄養素も同様にインデックス化
    }
}
```

### 4.2 高度な検索機能

```typescript
/**
 * 特定の栄養素が豊富な食品を検索
 */
public findFoodsByNutrient(nutrient: string, minValue: number, limit: number = 10): DatabaseFoodItem[] {
    const results: DatabaseFoodItem[] = [];
    
    for (const [key, food] of Object.entries(this.foodDatabase)) {
        if (food[nutrient as keyof DatabaseFoodItem] >= minValue) {
            results.push(food);
        }
        
        if (results.length >= limit) break;
    }
    
    return results;
}
```

## 5. UI統合計画

### 5.1 管理画面の拡張

- データベースステータス表示（読み込み食品数、最終更新など）
- 手動データ更新機能
- 食品検索フォームの拡張（詳細フィルタリング）

### 5.2 ユーザーインターフェース改善

- 食品選択時の候補表示の拡張
- 栄養素バランス表示の高度化
- トライメスター別推奨食品の視覚化

## 6. テストプラン

### 6.1 ユニットテスト

```typescript
// src/__tests__/nutrition/database.test.ts

describe('NutritionDatabase', () => {
    let db: NutritionDatabase;
    
    beforeAll(async () => {
        db = NutritionDatabase.getInstance();
        await db.loadExternalDatabase();
    });
    
    test('データベースが正しく読み込まれること', () => {
        expect(db.isFullyLoaded()).toBe(true);
        expect(db.getFoodCount()).toBeGreaterThan(10);
    });
    
    test('食品名で検索できること', () => {
        const rice = db.findFoodByName('こめ');
        expect(rice).not.toBeNull();
        expect(rice?.name).toContain('こめ');
    });
    
    test('栄養素で食品を検索できること', () => {
        const highIronFoods = db.findFoodsByNutrient('iron', 2.0);
        expect(highIronFoods.length).toBeGreaterThan(0);
        expect(highIronFoods[0].iron).toBeGreaterThanOrEqual(2.0);
    });
});
```

## 7. 実装スケジュール

| 日程 | タスク | 優先度 |
|------|-------|--------|
| Day 1 | 型定義の更新とベースコード修正 | 高 |
| Day 1-2 | データベースローダー機能実装 | 高 |
| Day 2-3 | インデックス作成と検索最適化 | 中 |
| Day 3-4 | UIコンポーネント拡張 | 中 |
| Day 4-5 | ユニットテスト実装 | 高 |

## 8. 懸念事項とリスク

1. **メモリ使用量**: 大規模データベースのメモリ使用量の管理
2. **パフォーマンス**: 初期ロード時間とUXへの影響
3. **データの一貫性**: 異なるデータソース間の一貫性の維持
4. **オフラインサポート**: PWA対応とオフラインデータアクセス 