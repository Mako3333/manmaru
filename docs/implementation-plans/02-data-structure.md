# フェーズ1: データ構造と食品リポジトリの実装

## 1. 型定義の整理

### 1.1 食品データ型の再設計

```typescript
// src/types/food.ts を新規作成

/**
 * 基本食品データ
 */
export interface BasicFood {
  id: string;           // 英語ベースの識別子 (例: "rice-white")
  name: string;         // 表示名 (例: "白米")
  category: string;     // カテゴリ (例: "穀類-米")
  aliases: string[];    // 別名リスト (例: ["精白米", "ごはん"])
  standard_quantity: string; // 標準量 (例: "100g")
}

/**
 * 食品の栄養素データ
 */
export interface FoodNutrition {
  calories: number;     // カロリー (kcal)
  protein: number;      // タンパク質 (g)
  iron: number;         // 鉄分 (mg)
  folic_acid: number;   // 葉酸 (μg)
  calcium: number;      // カルシウム (mg)
  vitamin_d: number;    // ビタミンD (μg)
}

/**
 * 完全な食品データ
 */
export interface Food extends BasicFood, FoodNutrition {}

/**
 * 食品量データ
 */
export interface FoodQuantity {
  value: number;        // 数値
  unit: string;         // 単位 (例: "g", "個", "大さじ")
}

/**
 * 食事に含まれる食品アイテム
 */
export interface MealFoodItem {
  foodId: string;       // 食品ID
  quantity: FoodQuantity; // 量
  confidence: number;   // 確信度スコア (0.0-1.0)
}

/**
 * マッチング結果データ
 */
export interface FoodMatchResult {
  food: Food;           // マッチした食品
  similarity: number;   // 類似度スコア (0.0-1.0)
  originalInput: string; // 元の入力文字列
}

/**
 * 確信度レベル定義
 */
export enum ConfidenceLevel {
  HIGH = 'high',        // 高確信度 (0.85以上)
  MEDIUM = 'medium',    // 中確信度 (0.7-0.85)
  LOW = 'low',          // 低確信度 (0.5-0.7)
  VERY_LOW = 'very_low' // 非常に低い確信度 (0.35-0.5)
}
```

### 1.2 栄養計算結果型の再設計

```typescript
// src/types/nutrition.ts に追加

/**
 * 栄養計算結果
 */
export interface NutritionCalculationResult {
  // 基本栄養素データ
  nutrition: {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d: number;
  };
  
  // 計算の信頼性情報
  reliability: {
    overallConfidence: number;     // 全体の確信度 (0.0-1.0)
    lowConfidenceFoods: string[];  // 低確信度の食品リスト
    notFoundFoods: string[];       // 見つからなかった食品リスト
  };
  
  // 食品ごとのマッチング詳細
  matchDetails: Array<{
    input: string;                 // 入力された食品名
    matched: string;               // マッチした食品名
    foodId: string;                // 食品ID
    confidence: number;            // 確信度
    quantity: {
      input: string;               // 入力された量
      parsed: FoodQuantity;        // 解析された量
      confidence: number;          // 量解析の確信度
    };
  }>;
}
```

## 2. 食品リポジトリの実装

### 2.1 リポジトリインターフェース

```typescript
// src/lib/food/food-repository.ts を新規作成

import { Food, FoodMatchResult } from '@/types/food';

/**
 * 食品データリポジトリのインターフェース
 */
export interface FoodRepository {
  /**
   * IDによる食品の取得
   */
  getFoodById(id: string): Promise<Food | null>;
  
  /**
   * 食品名による完全一致検索
   */
  getFoodByExactName(name: string): Promise<Food | null>;
  
  /**
   * 食品名による部分一致検索
   */
  searchFoodsByPartialName(name: string, limit?: number): Promise<Food[]>;
  
  /**
   * 食品名によるファジー検索
   */
  searchFoodsByFuzzyMatch(name: string, limit?: number): Promise<FoodMatchResult[]>;
  
  /**
   * カテゴリによる食品検索
   */
  searchFoodsByCategory(category: string, limit?: number): Promise<Food[]>;
  
  /**
   * 複数の食品IDによる一括取得
   */
  getFoodsByIds(ids: string[]): Promise<Map<string, Food>>;
  
  /**
   * キャッシュの更新
   */
  refreshCache(): Promise<void>;
}
```

### 2.2 基本食品リストリポジトリの実装

```typescript
// src/lib/food/basic-food-repository.ts を新規作成

import { Food, FoodMatchResult } from '@/types/food';
import { FoodRepository } from './food-repository';
import { normalizeText, calculateSimilarity } from '@/lib/util/string-utils';

/**
 * 基本食品リストを使用したリポジトリ実装
 */
export class BasicFoodRepository implements FoodRepository {
  private static instance: BasicFoodRepository;
  private foods: Map<string, Food> = new Map(); // IDをキーにした食品マップ
  private foodsByName: Map<string, Food> = new Map(); // 正規化名をキーにした食品マップ
  private aliasMap: Map<string, string> = new Map(); // エイリアス→食品IDのマップ
  private cacheLoaded = false;
  
  private constructor() {}
  
  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(): BasicFoodRepository {
    if (!BasicFoodRepository.instance) {
      BasicFoodRepository.instance = new BasicFoodRepository();
    }
    return BasicFoodRepository.instance;
  }
  
  /**
   * キャッシュ読み込み確認
   */
  private async ensureCacheLoaded(): Promise<void> {
    if (this.cacheLoaded) return;
    
    try {
      // 基本食品リストJSONの読み込み
      const response = await fetch('/data/food_nutrition_database.json');
      const data = await response.json();
      
      // 食品データのキャッシュ構築
      for (const [key, food] of Object.entries(data.foods)) {
        const foodItem = food as Food;
        
        // IDによるマップ
        this.foods.set(foodItem.id, foodItem);
        
        // 正規化名によるマップ
        const normalizedName = normalizeText(foodItem.name);
        this.foodsByName.set(normalizedName, foodItem);
        
        // エイリアスマップの構築
        if (foodItem.aliases && foodItem.aliases.length > 0) {
          for (const alias of foodItem.aliases) {
            const normalizedAlias = normalizeText(alias);
            this.aliasMap.set(normalizedAlias, foodItem.id);
          }
        }
      }
      
      this.cacheLoaded = true;
      console.log(`BasicFoodRepository: キャッシュ読み込み完了 (${this.foods.size}件の食品)`);
    } catch (error) {
      console.error('BasicFoodRepository: キャッシュ読み込みエラー', error);
      throw error;
    }
  }
  
  // インターフェース実装メソッド
  
  async getFoodById(id: string): Promise<Food | null> {
    await this.ensureCacheLoaded();
    return this.foods.get(id) || null;
  }
  
  async getFoodByExactName(name: string): Promise<Food | null> {
    await this.ensureCacheLoaded();
    
    const normalizedName = normalizeText(name);
    
    // 1. 名前の完全一致
    if (this.foodsByName.has(normalizedName)) {
      return this.foodsByName.get(normalizedName) || null;
    }
    
    // 2. エイリアスの完全一致
    if (this.aliasMap.has(normalizedName)) {
      const foodId = this.aliasMap.get(normalizedName);
      return foodId ? this.foods.get(foodId) || null : null;
    }
    
    return null;
  }
  
  async searchFoodsByPartialName(name: string, limit: number = 10): Promise<Food[]> {
    await this.ensureCacheLoaded();
    
    const normalizedQuery = normalizeText(name);
    if (!normalizedQuery) return [];
    
    const results: Food[] = [];
    
    // 食品名の部分一致検索
    for (const [key, food] of this.foodsByName.entries()) {
      if (key.includes(normalizedQuery)) {
        results.push(food);
        if (results.length >= limit) break;
      }
    }
    
    // エイリアスの部分一致検索
    if (results.length < limit) {
      for (const [alias, foodId] of this.aliasMap.entries()) {
        if (alias.includes(normalizedQuery)) {
          const food = this.foods.get(foodId);
          if (food && !results.includes(food)) {
            results.push(food);
            if (results.length >= limit) break;
          }
        }
      }
    }
    
    return results;
  }
  
  async searchFoodsByFuzzyMatch(name: string, limit: number = 5): Promise<FoodMatchResult[]> {
    await this.ensureCacheLoaded();
    
    const normalizedQuery = normalizeText(name);
    if (!normalizedQuery) return [];
    
    // まず完全一致と部分一致を試みる
    const exactMatch = await this.getFoodByExactName(name);
    if (exactMatch) {
      return [{
        food: exactMatch,
        similarity: 1.0,
        originalInput: name
      }];
    }
    
    // 類似度によるマッチング結果を格納
    const results: Array<{ food: Food, similarity: number }> = [];
    
    // 1. 食品名の類似度計算
    for (const [key, food] of this.foodsByName.entries()) {
      const similarity = calculateSimilarity(normalizedQuery, key);
      if (similarity > 0.35) { // 最低類似度閾値
        results.push({ food, similarity });
      }
    }
    
    // 2. エイリアスの類似度計算
    for (const [alias, foodId] of this.aliasMap.entries()) {
      const similarity = calculateSimilarity(normalizedQuery, alias);
      if (similarity > 0.35) { // 最低類似度閾値
        const food = this.foods.get(foodId);
        if (food) {
          // すでに同じ食品が結果にある場合は、より高い類似度の方を採用
          const existingIndex = results.findIndex(r => r.food.id === foodId);
          if (existingIndex >= 0) {
            if (results[existingIndex].similarity < similarity) {
              results[existingIndex].similarity = similarity;
            }
          } else {
            results.push({ food, similarity });
          }
        }
      }
    }
    
    // 類似度でソートして上位を返す
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.slice(0, limit).map(item => ({
      food: item.food,
      similarity: item.similarity,
      originalInput: name
    }));
  }
  
  async searchFoodsByCategory(category: string, limit: number = 20): Promise<Food[]> {
    await this.ensureCacheLoaded();
    
    const results: Food[] = [];
    
    for (const food of this.foods.values()) {
      if (food.category === category) {
        results.push(food);
        if (results.length >= limit) break;
      }
    }
    
    return results;
  }
  
  async getFoodsByIds(ids: string[]): Promise<Map<string, Food>> {
    await this.ensureCacheLoaded();
    
    const resultMap = new Map<string, Food>();
    
    for (const id of ids) {
      const food = this.foods.get(id);
      if (food) {
        resultMap.set(id, food);
      }
    }
    
    return resultMap;
  }
  
  async refreshCache(): Promise<void> {
    this.foods.clear();
    this.foodsByName.clear();
    this.aliasMap.clear();
    this.cacheLoaded = false;
    await this.ensureCacheLoaded();
  }
}
```

### 2.3 文字列ユーティリティ

```typescript
// src/lib/util/string-utils.ts を新規作成

/**
 * テキストの正規化
 * 検索用に文字列を標準化する
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .replace(/\s+/g, '') // 空白を削除
    .replace(/[０-９]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0)) // 全角数字→半角
    .replace(/[ａ-ｚＡ-Ｚ]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0)) // 全角英字→半角
    .replace(/[\u3041-\u3096]/g, m => { // ひらがな→カタカナ変換は不要（検索の柔軟性のため）
      return m;
    })
    .replace(/[、。！？]/g, ''); // 句読点を削除
}

/**
 * レーベンシュタイン距離の計算
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }
  
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // 削除
        matrix[i][j - 1] + 1,     // 挿入
        matrix[i - 1][j - 1] + cost // 置換
      );
    }
  }
  
  return matrix[a.length][b.length];
}

/**
 * 文字列間の類似度計算（0.0-1.0）
 */
export function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  
  // 部分一致ボーナス
  let bonus = 0;
  if (a.includes(b) || b.includes(a)) {
    const minLength = Math.min(a.length, b.length);
    bonus = 0.1 + (minLength / maxLength) * 0.1;
  }
  
  const similarity = 1 - (distance / maxLength) + bonus;
  
  return Math.max(0, Math.min(1, similarity)); // 0.0-1.0の範囲に収める
}
```

## 3. 食品リポジトリのファクトリ

```typescript
// src/lib/food/food-repository-factory.ts を新規作成

import { FoodRepository } from './food-repository';
import { BasicFoodRepository } from './basic-food-repository';
import { SupabaseFoodRepository } from './supabase-food-repository'; // 後で実装

/**
 * 食品リポジトリの種類
 */
export enum FoodRepositoryType {
  BASIC = 'basic',      // 基本食品リスト
  SUPABASE = 'supabase' // Supabaseデータベース
}

/**
 * 食品リポジトリのファクトリクラス
 */
export class FoodRepositoryFactory {
  /**
   * 指定されたタイプのリポジトリを取得
   */
  static getRepository(type: FoodRepositoryType = FoodRepositoryType.BASIC): FoodRepository {
    switch (type) {
      case FoodRepositoryType.BASIC:
        return BasicFoodRepository.getInstance();
      case FoodRepositoryType.SUPABASE:
        // TODO: Supabaseリポジトリの実装
        throw new Error('Supabaseリポジトリは未実装です');
      default:
        return BasicFoodRepository.getInstance();
    }
  }
}
```

## 4. 実装手順

1. `src/types/food.ts` を作成し、新しい型定義を実装
2. `src/lib/util/string-utils.ts` を作成し、文字列処理ユーティリティを実装
3. `src/lib/food/food-repository.ts` を作成し、リポジトリインターフェースを定義
4. `src/lib/food/basic-food-repository.ts` を作成し、基本食品リストリポジトリを実装
5. `src/lib/food/food-repository-factory.ts` を作成し、ファクトリクラスを実装
6. 基本食品リストリポジトリのユニットテストを作成
7. 必要に応じて `src/types/nutrition.ts` に新しい型定義を追加 