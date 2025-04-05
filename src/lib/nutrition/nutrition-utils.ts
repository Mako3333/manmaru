import {
    StandardizedMealData,
    StandardizedMealNutrition,
    Nutrient,
    FoodItemNutrition,
    NutritionData,
    FoodItem,
    NutrientUnit
} from '@/types/nutrition';
import {
    createStandardizedMealNutrition
} from './nutrition-type-utils';
//src\lib\nutrition\nutrition-utils.ts
/**
 * 既存のNutritionData型からStandardizedMealNutritionへの変換
 */
export function convertToStandardizedNutrition(
    nutritionData: NutritionData,
    foodItems: FoodItem[]
): StandardizedMealNutrition {
    // 基本栄養素の配列を作成
    const nutrients: Nutrient[] = [
        {
            name: 'タンパク質',
            value: nutritionData.protein,
            unit: 'g' as NutrientUnit
        },
        {
            name: '鉄分',
            value: nutritionData.iron,
            unit: 'mg' as NutrientUnit
        },
        {
            name: '葉酸',
            value: nutritionData.folic_acid,
            unit: 'mcg' as NutrientUnit
        },
        {
            name: 'カルシウム',
            value: nutritionData.calcium,
            unit: 'mg' as NutrientUnit
        },
        {
            name: 'ビタミンD',
            value: nutritionData.vitamin_d,
            unit: 'mcg' as NutrientUnit
        }
    ];

    // 拡張栄養素があれば追加
    if (nutritionData.extended_nutrients) {
        // 主要栄養素
        if (typeof nutritionData.extended_nutrients.fat === 'number') {
            nutrients.push({
                name: '脂質',
                value: nutritionData.extended_nutrients.fat,
                unit: 'g' as NutrientUnit
            });
        }

        if (typeof nutritionData.extended_nutrients.carbohydrate === 'number') {
            nutrients.push({
                name: '炭水化物',
                value: nutritionData.extended_nutrients.carbohydrate,
                unit: 'g' as NutrientUnit
            });
        }

        if (typeof nutritionData.extended_nutrients.dietary_fiber === 'number') {
            nutrients.push({
                name: '食物繊維',
                value: nutritionData.extended_nutrients.dietary_fiber,
                unit: 'g' as NutrientUnit
            });
        }

        // ミネラル類
        if (nutritionData.extended_nutrients.minerals) {
            const minerals = nutritionData.extended_nutrients.minerals;
            const mineralUnits: Record<string, NutrientUnit> = {
                sodium: 'mg',
                potassium: 'mg',
                magnesium: 'mg',
                phosphorus: 'mg',
                zinc: 'mg'
            };

            const mineralNames: Record<string, string> = {
                sodium: 'ナトリウム',
                potassium: 'カリウム',
                magnesium: 'マグネシウム',
                phosphorus: 'リン',
                zinc: '亜鉛'
            };

            for (const [key, value] of Object.entries(minerals)) {
                if (typeof value === 'number' && value > 0) {
                    nutrients.push({
                        name: mineralNames[key] || key,
                        value: value,
                        unit: mineralUnits[key] as NutrientUnit || 'mg' as NutrientUnit
                    });
                }
            }
        }

        // ビタミン類
        if (nutritionData.extended_nutrients.vitamins) {
            const vitamins = nutritionData.extended_nutrients.vitamins;
            const vitaminUnits: Record<string, NutrientUnit> = {
                vitamin_a: 'mcg',
                vitamin_b1: 'mg',
                vitamin_b2: 'mg',
                vitamin_b6: 'mg',
                vitamin_b12: 'mcg',
                vitamin_c: 'mg',
                vitamin_e: 'mg',
                vitamin_k: 'mcg'
            };

            const vitaminNames: Record<string, string> = {
                vitamin_a: 'ビタミンA',
                vitamin_b1: 'ビタミンB1',
                vitamin_b2: 'ビタミンB2',
                vitamin_b6: 'ビタミンB6',
                vitamin_b12: 'ビタミンB12',
                vitamin_c: 'ビタミンC',
                vitamin_e: 'ビタミンE',
                vitamin_k: 'ビタミンK'
            };

            for (const [key, value] of Object.entries(vitamins)) {
                if (typeof value === 'number' && value > 0) {
                    nutrients.push({
                        name: vitaminNames[key] || key,
                        value: value,
                        unit: vitaminUnits[key] as NutrientUnit || 'mg' as NutrientUnit
                    });
                }
            }
        }
    }

    // FoodItemNutrition形式に変換
    const standardizedFoodItems = foodItems.map((item, index) => {
        return {
            id: item.id || `item-${Date.now()}-${index}`,
            name: item.name,
            amount: parseFloat(item.quantity?.split(' ')[0] || '1'),
            unit: item.quantity?.split(' ')[1] || 'g',
            nutrition: {
                calories: nutritionData.calories / foodItems.length, // 単純に分割
                nutrients: nutrients.map(n => ({ ...n, value: n.value / foodItems.length })), // 単純に分割
                servingSize: {
                    value: 100,
                    unit: 'g'
                }
            }
        };
    });

    return {
        totalCalories: nutritionData.calories,
        totalNutrients: nutrients,
        foodItems: standardizedFoodItems,
        pregnancySpecific: {
            folatePercentage: (nutritionData.folic_acid / 400) * 100, // 400mcgを100%とする
            ironPercentage: (nutritionData.iron / 20) * 100, // 20mgを100%とする
            calciumPercentage: (nutritionData.calcium / 800) * 100 // 800mgを100%とする
        },
        reliability: {
            confidence: nutritionData.confidence_score || 0.7 // デフォルト値
        }
    };
}

/**
 * AI分析結果から栄養データを抽出・標準化
 */
export function normalizeNutritionData(
    aiAnalysisResult: any,
    fallbackToLegacy: boolean = true
): StandardizedMealNutrition {
    try {
        // 新しい形式のデータが利用可能な場合
        if (aiAnalysisResult.standardizedNutrition) {
            return aiAnalysisResult.standardizedNutrition;
        }

        // 従来の形式のデータしかない場合
        if (fallbackToLegacy && aiAnalysisResult.nutrition && aiAnalysisResult.foods) {
            return convertToStandardizedNutrition(
                aiAnalysisResult.nutrition,
                aiAnalysisResult.foods
            );
        }

        // 最低限のデータを返す
        return {
            totalCalories: 0,
            totalNutrients: [],
            foodItems: [],
            pregnancySpecific: {
                folatePercentage: 0,
                ironPercentage: 0,
                calciumPercentage: 0
            },
            reliability: {
                confidence: 0.5
            }
        };
    } catch (error) {
        console.error('栄養データの正規化に失敗:', error);

        // 最低限のデータを返す
        return {
            totalCalories: 0,
            totalNutrients: [],
            foodItems: [],
            pregnancySpecific: {
                folatePercentage: 0,
                ironPercentage: 0,
                calciumPercentage: 0
            },
            reliability: {
                confidence: 0.5
            }
        };
    }
}

/**
 * 標準化されたデータから従来のNutritionData形式に変換
 */
export function convertToLegacyNutrition(standardized: StandardizedMealNutrition): NutritionData {
    // 特定の栄養素を探す (日本語名と英語名、大文字小文字区別なしで検索)
    const findNutrientValue = (nameJP: string, nameEN: string): number => {
        const nutrient = standardized.totalNutrients.find(n => {
            const lowerCaseName = n.name.toLowerCase();
            return lowerCaseName === nameJP.toLowerCase() || lowerCaseName === nameEN.toLowerCase();
        });
        // nutrient?.value が 0 の場合も考慮し、nullish coalescing (??) を使用
        return nutrient?.value ?? 0;
    };

    // 基本栄養素を設定
    const result: NutritionData = {
        calories: standardized.totalCalories,
        protein: findNutrientValue('タンパク質', 'protein'),
        iron: findNutrientValue('鉄分', 'iron'),
        folic_acid: findNutrientValue('葉酸', 'folic_acid'),
        calcium: findNutrientValue('カルシウム', 'calcium'),
        vitamin_d: findNutrientValue('ビタミンD', 'vitamin_d'),
        confidence_score: standardized.reliability?.confidence ?? 0.9, // nullish coalescing
        extended_nutrients: {
            // 追加の主要栄養素
            fat: findNutrientValue('脂質', 'fat'),
            carbohydrate: findNutrientValue('炭水化物', 'carbohydrate'),
            dietary_fiber: findNutrientValue('食物繊維', 'dietary_fiber'),
            sugars: findNutrientValue('糖質', 'sugars'),
            salt: findNutrientValue('食塩相当量', 'salt'),

            // ビタミン類
            vitamins: {
                vitamin_a: findNutrientValue('ビタミンA', 'vitamin_a'),
                vitamin_c: findNutrientValue('ビタミンC', 'vitamin_c'),
                vitamin_e: findNutrientValue('ビタミンE', 'vitamin_e'),
                vitamin_k: findNutrientValue('ビタミンK', 'vitamin_k'),
                vitamin_b1: findNutrientValue('ビタミンB1', 'vitamin_b1'),
                vitamin_b2: findNutrientValue('ビタミンB2', 'vitamin_b2'),
                vitamin_b6: findNutrientValue('ビタミンB6', 'vitamin_b6'),
                vitamin_b12: findNutrientValue('ビタミンB12', 'vitamin_b12')
            },

            // ミネラル類
            minerals: {
                sodium: findNutrientValue('ナトリウム', 'sodium'),
                potassium: findNutrientValue('カリウム', 'potassium'),
                magnesium: findNutrientValue('マグネシウム', 'magnesium'),
                phosphorus: findNutrientValue('リン', 'phosphorus'),
                zinc: findNutrientValue('亜鉛', 'zinc')
            }
        }
    };

    return result;
}

/**
 * 食事データを検証する
 */
export function validateMealData(mealData: Partial<StandardizedMealData>): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    // 必須フィールドのチェック
    if (!mealData.user_id) errors.push('ユーザーIDが必要です');
    if (!mealData.meal_date) errors.push('食事日時が必要です');
    if (!mealData.meal_type) errors.push('食事タイプが必要です');
    if (!mealData.meal_items || mealData.meal_items.length === 0) {
        errors.push('少なくとも1つの食品項目が必要です');
    }

    // 栄養データのチェック
    if (!mealData.nutrition_data) {
        errors.push('栄養データが必要です');
    } else {
        if (mealData.nutrition_data.totalCalories < 0) {
            errors.push('総カロリーは0以上である必要があります');
        }
        if (!mealData.nutrition_data.foodItems || mealData.nutrition_data.foodItems.length === 0) {
            errors.push('栄養データに食品アイテムが含まれていません');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * レガシーシステムとの互換性のために、
 * StandardizedMealDataをAPIリクエスト用に変換
 */
export function prepareForApiRequest(standardizedData: StandardizedMealData) {
    // 従来の形式に変換された栄養データ
    const legacyNutrition = convertToLegacyNutrition(standardizedData.nutrition_data);

    return {
        meal_type: standardizedData.meal_type,
        meal_date: standardizedData.meal_date,
        photo_url: standardizedData.image_url,
        food_description: {
            items: standardizedData.meal_items.map(item => ({
                name: item.name,
                quantity: `${item.amount} ${item.unit}`,
                image_url: item.image_url
            }))
        },
        // データベース構造に合わせて栄養データをフォーマット
        nutrition_data: legacyNutrition,
        // 新しいAPIレスポンス構造をサポート
        nutritionResult: {
            nutrition: standardizedData.nutrition_data,
            legacyNutrition: legacyNutrition,
            reliability: {
                confidence: legacyNutrition.confidence_score || 0.8
            }
        },
        // meal_nutrientsテーブル用のデータ
        nutrition: {
            calories: legacyNutrition.calories,
            protein: legacyNutrition.protein,
            iron: legacyNutrition.iron,
            folic_acid: legacyNutrition.folic_acid,
            calcium: legacyNutrition.calcium,
            vitamin_d: legacyNutrition.vitamin_d || 0,
            confidence_score: legacyNutrition.confidence_score
        },
        servings: 1,
        notes: standardizedData.notes
    };
}

/**
 * 安全な型変換ユーティリティ関数
 * 型変換におけるエラー処理と回復メカニズムを実装
 */
export function safeConvertNutritionData(
    sourceData: any,
    sourceType: 'nutrient' | 'standard' | 'old' = 'nutrient'
): NutritionData {
    try {
        if (!sourceData) {
            throw new Error('変換元データがnullまたはundefined');
        }

        switch (sourceType) {
            case 'nutrient':
                return createEmptyNutritionData();
            case 'standard':
                return convertToLegacyNutrition(sourceData);
            case 'old':
                return convertOldToNutritionData(sourceData);
            default:
                throw new Error(`未知の変換タイプ: ${sourceType}`);
        }
    } catch (error) {
        console.error(`栄養データ変換エラー (${sourceType}):`, error, {
            sourceData: JSON.stringify(sourceData).substring(0, 200) + '...'
        });

        // 型に準拠した最小限のデータを返却
        return createEmptyNutritionData();
    }
}

/**
 * エラー時のフォールバック用の空の栄養データを作成
 */
export function createEmptyNutritionData(): NutritionData {
    return {
        calories: 0,
        protein: 0,
        iron: 0,
        folic_acid: 0,
        calcium: 0,
        vitamin_d: 0,
        confidence_score: 0.5,
        not_found_foods: ['変換エラー'],
        extended_nutrients: {}
    };
}

/**
 * 古い栄養データ型から新しい栄養データ型への変換
 */
export function convertOldToNutritionData(oldData: any): NutritionData {
    if (!oldData) {
        throw new Error('変換元の古い栄養データがnullまたはundefined');
    }

    return {
        calories: oldData.calories || 0,
        protein: oldData.protein || 0,
        iron: oldData.iron || 0,
        folic_acid: oldData.folic_acid || 0,
        calcium: oldData.calcium || 0,
        vitamin_d: oldData.vitamin_d || 0,
        confidence_score: oldData.confidence_score || 0.5,
        not_found_foods: oldData.notFoundFoods,
        extended_nutrients: {}
    };
} 