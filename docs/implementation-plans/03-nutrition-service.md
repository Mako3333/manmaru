# フェーズ2: 栄養計算サービスの実装

## 1. 栄養計算サービスインターフェース

### 1.1 サービスインターフェース定義

```typescript
// src/lib/nutrition/nutrition-service.ts を新規作成

import { Food, MealFoodItem, FoodQuantity } from '@/types/food';
import { NutritionCalculationResult } from '@/types/nutrition';

/**
 * 栄養計算サービスのインターフェース
 */
export interface NutritionService {
  /**
   * 食品リストから栄養計算を行う
   * @param foodItems 食品アイテムリスト
   * @returns 栄養計算結果
   */
  calculateNutrition(foodItems: MealFoodItem[]): Promise<NutritionCalculationResult>;
  
  /**
   * 食品名と量のリストから栄養計算を行う
   * @param foodNameQuantities 食品名と量のペアリスト
   * @returns 栄養計算結果
   */
  calculateNutritionFromNameQuantities(
    foodNameQuantities: Array<{ name: string; quantity?: string }>
  ): Promise<NutritionCalculationResult>;
  
  /**
   * 単一の食品の栄養素を計算
   * @param food 食品データ
   * @param quantity 量データ
   * @returns 計算された栄養素データ
   */
  calculateSingleFoodNutrition(
    food: Food,
    quantity: FoodQuantity
  ): Promise<{ nutrition: any; confidence: number }>;
  
  /**
   * 栄養バランスを評価する
   * @param nutrition 栄養データ
   * @returns バランススコア（0-100）
   */
  evaluateNutritionBalance(nutrition: any): number;
  
  /**
   * 不足している栄養素を特定する
   * @param nutrition 栄養データ
   * @param targetValues 目標値
   * @returns 不足している栄養素のリスト
   */
  identifyDeficientNutrients(nutrition: any, targetValues: any): string[];
}
```

## 2. 量の解析ユーティリティ

### 2.1 量の解析機能の一元化

```typescript
// src/lib/nutrition/quantity-parser.ts を新規作成

import { FoodQuantity } from '@/types/food';

/**
 * 量の単位マッピング
 */
const UNIT_MAPPING = {
  // 標準単位
  'g': 'g',
  'グラム': 'g',
  'ｇ': 'g',
  'グラム': 'g',
  'kg': 'kg',
  'キログラム': 'kg',
  'キロ': 'kg',
  'ml': 'ml',
  'ミリリットル': 'ml',
  'ｍｌ': 'ml',
  
  // 日本の計量単位
  '大さじ': '大さじ',
  '大匙': '大さじ',
  'おおさじ': '大さじ',
  '小さじ': '小さじ',
  '小匙': '小さじ',
  'こさじ': '小さじ',
  'カップ': 'カップ',
  
  // 食品特有の単位
  '個': '個',
  '切れ': '切れ',
  '枚': '枚',
  '本': '本',
  '袋': '袋',
  '缶': '缶',
  'かけ': 'かけ',
  '束': '束',
  '尾': '尾',
};

/**
 * 単位ごとの標準グラム換算
 */
const UNIT_TO_GRAM = {
  'g': 1,
  'kg': 1000,
  'ml': 1,
  '大さじ': 15,
  '小さじ': 5,
  'カップ': 200,
  '個': 50,    // 一般的な目安
  '切れ': 80,  // 一般的な目安
  '枚': 60,    // 一般的な目安
  '本': 40,    // 一般的な目安
  '袋': 100,   // 一般的な目安
  '缶': 100,   // 一般的な目安
  'かけ': 3,   // 一般的な目安
  '束': 100,   // 一般的な目安
  '尾': 80,    // 一般的な目安
};

/**
 * 食品カテゴリ別の単位あたりの標準量
 * カテゴリと単位の組み合わせによる特殊なケース
 */
const CATEGORY_UNIT_GRAMS: Record<string, Record<string, number>> = {
  '穀類-米': {
    '杯': 150,    // お茶碗1杯
    'カップ': 150 // 炊いたご飯1カップ
  },
  '野菜-葉物': {
    '束': 80,
    '株': 100
  },
  '肉類': {
    '切れ': 100,
    '枚': 100
  },
  '魚介類': {
    '切れ': 80,
    '尾': 100,
    '匹': 100
  },
  '果物': {
    '個': {
      'りんご': 200,
      'みかん': 80,
      'バナナ': 100
    }
  }
};

/**
 * 量の文字列を解析して標準形式に変換するクラス
 */
export class QuantityParser {
  /**
   * 量の文字列を解析する
   * @param quantityStr 量の文字列 (例: "100g", "大さじ2", "3個")
   * @param foodName 食品名 (単位推定のため、オプション)
   * @param category 食品カテゴリ (単位推定のため、オプション)
   * @returns 解析された量データ
   */
  static parseQuantity(
    quantityStr?: string,
    foodName?: string,
    category?: string
  ): { quantity: FoodQuantity; confidence: number } {
    // デフォルト値
    const defaultResult = {
      quantity: { value: 1, unit: '標準量' },
      confidence: 0.5
    };
    
    // 量が指定されていない場合
    if (!quantityStr) {
      return defaultResult;
    }
    
    // 数値のみの場合は標準量とみなす
    const numericOnly = /^(\d+(\.\d+)?)$/.exec(quantityStr);
    if (numericOnly) {
      return {
        quantity: { value: parseFloat(numericOnly[1]), unit: '標準量' },
        confidence: 0.7
      };
    }
    
    // 一般的な形式: 数値 + 単位
    const standardFormat = /^(\d+(\.\d+)?)\s*([a-zａ-ｚＡ-Ｚ一-龠々ぁ-ヶ]+)$/i.exec(quantityStr);
    if (standardFormat) {
      const value = parseFloat(standardFormat[1]);
      const unitText = standardFormat[3];
      
      // 単位の正規化
      const normalizedUnit = UNIT_MAPPING[unitText] || unitText;
      
      return {
        quantity: { value, unit: normalizedUnit },
        confidence: 0.9
      };
    }
    
    // 日本語表現: "大さじ2"、"3個" など
    const japaneseFormat = /^([大小]さじ|[一-龠々ぁ-ヶ]+)(\d+(\.\d+)?)$/.exec(quantityStr);
    if (japaneseFormat) {
      const unitText = japaneseFormat[1];
      const value = parseFloat(japaneseFormat[2]);
      
      // 単位の正規化
      const normalizedUnit = UNIT_MAPPING[unitText] || unitText;
      
      return {
        quantity: { value, unit: normalizedUnit },
        confidence: 0.9
      };
    }
    
    // 漢数字や全角数字の処理
    const japaneseNumber = this.extractJapaneseNumber(quantityStr);
    if (japaneseNumber.found) {
      return {
        quantity: { value: japaneseNumber.value, unit: japaneseNumber.unit },
        confidence: 0.8
      };
    }
    
    // 解析できない場合はデフォルト値を返す
    return defaultResult;
  }
  
  /**
   * 日本語の数表現を抽出する
   * @private
   */
  private static extractJapaneseNumber(text: string): { found: boolean; value: number; unit: string } {
    // 全角数字を半角に変換
    const normalized = text.replace(/[０-９]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0));
    
    // 漢数字のマッピング
    const kanjiNumbers: Record<string, number> = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '半': 0.5
    };
    
    // 漢数字を検索
    for (const [kanji, value] of Object.entries(kanjiNumbers)) {
      if (normalized.includes(kanji)) {
        // 単位を抽出
        const unitMatch = normalized.match(new RegExp(`${kanji}([^\\d${Object.keys(kanjiNumbers).join('')}]+)`));
        const unit = unitMatch ? unitMatch[1] : '標準量';
        
        return { found: true, value, unit };
      }
    }
    
    return { found: false, value: 1, unit: '標準量' };
  }
  
  /**
   * 量を標準グラム数に変換する
   * @param quantity 量データ
   * @param foodName 食品名 (単位変換の特殊ケース用)
   * @param category 食品カテゴリ (単位変換の特殊ケース用)
   * @returns グラム単位の量
   */
  static convertToGrams(
    quantity: FoodQuantity,
    foodName?: string,
    category?: string
  ): { grams: number; confidence: number } {
    const { value, unit } = quantity;
    
    // すでにグラム単位の場合
    if (unit === 'g') {
      return { grams: value, confidence: 1.0 };
    }
    
    // キログラムの場合
    if (unit === 'kg') {
      return { grams: value * 1000, confidence: 1.0 };
    }
    
    // カテゴリと単位の組み合わせによる特殊なケース
    if (category && CATEGORY_UNIT_GRAMS[category] && CATEGORY_UNIT_GRAMS[category][unit]) {
      const categoryUnitValue = CATEGORY_UNIT_GRAMS[category][unit];
      
      // 食品名特有の量がある場合
      if (typeof categoryUnitValue === 'object' && foodName) {
        for (const [specificFood, specificGrams] of Object.entries(categoryUnitValue)) {
          if (foodName.includes(specificFood)) {
            return { grams: value * specificGrams, confidence: 0.95 };
          }
        }
      } else if (typeof categoryUnitValue === 'number') {
        return { grams: value * categoryUnitValue, confidence: 0.9 };
      }
    }
    
    // 一般的な単位変換
    if (UNIT_TO_GRAM[unit]) {
      return { grams: value * UNIT_TO_GRAM[unit], confidence: 0.8 };
    }
    
    // 単位が不明の場合は標準量とみなす
    return { grams: value * 100, confidence: 0.5 }; // 標準量は100gと仮定
  }
}
```

## 3. 栄養計算サービスの実装

### 3.1 実装クラス

```typescript
// src/lib/nutrition/nutrition-service-impl.ts を新規作成

import { Food, MealFoodItem, FoodQuantity } from '@/types/food';
import { NutritionCalculationResult } from '@/types/nutrition';
import { NutritionService } from './nutrition-service';
import { FoodRepository } from '@/lib/food/food-repository';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { QuantityParser } from './quantity-parser';

/**
 * 栄養計算サービスの実装
 */
export class NutritionServiceImpl implements NutritionService {
  private foodRepository: FoodRepository;
  
  /**
   * コンストラクタ
   * @param repositoryType 使用する食品リポジトリのタイプ
   */
  constructor(repositoryType: FoodRepositoryType = FoodRepositoryType.BASIC) {
    this.foodRepository = FoodRepositoryFactory.getRepository(repositoryType);
  }
  
  /**
   * 食品アイテムリストから栄養計算
   */
  async calculateNutrition(foodItems: MealFoodItem[]): Promise<NutritionCalculationResult> {
    if (!foodItems || foodItems.length === 0) {
      return this.getEmptyResult();
    }
    
    // 食品IDのリストを取得
    const foodIds = foodItems.map(item => item.foodId);
    
    // 一括で食品データを取得
    const foodsMap = await this.foodRepository.getFoodsByIds(foodIds);
    
    // 見つからなかった食品のリスト
    const notFoundFoods: string[] = [];
    
    // 低確信度の食品のリスト
    const lowConfidenceFoods: string[] = [];
    
    // 各食品の栄養素を計算して合計
    const totals = {
      calories: 0,
      protein: 0,
      iron: 0,
      folic_acid: 0,
      calcium: 0,
      vitamin_d: 0
    };
    
    // マッチング詳細のリスト
    const matchDetails: any[] = [];
    
    // 全体の確信度スコア
    let overallConfidence = 0;
    let foodCount = 0;
    
    // 各食品の栄養素を計算
    for (const item of foodItems) {
      const food = foodsMap.get(item.foodId);
      
      if (!food) {
        notFoundFoods.push(item.foodId);
        continue;
      }
      
      // 量をグラムに変換
      const { grams, confidence: quantityConfidence } = QuantityParser.convertToGrams(
        item.quantity,
        food.name,
        food.category
      );
      
      // 比率を計算（標準量100gに対する比率）
      const ratio = grams / 100;
      
      // 食品の栄養素に比率を掛けて加算
      totals.calories += food.calories * ratio;
      totals.protein += food.protein * ratio;
      totals.iron += food.iron * ratio;
      totals.folic_acid += food.folic_acid * ratio;
      totals.calcium += food.calcium * ratio;
      totals.vitamin_d += food.vitamin_d * ratio;
      
      // 食品の確信度を追跡
      const itemConfidence = item.confidence * quantityConfidence;
      overallConfidence += itemConfidence;
      foodCount++;
      
      // 低確信度の食品を記録
      if (itemConfidence < 0.7) {
        lowConfidenceFoods.push(food.name);
      }
      
      // マッチング詳細を追加
      matchDetails.push({
        input: item.foodId, // この例では単純化のためIDを使用
        matched: food.name,
        foodId: food.id,
        confidence: itemConfidence,
        quantity: {
          input: `${item.quantity.value} ${item.quantity.unit}`,
          parsed: item.quantity,
          confidence: quantityConfidence
        }
      });
    }
    
    // 平均の確信度を計算
    const finalConfidence = foodCount > 0 ? overallConfidence / foodCount : 0;
    
    // 各値を小数点以下2桁に丸める
    Object.keys(totals).forEach(key => {
      totals[key] = Math.round(totals[key] * 100) / 100;
    });
    
    return {
      nutrition: {
        calories: totals.calories,
        protein: totals.protein,
        iron: totals.iron,
        folic_acid: totals.folic_acid,
        calcium: totals.calcium,
        vitamin_d: totals.vitamin_d
      },
      reliability: {
        overallConfidence: finalConfidence,
        lowConfidenceFoods,
        notFoundFoods
      },
      matchDetails
    };
  }
  
  /**
   * 食品名と量のリストから栄養計算
   */
  async calculateNutritionFromNameQuantities(
    foodNameQuantities: Array<{ name: string; quantity?: string }>
  ): Promise<NutritionCalculationResult> {
    if (!foodNameQuantities || foodNameQuantities.length === 0) {
      return this.getEmptyResult();
    }
    
    // 食品アイテムリストに変換
    const foodItems: MealFoodItem[] = [];
    const matchDetails: any[] = [];
    const notFoundFoods: string[] = [];
    
    // 各食品名をマッチングして処理
    for (const { name, quantity } of foodNameQuantities) {
      // 量を解析
      const parsedQuantity = QuantityParser.parseQuantity(quantity, name);
      
      // ファジー検索で食品を検索
      const matches = await this.foodRepository.searchFoodsByFuzzyMatch(name, 1);
      
      if (matches.length > 0 && matches[0].similarity >= 0.5) {
        // 十分な類似度がある場合
        const match = matches[0];
        
        // 食品アイテムを追加
        foodItems.push({
          foodId: match.food.id,
          quantity: parsedQuantity.quantity,
          confidence: match.similarity
        });
        
        // マッチング詳細を追加
        matchDetails.push({
          input: name,
          matched: match.food.name,
          foodId: match.food.id,
          confidence: match.similarity,
          quantity: {
            input: quantity || '標準量',
            parsed: parsedQuantity.quantity,
            confidence: parsedQuantity.confidence
          }
        });
      } else {
        // マッチする食品が見つからない場合
        notFoundFoods.push(name);
      }
    }
    
    // 変換された食品アイテムリストで栄養計算
    const result = await this.calculateNutrition(foodItems);
    
    // マッチング詳細を上書き
    result.matchDetails = matchDetails;
    
    // 見つからなかった食品を追加
    result.reliability.notFoundFoods = notFoundFoods;
    
    return result;
  }
  
  /**
   * 単一の食品の栄養素を計算
   */
  async calculateSingleFoodNutrition(
    food: Food,
    quantity: FoodQuantity
  ): Promise<{ nutrition: any; confidence: number }> {
    // 量をグラムに変換
    const { grams, confidence } = QuantityParser.convertToGrams(
      quantity,
      food.name,
      food.category
    );
    
    // 比率を計算（標準量100gに対する比率）
    const ratio = grams / 100;
    
    // 栄養素に比率を掛ける
    const nutrition = {
      calories: Math.round(food.calories * ratio * 100) / 100,
      protein: Math.round(food.protein * ratio * 100) / 100,
      iron: Math.round(food.iron * ratio * 100) / 100,
      folic_acid: Math.round(food.folic_acid * ratio * 100) / 100,
      calcium: Math.round(food.calcium * ratio * 100) / 100,
      vitamin_d: Math.round(food.vitamin_d * ratio * 100) / 100
    };
    
    return { nutrition, confidence };
  }
  
  /**
   * 栄養バランスを評価する
   */
  evaluateNutritionBalance(nutrition: any): number {
    // 妊娠期に重要な栄養素に重み付け
    const weights = {
      protein: 0.25,
      iron: 0.2,
      folic_acid: 0.25,
      calcium: 0.2,
      vitamin_d: 0.1
    };
    
    // 1日の推奨摂取量
    const dailyValues = {
      protein: 60, // g
      iron: 27,    // mg
      folic_acid: 400, // μg
      calcium: 1000, // mg
      vitamin_d: 10  // μg
    };
    
    // スコア計算（各栄養素の充足率 × 重み）
    let score = 0;
    for (const [nutrient, weight] of Object.entries(weights)) {
      const value = nutrition[nutrient] || 0;
      const daily = dailyValues[nutrient];
      // 充足率（最大100%）
      const fulfillment = Math.min(value / daily, 1);
      score += fulfillment * weight * 100;
    }
    
    return Math.round(score);
  }
  
  /**
   * 不足している栄養素を特定する
   */
  identifyDeficientNutrients(nutrition: any, targetValues: any): string[] {
    const deficientNutrients: string[] = [];
    
    // デフォルトの目標値
    const defaultTargets = {
      protein: 60, // g
      iron: 27,    // mg
      folic_acid: 400, // μg
      calcium: 1000, // mg
      vitamin_d: 10  // μg
    };
    
    // 使用する目標値
    const targets = targetValues || defaultTargets;
    
    // 各栄養素について、達成率を計算
    for (const [nutrient, target] of Object.entries(targets)) {
      const value = nutrition[nutrient] || 0;
      const achievementRate = (value / target) * 100;
      
      // 70%未満を不足とみなす
      if (achievementRate < 70) {
        deficientNutrients.push(nutrient);
      }
    }
    
    return deficientNutrients;
  }
  
  /**
   * 空の結果を取得
   * @private
   */
  private getEmptyResult(): NutritionCalculationResult {
    return {
      nutrition: {
        calories: 0,
        protein: 0,
        iron: 0,
        folic_acid: 0,
        calcium: 0,
        vitamin_d: 0
      },
      reliability: {
        overallConfidence: 0,
        lowConfidenceFoods: [],
        notFoundFoods: []
      },
      matchDetails: []
    };
  }
}
```

### 3.2 栄養計算サービスファクトリ

```typescript
// src/lib/nutrition/nutrition-service-factory.ts を新規作成

import { NutritionService } from './nutrition-service';
import { NutritionServiceImpl } from './nutrition-service-impl';
import { FoodRepositoryType } from '@/lib/food/food-repository-factory';

/**
 * 栄養計算サービスのファクトリクラス
 */
export class NutritionServiceFactory {
  private static instance: NutritionService;
  
  /**
   * 栄養計算サービスのインスタンスを取得
   */
  static getService(repositoryType: FoodRepositoryType = FoodRepositoryType.BASIC): NutritionService {
    if (!this.instance) {
      this.instance = new NutritionServiceImpl(repositoryType);
    }
    return this.instance;
  }
  
  /**
   * インスタンスを強制的に再作成
   */
  static recreateService(repositoryType: FoodRepositoryType = FoodRepositoryType.BASIC): NutritionService {
    this.instance = new NutritionServiceImpl(repositoryType);
    return this.instance;
  }
}
```

## 4. 実装手順

1. `src/lib/nutrition/quantity-parser.ts` を作成し、量解析の一元化を実装
2. `src/lib/nutrition/nutrition-service.ts` を作成し、サービスインターフェースを定義
3. `src/lib/nutrition/nutrition-service-impl.ts` を作成し、サービス実装を作成
4. `src/lib/nutrition/nutrition-service-factory.ts` を作成し、ファクトリクラスを実装
5. 量解析ユーティリティのユニットテストを作成
6. 栄養計算サービス実装のユニットテストを作成
7. 食品リポジトリと栄養計算サービスの連携テストを作成 