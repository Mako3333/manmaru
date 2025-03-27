# フェーズ3: 食品マッチング戦略の実装

## 1. 食品マッチングサービスのインターフェース

### 1.1 基本インターフェース

```typescript
// src/lib/food/food-matching-service.ts を新規作成

import { Food, FoodMatchResult, ConfidenceLevel } from '@/types/food';

/**
 * 食品マッチングサービスのインターフェース
 */
export interface FoodMatchingService {
  /**
   * 食品名から最適な食品データをマッチング
   * @param name 食品名
   * @param options マッチングオプション
   * @returns マッチング結果
   */
  matchFood(
    name: string,
    options?: MatchingOptions
  ): Promise<FoodMatchResult | null>;
  
  /**
   * 複数の食品名を一括でマッチング
   * @param names 食品名リスト
   * @param options マッチングオプション
   * @returns マッチング結果のマップ (入力名 -> マッチング結果)
   */
  matchFoods(
    names: string[],
    options?: MatchingOptions
  ): Promise<Map<string, FoodMatchResult | null>>;
  
  /**
   * 確信度に基づいて視覚的表示情報を取得
   * @param confidence 確信度スコア
   * @returns 視覚的表示情報
   */
  getConfidenceDisplay(confidence: number): ConfidenceDisplay;
  
  /**
   * 確信度レベルを取得
   * @param confidence 確信度スコア
   * @returns 確信度レベル
   */
  getConfidenceLevel(confidence: number): ConfidenceLevel;
}

/**
 * マッチングオプション
 */
export interface MatchingOptions {
  /** 最低類似度閾値 (0.0-1.0) */
  minSimilarity?: number;
  
  /** 結果の最大数 */
  limit?: number;
  
  /** カテゴリ制限 */
  category?: string;
  
  /** 厳密モード (完全一致のみ) */
  strictMode?: boolean;
}

/**
 * 確信度の視覚表示情報
 */
export interface ConfidenceDisplay {
  /** 確信度レベル */
  level: ConfidenceLevel;
  
  /** 表示色 (CSSクラス) */
  colorClass: string;
  
  /** アイコン名 */
  icon: string;
  
  /** 表示メッセージ */
  message: string;
}

/**
 * 確信度レベルの閾値定義
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,    // 高確信度 (85%以上)
  MEDIUM: 0.7,   // 中確信度 (70%以上85%未満)
  LOW: 0.5,      // 低確信度 (50%以上70%未満)
  VERY_LOW: 0.35 // 非常に低い確信度 (35%以上50%未満)
};
```

## 2. 食品マッチングサービスの実装

### 2.1 実装クラス

```typescript
// src/lib/food/food-matching-service-impl.ts を新規作成

import { Food, FoodMatchResult, ConfidenceLevel } from '@/types/food';
import { 
  FoodMatchingService, 
  MatchingOptions, 
  ConfidenceDisplay,
  CONFIDENCE_THRESHOLDS
} from './food-matching-service';
import { FoodRepository } from './food-repository';
import { FoodRepositoryFactory, FoodRepositoryType } from './food-repository-factory';

/**
 * 食品マッチングサービスの実装
 */
export class FoodMatchingServiceImpl implements FoodMatchingService {
  private foodRepository: FoodRepository;
  
  /**
   * コンストラクタ
   * @param repositoryType 使用する食品リポジトリのタイプ
   */
  constructor(repositoryType: FoodRepositoryType = FoodRepositoryType.BASIC) {
    this.foodRepository = FoodRepositoryFactory.getRepository(repositoryType);
  }
  
  /**
   * 食品名から最適な食品データをマッチング
   */
  async matchFood(
    name: string,
    options?: MatchingOptions
  ): Promise<FoodMatchResult | null> {
    if (!name || name.trim() === '') return null;
    
    const normalizedName = name.trim();
    
    // オプションのデフォルト値
    const minSimilarity = options?.minSimilarity ?? 0.35;
    const strictMode = options?.strictMode ?? false;
    
    // 1. 厳密モードまたは完全一致を優先
    if (strictMode) {
      const exactMatch = await this.foodRepository.getFoodByExactName(normalizedName);
      if (exactMatch) {
        return {
          food: exactMatch,
          similarity: 1.0,
          originalInput: normalizedName
        };
      }
      return null;
    }
    
    // 2. 通常の完全一致チェック
    const exactMatch = await this.foodRepository.getFoodByExactName(normalizedName);
    if (exactMatch) {
      return {
        food: exactMatch,
        similarity: 1.0,
        originalInput: normalizedName
      };
    }
    
    // 3. カテゴリ制限がある場合、部分一致検索で事前フィルタリング
    let candidateFoods: Food[] = [];
    if (options?.category) {
      const categoryFoods = await this.foodRepository.searchFoodsByCategory(options.category);
      // カテゴリ内で部分一致するものを検索
      candidateFoods = categoryFoods.filter(food => 
        food.name.includes(normalizedName) || 
        normalizedName.includes(food.name) ||
        food.aliases.some(alias => 
          alias.includes(normalizedName) || normalizedName.includes(alias)
        )
      );
    }
    
    // 4. ファジー検索でマッチング
    const limit = options?.limit ?? 1;
    const fuzzyResults = await this.foodRepository.searchFoodsByFuzzyMatch(
      normalizedName,
      candidateFoods.length > 0 ? Math.max(limit, candidateFoods.length) : limit
    );
    
    // 5. カテゴリフィルタリングと結果の結合
    let results = fuzzyResults;
    if (candidateFoods.length > 0) {
      // カテゴリでフィルタリングされた結果を優先
      const categoryMatchIds = new Set(candidateFoods.map(food => food.id));
      const categoryMatches = fuzzyResults.filter(result => 
        categoryMatchIds.has(result.food.id)
      );
      
      if (categoryMatches.length > 0) {
        results = categoryMatches;
      }
    }
    
    // 6. 結果の評価と返却
    if (results.length > 0 && results[0].similarity >= minSimilarity) {
      return results[0];
    }
    
    return null;
  }
  
  /**
   * 複数の食品名を一括でマッチング
   */
  async matchFoods(
    names: string[],
    options?: MatchingOptions
  ): Promise<Map<string, FoodMatchResult | null>> {
    const results = new Map<string, FoodMatchResult | null>();
    
    // 各食品名について並行処理
    const matchPromises = names.map(async (name) => {
      const result = await this.matchFood(name, options);
      return { name, result };
    });
    
    // 全ての処理を待機
    const matchResults = await Promise.all(matchPromises);
    
    // 結果をマップに格納
    for (const { name, result } of matchResults) {
      results.set(name, result);
    }
    
    return results;
  }
  
  /**
   * 確信度レベルを取得
   */
  getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      return ConfidenceLevel.HIGH;
    } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      return ConfidenceLevel.MEDIUM;
    } else if (confidence >= CONFIDENCE_THRESHOLDS.LOW) {
      return ConfidenceLevel.LOW;
    } else if (confidence >= CONFIDENCE_THRESHOLDS.VERY_LOW) {
      return ConfidenceLevel.VERY_LOW;
    } else {
      return null; // 最低閾値未満
    }
  }
  
  /**
   * 確信度に基づいて視覚的表示情報を取得
   */
  getConfidenceDisplay(confidence: number): ConfidenceDisplay {
    const level = this.getConfidenceLevel(confidence);
    
    switch (level) {
      case ConfidenceLevel.HIGH:
        return {
          level,
          colorClass: 'text-green-600',
          icon: 'check-circle',
          message: '高確信度'
        };
      
      case ConfidenceLevel.MEDIUM:
        return {
          level,
          colorClass: 'text-blue-600',
          icon: 'info-circle',
          message: '中確信度'
        };
      
      case ConfidenceLevel.LOW:
        return {
          level,
          colorClass: 'text-yellow-600',
          icon: 'exclamation-triangle',
          message: '低確信度 - 確認をお勧めします'
        };
      
      case ConfidenceLevel.VERY_LOW:
        return {
          level,
          colorClass: 'text-orange-600',
          icon: 'exclamation-circle',
          message: '非常に低い確信度 - 手動確認が必要です'
        };
      
      default:
        return {
          level: null,
          colorClass: 'text-red-600',
          icon: 'times-circle',
          message: 'マッチング不可 - 手動入力が必要です'
        };
    }
  }
}
```

### 2.2 マッチングサービスファクトリ

```typescript
// src/lib/food/food-matching-service-factory.ts を新規作成

import { FoodMatchingService } from './food-matching-service';
import { FoodMatchingServiceImpl } from './food-matching-service-impl';
import { FoodRepositoryType } from './food-repository-factory';

/**
 * 食品マッチングサービスのファクトリクラス
 */
export class FoodMatchingServiceFactory {
  private static instance: FoodMatchingService;
  
  /**
   * 食品マッチングサービスのインスタンスを取得
   */
  static getService(repositoryType: FoodRepositoryType = FoodRepositoryType.BASIC): FoodMatchingService {
    if (!this.instance) {
      this.instance = new FoodMatchingServiceImpl(repositoryType);
    }
    return this.instance;
  }
  
  /**
   * インスタンスを強制的に再作成
   */
  static recreateService(repositoryType: FoodRepositoryType = FoodRepositoryType.BASIC): FoodMatchingService {
    this.instance = new FoodMatchingServiceImpl(repositoryType);
    return this.instance;
  }
}
```

## 3. 食品入力解析のユーティリティ

### 3.1 食品入力解析クラス

```typescript
// src/lib/food/food-input-parser.ts を新規作成

import { FoodMatchingService } from './food-matching-service';
import { FoodMatchingServiceFactory } from './food-matching-service-factory';
import { QuantityParser } from '@/lib/nutrition/quantity-parser';

/**
 * 食品入力テキスト解析結果
 */
export interface FoodInputParseResult {
  /** 食品名 */
  foodName: string;
  
  /** 量の文字列 */
  quantityText: string | null;
  
  /** 解析の確信度 */
  confidence: number;
}

/**
 * 食品入力テキスト解析クラス
 */
export class FoodInputParser {
  /**
   * ユーザー入力テキストから食品名と量を解析
   * @param input ユーザー入力テキスト
   * @returns 解析結果
   */
  static parseInput(input: string): FoodInputParseResult {
    if (!input || input.trim() === '') {
      return {
        foodName: '',
        quantityText: null,
        confidence: 0
      };
    }
    
    const normalizedInput = input.trim();
    
    // パターン1: "食品名 100g" または "食品名　100g"
    const spacePattern = /^(.+?)[\s　]+([0-9０-９]+\.?[0-9０-９]*\s*[a-zA-Zａ-ｚＡ-Ｚ一-龠々ぁ-ヶ]+)$/;
    const spaceMatch = spacePattern.exec(normalizedInput);
    
    if (spaceMatch) {
      return {
        foodName: spaceMatch[1].trim(),
        quantityText: spaceMatch[2].trim(),
        confidence: 0.9
      };
    }
    
    // パターン2: "食品名（100g）" または "食品名(100g)"
    const parenthesesPattern = /^(.+?)[\(（]([0-9０-９]+\.?[0-9０-９]*\s*[a-zA-Zａ-ｚＡ-Ｚ一-龠々ぁ-ヶ]+)[\)）]$/;
    const parenthesesMatch = parenthesesPattern.exec(normalizedInput);
    
    if (parenthesesMatch) {
      return {
        foodName: parenthesesMatch[1].trim(),
        quantityText: parenthesesMatch[2].trim(),
        confidence: 0.9
      };
    }
    
    // パターン3: "食品名100g" (スペースなし)
    const noSpacePattern = /^(.+?)([0-9０-９]+\.?[0-9０-９]*\s*[a-zA-Zａ-ｚＡ-Ｚ一-龠々ぁ-ヶ]+)$/;
    const noSpaceMatch = noSpacePattern.exec(normalizedInput);
    
    if (noSpaceMatch) {
      // 食品名の部分が実際にマッチするか確認
      const possibleFoodName = noSpaceMatch[1].trim();
      
      // 量の部分
      const quantityText = noSpaceMatch[2].trim();
      
      // このパターンは曖昧なので確信度を下げる
      return {
        foodName: possibleFoodName,
        quantityText: quantityText,
        confidence: 0.7
      };
    }
    
    // パターン4: "100g食品名" (量が先)
    const quantityFirstPattern = /^([0-9０-９]+\.?[0-9０-９]*\s*[a-zA-Zａ-ｚＡ-Ｚ一-龠々ぁ-ヶ]+)(.+?)$/;
    const quantityFirstMatch = quantityFirstPattern.exec(normalizedInput);
    
    if (quantityFirstMatch) {
      return {
        foodName: quantityFirstMatch[2].trim(),
        quantityText: quantityFirstMatch[1].trim(),
        confidence: 0.7
      };
    }
    
    // パターン5: 量を含まない単純な食品名
    return {
      foodName: normalizedInput,
      quantityText: null,
      confidence: 0.8
    };
  }
  
  /**
   * 複数食品の一括入力を解析
   * @param input 複数食品の入力テキスト
   * @returns 解析結果のリスト
   */
  static parseBulkInput(input: string): FoodInputParseResult[] {
    if (!input || input.trim() === '') {
      return [];
    }
    
    // 改行、カンマ、または読点で分割
    const lines = input
      .split(/\n|、|,/)
      .map(line => line.trim())
      .filter(line => line !== '');
    
    // 各行を解析
    return lines.map(line => this.parseInput(line));
  }
  
  /**
   * 解析結果から食品名と量の組み合わせリストを生成
   * @param parseResults 解析結果のリスト
   * @returns 食品名と量の組み合わせリスト
   */
  static async generateNameQuantityPairs(
    parseResults: FoodInputParseResult[]
  ): Promise<Array<{ name: string; quantity?: string }>> {
    return parseResults.map(result => ({
      name: result.foodName,
      quantity: result.quantityText
    }));
  }
}
```

## 4. 食品マッチングユーティリティコンポーネント

### 4.1 マッチング結果表示コンポーネント

```typescript
// src/components/food/food-match-badge.tsx を新規作成

import React from 'react';
import { FoodMatchingService } from '@/lib/food/food-matching-service';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';

interface FoodMatchBadgeProps {
  /** 類似度スコア (0.0-1.0) */
  similarity: number;
  /** バッジサイズ */
  size?: 'sm' | 'md' | 'lg';
  /** ラベルを表示するか */
  showLabel?: boolean;
}

/**
 * 食品マッチングの確信度を視覚的に表示するバッジコンポーネント
 */
export const FoodMatchBadge: React.FC<FoodMatchBadgeProps> = ({
  similarity,
  size = 'md',
  showLabel = true
}) => {
  const matchingService = FoodMatchingServiceFactory.getService();
  const display = matchingService.getConfidenceDisplay(similarity);
  
  // サイズに応じたクラス
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };
  
  return (
    <span 
      className={`inline-flex items-center rounded-full ${display.colorClass} ${sizeClasses[size]} 
                 bg-opacity-10 border border-current`}
      title={display.message}
    >
      <span className="mr-1">
        <i className={`fas fa-${display.icon}`} />
      </span>
      {showLabel && (
        <span>{display.message}</span>
      )}
    </span>
  );
};
```

### 4.2 食品検索・編集コンポーネント

```typescript
// src/components/food/food-search-input.tsx を新規作成

import React, { useState, useEffect } from 'react';
import { Food } from '@/types/food';
import { FoodMatchingService } from '@/lib/food/food-matching-service';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';
import { FoodMatchBadge } from './food-match-badge';

interface FoodSearchInputProps {
  /** 初期入力値 */
  initialValue?: string;
  /** 選択された食品のID */
  selectedFoodId?: string;
  /** 食品選択時のコールバック */
  onFoodSelect?: (food: Food, similarity: number) => void;
  /** 入力変更時のコールバック */
  onInputChange?: (value: string) => void;
  /** プレースホルダー */
  placeholder?: string;
  /** 無効状態 */
  disabled?: boolean;
}

/**
 * 食品検索・編集コンポーネント
 */
export const FoodSearchInput: React.FC<FoodSearchInputProps> = ({
  initialValue = '',
  selectedFoodId,
  onFoodSelect,
  onInputChange,
  placeholder = '食品名を入力...',
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [searchResults, setSearchResults] = useState<Array<{ food: Food; similarity: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [similarity, setSimilarity] = useState(0);
  
  const matchingService = FoodMatchingServiceFactory.getService();
  
  // 初期選択食品の読み込み
  useEffect(() => {
    const loadInitialFood = async () => {
      if (selectedFoodId) {
        try {
          // インポートは後で適切に修正
          const repository = await import('@/lib/food/food-repository-factory')
            .then(m => m.FoodRepositoryFactory.getRepository());
          
          const food = await repository.getFoodById(selectedFoodId);
          if (food) {
            setSelectedFood(food);
            setInputValue(food.name);
            setSimilarity(1.0); // 明示的に選択された場合は確信度1.0
          }
        } catch (error) {
          console.error('初期食品の読み込みエラー:', error);
        }
      }
    };
    
    loadInitialFood();
  }, [selectedFoodId]);
  
  // 入力値の変更処理
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    if (onInputChange) {
      onInputChange(value);
    }
    
    // 入力が変更されたら選択をクリア
    setSelectedFood(null);
    setSimilarity(0);
    
    // 文字数が2文字以上ある場合に検索
    if (value.length >= 2) {
      searchFoods(value);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };
  
  // 食品検索
  const searchFoods = async (query: string) => {
    setIsSearching(true);
    try {
      const results = await matchingService.matchFoods([query]);
      const matchResult = results.get(query);
      
      if (matchResult) {
        setSearchResults([{ food: matchResult.food, similarity: matchResult.similarity }]);
      } else {
        // インポートは後で適切に修正
        const repository = await import('@/lib/food/food-repository-factory')
          .then(m => m.FoodRepositoryFactory.getRepository());
        
        const fuzzyResults = await repository.searchFoodsByFuzzyMatch(query, 5);
        setSearchResults(fuzzyResults.map(r => ({ food: r.food, similarity: r.similarity })));
      }
      
      setShowResults(true);
    } catch (error) {
      console.error('食品検索エラー:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  // 食品選択処理
  const handleSelectFood = (food: Food, similarity: number) => {
    setSelectedFood(food);
    setInputValue(food.name);
    setSimilarity(similarity);
    setShowResults(false);
    
    if (onFoodSelect) {
      onFoodSelect(food, similarity);
    }
  };
  
  return (
    <div className="relative">
      <div className="flex items-center">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue.length >= 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
        />
        
        {isSearching && (
          <div className="absolute right-3">
            <i className="fas fa-spinner fa-spin text-gray-400" />
          </div>
        )}
        
        {selectedFood && !isSearching && (
          <div className="absolute right-3">
            <FoodMatchBadge similarity={similarity} size="sm" showLabel={false} />
          </div>
        )}
      </div>
      
      {showResults && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
          {searchResults.map((result, index) => (
            <div
              key={index}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
              onClick={() => handleSelectFood(result.food, result.similarity)}
            >
              <div>
                <div className="font-medium">{result.food.name}</div>
                <div className="text-xs text-gray-500">{result.food.category}</div>
              </div>
              <FoodMatchBadge similarity={result.similarity} size="sm" showLabel={false} />
            </div>
          ))}
        </div>
      )}
      
      {showResults && searchResults.length === 0 && !isSearching && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-center text-gray-500">
          結果がありません
        </div>
      )}
    </div>
  );
};
```

## 5. 実装手順

1. `src/lib/food/food-matching-service.ts` を作成し、マッチングサービスインターフェースを定義
2. `src/lib/food/food-matching-service-impl.ts` を作成し、マッチングサービス実装を作成
3. `src/lib/food/food-matching-service-factory.ts` を作成し、ファクトリクラスを実装
4. `src/lib/food/food-input-parser.ts` を作成し、食品入力解析クラスを実装
5. `src/components/food/food-match-badge.tsx` を作成し、マッチング結果バッジコンポーネントを実装
6. `src/components/food/food-search-input.tsx` を作成し、食品検索コンポーネントを実装
7. 食品マッチングサービスのユニットテストを作成
8. 食品入力解析クラスのユニットテストを作成
9. コンポーネントのStorybook作成と視覚的テスト 