/**
 * 栄養データ型の変換ユーティリティ
 * このファイルには、NutritionDataとStandardizedMealNutritionの相互変換や
 * ユーティリティ関数を定義します
 */

import {
    NutritionData,
    StandardizedMealNutrition,
    Nutrient,
    NutrientUnit,
    NutrientDisplayData,
    FoodItemNutrition
} from '../../types/nutrition';
import { AppError } from '../error/types/base-error';
import { ErrorCode } from '../error/codes/error-codes';

/**
 * JSONデータからNutritionData型へパース
 */
export function parseNutritionFromJson(jsonData: any): NutritionData {
    try {
        if (typeof jsonData === 'string') {
            jsonData = JSON.parse(jsonData);
        }

        return {
            calories: Number(jsonData.calories || 0),
            protein: Number(jsonData.protein || 0),
            iron: Number(jsonData.iron || 0),
            folic_acid: Number(jsonData.folic_acid || 0),
            calcium: Number(jsonData.calcium || 0),
            vitamin_d: Number(jsonData.vitamin_d || 0),
            confidence_score: Number(jsonData.confidence_score || 0.5),
            extended_nutrients: jsonData.extended_nutrients,
            not_found_foods: jsonData.not_found_foods
        };
    } catch (error) {
        console.error('Failed to parse nutrition data:', error);
        return createEmptyNutritionData();
    }
}

/**
 * NutritionDataをJSONに変換
 */
export function serializeNutritionToJson(data: NutritionData): any {
    try {
        return {
            ...data,
            calories: Number(data.calories || 0),
            protein: Number(data.protein || 0),
            iron: Number(data.iron || 0),
            folic_acid: Number(data.folic_acid || 0),
            calcium: Number(data.calcium || 0),
            vitamin_d: Number(data.vitamin_d || 0),
            confidence_score: Number(data.confidence_score || 0.5)
        };
    } catch (error) {
        console.error('Failed to serialize nutrition data:', error);
        return {};
    }
}

/**
 * 栄養素データを表示用データに変換
 */
export function convertToNutrientDisplayData(
    data: NutritionData,
    targets?: Record<string, number>
): NutrientDisplayData[] {
    const displayData: NutrientDisplayData[] = [];

    // カロリー
    displayData.push({
        name: 'カロリー',
        amount: data.calories,
        unit: 'kcal',
        percentOfDaily: targets?.calories ? (data.calories / targets.calories) * 100 : undefined
    });

    // タンパク質
    displayData.push({
        name: 'タンパク質',
        amount: data.protein,
        unit: 'g',
        percentOfDaily: targets?.protein ? (data.protein / targets.protein) * 100 : undefined
    });

    // 鉄分
    displayData.push({
        name: '鉄分',
        amount: data.iron,
        unit: 'mg',
        percentOfDaily: targets?.iron ? (data.iron / targets.iron) * 100 : undefined
    });

    // 葉酸
    displayData.push({
        name: '葉酸',
        amount: data.folic_acid,
        unit: 'μg',
        percentOfDaily: targets?.folic_acid ? (data.folic_acid / targets.folic_acid) * 100 : undefined
    });

    // カルシウム
    displayData.push({
        name: 'カルシウム',
        amount: data.calcium,
        unit: 'mg',
        percentOfDaily: targets?.calcium ? (data.calcium / targets.calcium) * 100 : undefined
    });

    // ビタミンD
    displayData.push({
        name: 'ビタミンD',
        amount: data.vitamin_d,
        unit: 'μg',
        percentOfDaily: targets?.vitamin_d ? (data.vitamin_d / targets.vitamin_d) * 100 : undefined
    });

    return displayData;
}

/**
 * 空のNutritionDataを作成
 */
export function createEmptyNutritionData(): NutritionData {
    return {
        calories: 0,
        protein: 0,
        iron: 0,
        folic_acid: 0,
        calcium: 0,
        vitamin_d: 0,
        confidence_score: 0,
    };
}

/**
 * 標準化された栄養データ型を生成するファクトリ関数
 * @param data 部分的なStandardizedMealNutritionデータまたはNutritionData
 * @returns 完全なStandardizedMealNutrition
 */
export function createStandardizedMealNutrition(
    data?: Partial<StandardizedMealNutrition> | NutritionData
): StandardizedMealNutrition {
    // 基本構造を初期化
    const defaultValue: StandardizedMealNutrition = {
        totalCalories: 0,
        totalNutrients: [],
        foodItems: []
    };

    // dataが提供されない場合はデフォルト値を返す
    if (!data) {
        return defaultValue;
    }

    // NutritionDataが渡された場合はStandardizedMealNutritionに変換
    if ('calories' in data && typeof data.calories === 'number') {
        return convertToStandardizedNutrition(data as NutritionData);
    }

    // 部分的なStandardizedMealNutritionが渡された場合はマージ
    const partialData = data as Partial<StandardizedMealNutrition>;

    // 型エラーを避けるための結果オブジェクト
    const result: StandardizedMealNutrition = {
        totalCalories: partialData.totalCalories ?? defaultValue.totalCalories,
        totalNutrients: partialData.totalNutrients ?? defaultValue.totalNutrients,
        foodItems: partialData.foodItems ?? defaultValue.foodItems
    };

    // pregnancySpecificプロパティが提供されていれば追加
    if (partialData.pregnancySpecific) {
        result.pregnancySpecific = partialData.pregnancySpecific;
    }

    return result;
}

/**
 * NutritionDataをStandardizedMealNutritionに変換
 */
export function convertToStandardizedNutrition(nutritionData: NutritionData): StandardizedMealNutrition {
    try {
        // 基本の栄養素配列を作成
        const nutrients: Nutrient[] = [
            { name: 'タンパク質', value: nutritionData.protein, unit: 'g' },
            { name: '鉄分', value: nutritionData.iron, unit: 'mg' },
            { name: '葉酸', value: nutritionData.folic_acid, unit: 'mcg' },
            { name: 'カルシウム', value: nutritionData.calcium, unit: 'mg' },
            { name: 'ビタミンD', value: nutritionData.vitamin_d, unit: 'mcg' },
        ];

        // 拡張栄養素があれば追加
        if (nutritionData.extended_nutrients) {
            // 主要栄養素
            if (nutritionData.extended_nutrients.fat !== undefined) {
                nutrients.push({ name: '脂質', value: nutritionData.extended_nutrients.fat, unit: 'g' });
            }
            if (nutritionData.extended_nutrients.carbohydrate !== undefined) {
                nutrients.push({ name: '炭水化物', value: nutritionData.extended_nutrients.carbohydrate, unit: 'g' });
            }
            if (nutritionData.extended_nutrients.dietary_fiber !== undefined) {
                nutrients.push({ name: '食物繊維', value: nutritionData.extended_nutrients.dietary_fiber, unit: 'g' });
            }
            if (nutritionData.extended_nutrients.sugars !== undefined) {
                nutrients.push({ name: '糖質', value: nutritionData.extended_nutrients.sugars, unit: 'g' });
            }
            if (nutritionData.extended_nutrients.salt !== undefined) {
                nutrients.push({ name: '食塩相当量', value: nutritionData.extended_nutrients.salt, unit: 'g' });
            }

            // ミネラル
            if (nutritionData.extended_nutrients.minerals) {
                for (const [key, value] of Object.entries(nutritionData.extended_nutrients.minerals)) {
                    if (value !== undefined) {
                        let name: string;
                        switch (key) {
                            case 'sodium': name = 'ナトリウム'; break;
                            case 'potassium': name = 'カリウム'; break;
                            case 'magnesium': name = 'マグネシウム'; break;
                            case 'phosphorus': name = 'リン'; break;
                            case 'zinc': name = '亜鉛'; break;
                            default: name = key;
                        }
                        nutrients.push({ name, value, unit: 'mg' });
                    }
                }
            }

            // ビタミン
            if (nutritionData.extended_nutrients.vitamins) {
                for (const [key, value] of Object.entries(nutritionData.extended_nutrients.vitamins)) {
                    if (value !== undefined) {
                        let name: string;
                        let unit: NutrientUnit = 'mg';

                        switch (key) {
                            case 'vitamin_a': name = 'ビタミンA'; unit = 'mcg'; break;
                            case 'vitamin_b1': name = 'ビタミンB1'; break;
                            case 'vitamin_b2': name = 'ビタミンB2'; break;
                            case 'vitamin_b6': name = 'ビタミンB6'; break;
                            case 'vitamin_b12': name = 'ビタミンB12'; unit = 'mcg'; break;
                            case 'vitamin_c': name = 'ビタミンC'; break;
                            case 'vitamin_e': name = 'ビタミンE'; break;
                            case 'vitamin_k': name = 'ビタミンK'; unit = 'mcg'; break;
                            case 'choline': name = 'コリン'; break;
                            default: name = key;
                        }

                        nutrients.push({ name, value, unit });
                    }
                }
            }
        }

        // 標準化されたフォーマットに変換
        const result: StandardizedMealNutrition = {
            totalCalories: nutritionData.calories,
            totalNutrients: nutrients,
            foodItems: [] // 食品アイテムのデータがNutritionDataには存在しないため空配列
        };

        // 任意で妊婦向け特別データを追加
        result.pregnancySpecific = {
            folatePercentage: 0,
            ironPercentage: 0,
            calciumPercentage: 0
        };

        return result;
    } catch (error) {
        console.error('Failed to convert to standardized nutrition:', error);
        throw new AppError({
            code: ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR, // 正しいエラーコードに修正
            message: '栄養データの変換に失敗しました',
            originalError: error as Error
        });
    }
}

/**
 * StandardizedMealNutritionをNutritionDataに変換
 */
export function convertToLegacyNutrition(standardizedData: StandardizedMealNutrition): NutritionData {
    try {
        // 基本のNutritionDataを初期化
        const nutritionData: NutritionData = {
            calories: standardizedData.totalCalories,
            protein: 0,
            iron: 0,
            folic_acid: 0,
            calcium: 0,
            vitamin_d: 0,
            confidence_score: 1, // デフォルト値
            extended_nutrients: {}
        };

        // extended_nutrientsのサブプロパティを初期化
        if (nutritionData.extended_nutrients) {
            nutritionData.extended_nutrients.minerals = {};
            nutritionData.extended_nutrients.vitamins = {};
        }

        // 各栄養素を適切なプロパティに設定
        for (const nutrient of standardizedData.totalNutrients) {
            switch (nutrient.name) {
                case 'タンパク質':
                    nutritionData.protein = nutrient.value;
                    break;
                case '鉄分':
                    nutritionData.iron = nutrient.value;
                    break;
                case '葉酸':
                    nutritionData.folic_acid = nutrient.value;
                    break;
                case 'カルシウム':
                    nutritionData.calcium = nutrient.value;
                    break;
                case 'ビタミンD':
                    nutritionData.vitamin_d = nutrient.value;
                    break;
                case '脂質':
                    if (nutritionData.extended_nutrients) {
                        nutritionData.extended_nutrients.fat = nutrient.value;
                        nutritionData.fat = nutrient.value; // 互換性のため
                    }
                    break;
                case '炭水化物':
                    if (nutritionData.extended_nutrients) {
                        nutritionData.extended_nutrients.carbohydrate = nutrient.value;
                        nutritionData.carbohydrate = nutrient.value; // 互換性のため
                    }
                    break;
                case '食物繊維':
                    if (nutritionData.extended_nutrients) {
                        nutritionData.extended_nutrients.dietary_fiber = nutrient.value;
                        nutritionData.dietaryFiber = nutrient.value; // 互換性のため
                    }
                    break;
                case '糖質':
                    if (nutritionData.extended_nutrients) {
                        nutritionData.extended_nutrients.sugars = nutrient.value;
                        nutritionData.sugars = nutrient.value; // 互換性のため
                    }
                    break;
                case '食塩相当量':
                    if (nutritionData.extended_nutrients) {
                        nutritionData.extended_nutrients.salt = nutrient.value;
                        nutritionData.salt = nutrient.value; // 互換性のため
                    }
                    break;
                case 'ナトリウム':
                    if (nutritionData.extended_nutrients?.minerals) {
                        nutritionData.extended_nutrients.minerals.sodium = nutrient.value;
                        if (!nutritionData.minerals) nutritionData.minerals = {};
                        nutritionData.minerals.sodium = nutrient.value; // 互換性のため
                    }
                    break;
                case 'カリウム':
                    if (nutritionData.extended_nutrients?.minerals) {
                        nutritionData.extended_nutrients.minerals.potassium = nutrient.value;
                        if (!nutritionData.minerals) nutritionData.minerals = {};
                        nutritionData.minerals.potassium = nutrient.value; // 互換性のため
                    }
                    break;
                case 'マグネシウム':
                    if (nutritionData.extended_nutrients?.minerals) {
                        nutritionData.extended_nutrients.minerals.magnesium = nutrient.value;
                        if (!nutritionData.minerals) nutritionData.minerals = {};
                        nutritionData.minerals.magnesium = nutrient.value; // 互換性のため
                    }
                    break;
                case 'リン':
                    if (nutritionData.extended_nutrients?.minerals) {
                        nutritionData.extended_nutrients.minerals.phosphorus = nutrient.value;
                        if (!nutritionData.minerals) nutritionData.minerals = {};
                        nutritionData.minerals.phosphorus = nutrient.value; // 互換性のため
                    }
                    break;
                case '亜鉛':
                    if (nutritionData.extended_nutrients?.minerals) {
                        nutritionData.extended_nutrients.minerals.zinc = nutrient.value;
                        if (!nutritionData.minerals) nutritionData.minerals = {};
                        nutritionData.minerals.zinc = nutrient.value; // 互換性のため
                    }
                    break;
                // ビタミン類
                case 'ビタミンA':
                    if (nutritionData.extended_nutrients?.vitamins) {
                        nutritionData.extended_nutrients.vitamins.vitamin_a = nutrient.value;
                        if (!nutritionData.vitamins) nutritionData.vitamins = {};
                        nutritionData.vitamins.vitaminA = nutrient.value; // 互換性のため
                    }
                    break;
                case 'ビタミンB1':
                    if (nutritionData.extended_nutrients?.vitamins) {
                        nutritionData.extended_nutrients.vitamins.vitamin_b1 = nutrient.value;
                        if (!nutritionData.vitamins) nutritionData.vitamins = {};
                        nutritionData.vitamins.vitaminB1 = nutrient.value; // 互換性のため
                    }
                    break;
                case 'ビタミンB2':
                    if (nutritionData.extended_nutrients?.vitamins) {
                        nutritionData.extended_nutrients.vitamins.vitamin_b2 = nutrient.value;
                        if (!nutritionData.vitamins) nutritionData.vitamins = {};
                        nutritionData.vitamins.vitaminB2 = nutrient.value; // 互換性のため
                    }
                    break;
                // 他のビタミンも同様に処理
                default:
                    // 未知の栄養素は適切なカテゴリに追加
                    if (nutrient.name.includes('ビタミン') && nutritionData.extended_nutrients?.vitamins) {
                        const key = nutrient.name.toLowerCase().replace(/\s+/g, '_');
                        nutritionData.extended_nutrients.vitamins[key] = nutrient.value;
                    } else if (nutritionData.extended_nutrients) {
                        // それ以外はその他のカテゴリとして追加
                        const key = nutrient.name.toLowerCase().replace(/\s+/g, '_');
                        nutritionData.extended_nutrients[key] = nutrient.value;
                    }
            }
        }

        // カロリーも互換性のため設定
        nutritionData.energy = standardizedData.totalCalories;

        return nutritionData;
    } catch (error) {
        console.error('Failed to convert to legacy nutrition format:', error);
        return createEmptyNutritionData();
    }
} 