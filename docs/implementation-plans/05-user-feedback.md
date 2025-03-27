# フェーズ4: ユーザーフィードバック機能の強化

## 1. 確信度表示コンポーネントの実装

### 1.1 確信度インジケーターコンポーネント

```typescript
// src/components/food/confidence-indicator.tsx を新規作成

import React from 'react';
import { ConfidenceLevel } from '@/types/food';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';

interface ConfidenceIndicatorProps {
  /** 確信度スコア (0.0-1.0) */
  confidenceScore: number;
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** ラベルを表示するか */
  showLabel?: boolean;
  /** アイコンを表示するか */
  showIcon?: boolean;
  /** バッジスタイル */
  badgeStyle?: boolean;
}

/**
 * 確信度を視覚的に表示するコンポーネント
 */
export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidenceScore,
  size = 'md',
  showLabel = true,
  showIcon = true,
  badgeStyle = true
}) => {
  const matchingService = FoodMatchingServiceFactory.getService();
  const display = matchingService.getConfidenceDisplay(confidenceScore);
  
  // サイズに応じたクラス
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };
  
  if (badgeStyle) {
    const paddingClass = {
      sm: 'px-1.5 py-0.5',
      md: 'px-2 py-1',
      lg: 'px-3 py-1.5'
    };
    
    return (
      <span 
        className={`inline-flex items-center rounded-full ${display.colorClass} ${sizeClasses[size]} ${paddingClass[size]} 
                   bg-opacity-10 border border-current`}
        title={display.message}
      >
        {showIcon && (
          <span className="mr-1">
            <i className={`fas fa-${display.icon}`} />
          </span>
        )}
        {showLabel && (
          <span>{display.message}</span>
        )}
      </span>
    );
  }
  
  return (
    <div className={`flex items-center ${sizeClasses[size]}`} title={display.message}>
      {showIcon && (
        <i className={`fas fa-${display.icon} ${display.colorClass} mr-1`} />
      )}
      {showLabel && (
        <span className={display.colorClass}>{display.message}</span>
      )}
    </div>
  );
};
```

## 2. 栄養計算結果表示の強化

### 2.1 栄養信頼性インジケーター

```typescript
// src/components/nutrition/reliability-indicator.tsx を新規作成

import React from 'react';
import { NutritionCalculationResult } from '@/types/nutrition';
import { ConfidenceIndicator } from '../food/confidence-indicator';

interface ReliabilityIndicatorProps {
  /** 栄養計算結果 */
  result: NutritionCalculationResult;
  /** 詳細を表示するか */
  showDetails?: boolean;
}

/**
 * 栄養計算の信頼性を表示するコンポーネント
 */
export const ReliabilityIndicator: React.FC<ReliabilityIndicatorProps> = ({
  result,
  showDetails = true
}) => {
  const { reliability } = result;
  const { overallConfidence, lowConfidenceFoods, notFoundFoods } = reliability;
  
  const hasIssues = lowConfidenceFoods.length > 0 || notFoundFoods.length > 0;
  
  return (
    <div className="mt-2 mb-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">栄養計算の信頼性</div>
        <ConfidenceIndicator confidenceScore={overallConfidence} size="md" showLabel={true} />
      </div>
      
      {showDetails && hasIssues && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
          {lowConfidenceFoods.length > 0 && (
            <div className="mb-2">
              <div className="text-yellow-600 font-medium mb-1">
                <i className="fas fa-exclamation-triangle mr-1"></i>
                低確信度の食品
              </div>
              <ul className="pl-5 list-disc">
                {lowConfidenceFoods.map((food, index) => (
                  <li key={index}>{food}</li>
                ))}
              </ul>
            </div>
          )}
          
          {notFoundFoods.length > 0 && (
            <div>
              <div className="text-red-600 font-medium mb-1">
                <i className="fas fa-times-circle mr-1"></i>
                マッチしなかった食品
              </div>
              <ul className="pl-5 list-disc">
                {notFoundFoods.map((food, index) => (
                  <li key={index}>{food}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="mt-3 text-gray-600 text-xs">
            <i className="fas fa-info-circle mr-1"></i>
            低確信度の食品は栄養値が実際と異なる可能性があります。編集ボタンから食品を確認・修正してください。
          </div>
        </div>
      )}
    </div>
  );
};
```

### 2.2 栄養計算結果サマリー

```typescript
// src/components/nutrition/nutrition-summary.tsx を新規作成

import React from 'react';
import { NutritionCalculationResult } from '@/types/nutrition';
import { ReliabilityIndicator } from './reliability-indicator';

interface NutritionSummaryProps {
  /** 栄養計算結果 */
  result: NutritionCalculationResult;
  /** バランススコアを表示するか */
  showBalanceScore?: boolean;
}

/**
 * 栄養計算結果のサマリー表示コンポーネント
 */
export const NutritionSummary: React.FC<NutritionSummaryProps> = ({
  result,
  showBalanceScore = true
}) => {
  const { nutrition } = result;
  
  // 栄養素名のマッピング
  const nutrientLabels = {
    calories: 'カロリー',
    protein: 'タンパク質',
    iron: '鉄分',
    folic_acid: '葉酸',
    calcium: 'カルシウム',
    vitamin_d: 'ビタミンD'
  };
  
  // 栄養素の単位
  const nutrientUnits = {
    calories: 'kcal',
    protein: 'g',
    iron: 'mg',
    folic_acid: 'μg',
    calcium: 'mg',
    vitamin_d: 'μg'
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-3">栄養素サマリー</h3>
      
      <ReliabilityIndicator result={result} />
      
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(nutrition).map(([key, value]) => (
          <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <div className="font-medium">{nutrientLabels[key] || key}</div>
            <div>
              {Math.round(value * 10) / 10} {nutrientUnits[key] || ''}
            </div>
          </div>
        ))}
      </div>
      
      {showBalanceScore && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="font-medium mb-1">栄養バランススコア</div>
          <div className="flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${Math.min(Math.round(calculateBalanceScore(nutrition)), 100)}%` }}
              ></div>
            </div>
            <div className="ml-3 font-semibold">
              {Math.min(Math.round(calculateBalanceScore(nutrition)), 100)}/100
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            このスコアは妊娠期に重要な栄養素の充足率に基づいて計算されています。
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 栄養バランススコアの計算
 * @private
 */
function calculateBalanceScore(nutrition: any): number {
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
  
  return score;
}
```

## 3. 食品マッチング編集コンポーネント

### 3.1 食品編集モーダル

```typescript
// src/components/food/food-edit-modal.tsx を新規作成

import React, { useState } from 'react';
import { Food, FoodQuantity } from '@/types/food';
import { FoodSearchInput } from './food-search-input';
import { QuantityParser } from '@/lib/nutrition/quantity-parser';
import { ConfidenceIndicator } from './confidence-indicator';

interface FoodEditModalProps {
  /** 編集対象の食品名 */
  foodName: string;
  /** 編集対象の量 */
  quantity?: string;
  /** モーダルを表示するか */
  isOpen: boolean;
  /** 確定時のコールバック */
  onConfirm: (food: Food, quantity: FoodQuantity, confidence: number) => void;
  /** キャンセル時のコールバック */
  onCancel: () => void;
}

/**
 * 食品編集モーダル
 */
export const FoodEditModal: React.FC<FoodEditModalProps> = ({
  foodName,
  quantity,
  isOpen,
  onConfirm,
  onCancel
}) => {
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [similarityScore, setSimilarityScore] = useState(0);
  const [quantityValue, setQuantityValue] = useState(quantity || '');
  const [quantityUnit, setQuantityUnit] = useState('g');
  
  // 単位の選択肢
  const unitOptions = [
    { value: 'g', label: 'グラム (g)' },
    { value: '個', label: '個' },
    { value: '大さじ', label: '大さじ' },
    { value: '小さじ', label: '小さじ' },
    { value: 'カップ', label: 'カップ' },
    { value: '切れ', label: '切れ' }
  ];
  
  // 食品選択時の処理
  const handleFoodSelect = (food: Food, similarity: number) => {
    setSelectedFood(food);
    setSimilarityScore(similarity);
  };
  
  // 確定ボタンのクリック処理
  const handleConfirm = () => {
    if (!selectedFood) return;
    
    // 数値のみの入力を処理
    const numericValue = parseFloat(quantityValue);
    if (isNaN(numericValue) || numericValue <= 0) {
      alert('有効な数値を入力してください');
      return;
    }
    
    // 量の作成
    const foodQuantity: FoodQuantity = {
      value: numericValue,
      unit: quantityUnit
    };
    
    onConfirm(selectedFood, foodQuantity, similarityScore);
  };
  
  // モーダルが閉じている場合
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">食品の編集</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            食品名
          </label>
          <FoodSearchInput
            initialValue={foodName}
            onFoodSelect={handleFoodSelect}
            placeholder="食品名を入力または選択"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            量
          </label>
          <div className="flex items-center">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={quantityValue}
              onChange={(e) => setQuantityValue(e.target.value)}
              className="w-24 px-3 py-2 border rounded-lg mr-2"
              placeholder="数値"
            />
            <select
              value={quantityUnit}
              onChange={(e) => setQuantityUnit(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              {unitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {selectedFood && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-medium">マッチング結果</div>
              <ConfidenceIndicator confidenceScore={similarityScore} size="sm" />
            </div>
            <div className="text-sm">
              <div><span className="font-medium">食品名:</span> {selectedFood.name}</div>
              <div><span className="font-medium">カテゴリ:</span> {selectedFood.category}</div>
              <div><span className="font-medium">カロリー:</span> {selectedFood.calories}kcal/100g</div>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedFood}
            className={`px-4 py-2 rounded-lg text-white ${
              selectedFood ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 3.2 食品リスト編集コンポーネント

```typescript
// src/components/food/food-list-editor.tsx を新規作成

import React, { useState } from 'react';
import { Food, FoodQuantity } from '@/types/food';
import { ConfidenceIndicator } from './confidence-indicator';
import { FoodEditModal } from './food-edit-modal';

interface FoodListItem {
  id: string;
  food: Food;
  quantity: FoodQuantity;
  confidence: number;
}

interface FoodListEditorProps {
  /** 食品リスト */
  foodItems: FoodListItem[];
  /** リスト変更時のコールバック */
  onListChange: (items: FoodListItem[]) => void;
  /** 確信度表示の有効化 */
  showConfidence?: boolean;
}

/**
 * 食品リストの編集コンポーネント
 */
export const FoodListEditor: React.FC<FoodListEditorProps> = ({
  foodItems,
  onListChange,
  showConfidence = true
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  // 編集モーダルを開く
  const openEditModal = (itemId: string) => {
    setEditingItemId(itemId);
  };
  
  // 編集モーダルを閉じる
  const closeEditModal = () => {
    setEditingItemId(null);
  };
  
  // 食品の編集確定
  const handleEditConfirm = (food: Food, quantity: FoodQuantity, confidence: number) => {
    if (!editingItemId) return;
    
    // 編集対象の食品を更新
    const updatedItems = foodItems.map(item => {
      if (item.id === editingItemId) {
        return {
          ...item,
          food,
          quantity,
          confidence
        };
      }
      return item;
    });
    
    onListChange(updatedItems);
    closeEditModal();
  };
  
  // 食品の削除
  const handleDeleteItem = (itemId: string) => {
    const updatedItems = foodItems.filter(item => item.id !== itemId);
    onListChange(updatedItems);
  };
  
  // 編集中の食品を取得
  const getEditingItem = () => {
    if (!editingItemId) return null;
    return foodItems.find(item => item.id === editingItemId) || null;
  };
  
  const editingItem = getEditingItem();
  
  return (
    <div>
      <div className="mb-3 flex justify-between items-center">
        <h3 className="text-lg font-semibold">食品リスト</h3>
        <button
          onClick={() => {
            // 新しい空の食品を追加
            const newItem: FoodListItem = {
              id: `new-${Date.now()}`,
              food: null,
              quantity: { value: 100, unit: 'g' },
              confidence: 0
            };
            onListChange([...foodItems, newItem]);
            openEditModal(newItem.id);
          }}
          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          食品を追加
        </button>
      </div>
      
      {foodItems.length === 0 ? (
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
          食品が登録されていません
        </div>
      ) : (
        <div className="space-y-2">
          {foodItems.map(item => (
            <div
              key={item.id}
              className="p-3 border rounded-lg flex justify-between items-center hover:bg-gray-50"
            >
              <div className="flex-grow">
                <div className="font-medium">{item.food?.name || '(未選択)'}</div>
                <div className="text-sm text-gray-600 flex items-center">
                  <span>{item.quantity.value} {item.quantity.unit}</span>
                  {showConfidence && item.food && (
                    <span className="ml-3">
                      <ConfidenceIndicator
                        confidenceScore={item.confidence}
                        size="sm"
                        showLabel={false}
                      />
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => openEditModal(item.id)}
                  className="p-1 text-blue-600 hover:text-blue-800"
                  title="編集"
                >
                  <i className="fas fa-edit" />
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1 ml-2 text-red-600 hover:text-red-800"
                  title="削除"
                >
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {editingItem && (
        <FoodEditModal
          isOpen={!!editingItemId}
          foodName={editingItem.food?.name || ''}
          quantity={editingItem.quantity ? `${editingItem.quantity.value}` : ''}
          onConfirm={handleEditConfirm}
          onCancel={closeEditModal}
        />
      )}
    </div>
  );
};
```

## 4. 実装手順

1. `src/components/food/confidence-indicator.tsx` を作成し、確信度表示コンポーネントを実装
2. `src/components/nutrition/reliability-indicator.tsx` を作成し、信頼性インジケーターを実装
3. `src/components/nutrition/nutrition-summary.tsx` を作成し、栄養サマリーコンポーネントを実装
4. `src/components/food/food-edit-modal.tsx` を作成し、食品編集モーダルを実装
5. `src/components/food/food-list-editor.tsx` を作成し、食品リスト編集コンポーネントを実装
6. 各コンポーネントのStorybook作成と視覚的テスト
7. 既存の食品認識エディターを新しいコンポーネントに置き換え
8. ユーザーフィードバック機能のE2Eテスト 