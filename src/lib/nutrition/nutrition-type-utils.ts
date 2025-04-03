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

// 栄養素名と NutritionData のキー、単位のマッピング
const nutrientMapping: {
    name: string;
    key: keyof NutritionData | keyof NonNullable<NutritionData['extended_nutrients']>;
    unit: NutrientUnit;
    source: 'direct' | 'extended'
}[] = [
        // 基本の6栄養素 (+ エネルギー)
        { name: 'エネルギー', key: 'calories', unit: 'kcal', source: 'direct' },
        { name: 'たんぱく質', key: 'protein', unit: 'g', source: 'direct' },
        { name: '鉄', key: 'iron', unit: 'mg', source: 'direct' },
        { name: '葉酸', key: 'folic_acid', unit: 'mcg', source: 'direct' },
        { name: 'カルシウム', key: 'calcium', unit: 'mg', source: 'direct' },
        { name: 'ビタミンD', key: 'vitamin_d', unit: 'mcg', source: 'direct' },
        // 以下は extended_nutrients から取得する想定
        { name: '脂質', key: 'fat', unit: 'g', source: 'extended' }, // extended_nutrients.fat を想定
        { name: '炭水化物', key: 'carbohydrate', unit: 'g', source: 'extended' }, // extended_nutrients.carbohydrate を想定
        { name: '食物繊維', key: 'dietary_fiber', unit: 'g', source: 'extended' }, // extended_nutrients.dietary_fiber を想定
        { name: '食塩相当量', key: 'salt', unit: 'g', source: 'extended' }, // extended_nutrients.salt を想定
        // 他に必要な拡張栄養素があればここに追加
        // { name: 'ビタミンC', key: 'vitamin_c', unit: 'mg', source: 'extended' }, 
    ];

/**
 * NutritionDataをStandardizedMealNutritionに変換
 */
export function convertToStandardizedNutrition(nutritionData: NutritionData): StandardizedMealNutrition {
    try {
        const nutrients: Nutrient[] = [];

        // 各栄養素の値を取得し、数値でなければ 0 とするヘルパー関数
        const getValue = (key: keyof NutritionData | keyof NonNullable<NutritionData['extended_nutrients']>): number => {
            let val: any;
            // まずトップレベルプロパティを確認 (基本6種)
            if (key in nutritionData) {
                val = nutritionData[key as keyof NutritionData];
                // 次に extended_nutrients を確認
            } else if (nutritionData.extended_nutrients && key in nutritionData.extended_nutrients) {
                val = nutritionData.extended_nutrients[key as keyof typeof nutritionData.extended_nutrients];
            }
            const num = Number(val);
            return typeof num === 'number' && !isNaN(num) ? num : 0;
        };

        // マッピングを使ってNutrient配列を生成
        for (const mapping of nutrientMapping) {
            // getValue を呼び出して値を取得
            const value = getValue(mapping.key);
            // 値が0より大きい場合のみ追加 (または必要に応じて0も追加)
            // if (value > 0) { 
            nutrients.push({ name: mapping.name, value: value, unit: mapping.unit });
            // } 
        }

        const totalCalories = getValue('calories');

        return {
            totalCalories: totalCalories,
            totalNutrients: nutrients,
            foodItems: [],
            pregnancySpecific: {
                folatePercentage: 0,
                ironPercentage: 0,
                calciumPercentage: 0
            }
        };
    } catch (error) {
        console.error('Error converting NutritionData to StandardizedMealNutrition:', error);
        throw new AppError({
            code: ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR,
            message: '栄養データの変換に失敗しました',
            details: { sourceData: nutritionData, originalError: error instanceof Error ? error.message : String(error) },
            originalError: error instanceof Error ? error : undefined
        });
    }
}

/**
 * StandardizedMealNutritionをNutritionDataに変換（後方互換性のため）
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
                case 'たんぱく質':
                    nutritionData.protein = nutrient.value;
                    break;
                case '鉄':
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