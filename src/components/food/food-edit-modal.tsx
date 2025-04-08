import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { ConfidenceIndicator } from './confidence-indicator';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';
import debounce from 'lodash/debounce';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';

export interface FoodItem {
    /** 食品ID */
    id?: string;
    /** 食品名 */
    name: string;
    /** 食品量（テキスト表現） */
    quantity?: string | undefined;
    /** マッチング確信度 */
    confidence?: number;
    /** カテゴリ */
    category?: string;
}

export interface FoodEditModalProps {
    /** モーダルが開いているかどうか */
    isOpen: boolean;
    /** モーダルを閉じる関数 */
    onClose: () => void;
    /** 編集対象の食品 */
    food: FoodItem;
    /** 食品の更新ハンドラー */
    onUpdate: (updatedFood: FoodItem) => void;
    /** 食品の削除ハンドラー */
    onDelete?: () => void;
}

/**
 * 食品編集モーダルコンポーネント
 * 
 * 食品名と量を編集するためのモーダルダイアログ。
 * 食品名の検索機能も含みます。
 */
export const FoodEditModal: React.FC<FoodEditModalProps> = ({
    isOpen,
    onClose,
    food,
    onUpdate,
    onDelete
}) => {
    const [foodName, setFoodName] = useState(food.name);
    const [quantity, setQuantity] = useState(food.quantity || '');
    const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // 検索結果のリセット
    useEffect(() => {
        if (isOpen) {
            setFoodName(food.name);
            setQuantity(food.quantity || '');
            setSearchResults([]);
        }
    }, [isOpen, food]);

    // 食品名検索
    const searchFood = useCallback(
        debounce(async (query: string) => {
            if (query.length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                // 食品リポジトリを使用して検索
                const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
                const results = await foodRepo.searchFoodsByFuzzyMatch(query, 5);
                setSearchResults(results.map(result => ({
                    id: result.food.id,
                    name: result.food.name,
                    confidence: result.similarity,
                    category: result.food.category
                })));
            } catch (error) {
                console.error('食品検索エラー:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300),
        []
    );

    // 食品名変更時の検索
    useEffect(() => {
        searchFood(foodName);
    }, [foodName, searchFood]);

    // 更新ハンドラー
    const handleUpdate = () => {
        const updatedFood: FoodItem = {
            name: foodName,
            quantity: quantity || undefined,
            ...(food.id !== undefined && { id: food.id }),
            ...(food.category !== undefined && { category: food.category }),
            ...(food.confidence !== undefined && { confidence: food.confidence })
        };
        onUpdate(updatedFood);
        onClose();
    };

    // 検索結果を選択
    const selectSearchResult = (result: FoodItem) => {
        setFoodName(result.name);
        // 食品IDも更新するため、onUpdateを呼び出す前に更新対象の食品を作成
        const updatedFood: FoodItem = {
            name: result.name,
            quantity,
            ...(result.id !== undefined && { id: result.id }),
            ...(result.category !== undefined && { category: result.category }),
            ...(result.confidence !== undefined && { confidence: result.confidence })
        };
        onUpdate(updatedFood);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-medium">食品情報の編集</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-100"
                        aria-label="閉じる"
                    >
                        <XMarkIcon className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-4">
                    <div className="mb-4">
                        <label htmlFor="food-name" className="block text-sm font-medium text-gray-700 mb-1">
                            食品名
                        </label>
                        <input
                            id="food-name"
                            type="text"
                            value={foodName}
                            onChange={(e) => setFoodName(e.target.value)}
                            className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="例: トマト"
                        />

                        {/* 検索結果 */}
                        {searchResults.length > 0 && (
                            <div className="mt-2 border rounded-md shadow-sm max-h-48 overflow-y-auto">
                                {isSearching ? (
                                    <div className="p-3 text-center text-sm text-gray-500">
                                        検索中...
                                    </div>
                                ) : (
                                    <ul className="divide-y">
                                        {searchResults.map((result) => (
                                            <li
                                                key={result.id}
                                                className="p-2 hover:bg-gray-50 cursor-pointer"
                                                onClick={() => selectSearchResult(result)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium">{result.name}</div>
                                                        {result.category && (
                                                            <div className="text-xs text-gray-500">{result.category}</div>
                                                        )}
                                                    </div>
                                                    {result.confidence !== undefined && (
                                                        <ConfidenceIndicator
                                                            confidenceScore={result.confidence}
                                                            size="sm"
                                                        />
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mb-4">
                        <label htmlFor="food-quantity" className="block text-sm font-medium text-gray-700 mb-1">
                            量
                        </label>
                        <input
                            id="food-quantity"
                            type="text"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="例: 100g、1個、大さじ2"
                        />
                    </div>

                    {food.confidence !== undefined && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-md">
                            <div className="text-sm text-gray-700 mb-1">マッチング確信度:</div>
                            <ConfidenceIndicator confidenceScore={food.confidence} />
                        </div>
                    )}
                </div>

                <div className="p-4 border-t flex justify-between">
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md"
                            type="button"
                        >
                            削除
                        </button>
                    )}
                    <div className="flex space-x-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border rounded-md"
                            type="button"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleUpdate}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            type="button"
                        >
                            更新
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}; 