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