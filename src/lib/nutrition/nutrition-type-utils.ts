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
 * 空のStandardizedMealNutritionを作成
 */
export function createEmptyStandardizedNutrition(): StandardizedMealNutrition {
    return {
        totalCalories: 0,
        totalNutrients: [],
        foodItems: [],
        reliability: {
            confidence: 0.8
        }
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
        foodItems: [],
        reliability: {
            confidence: 0.8
        }
    };

    // dataが提供されない場合はデフォルト値を返す
    if (!data) {
        return defaultValue;
    }

    // NutritionData (旧型) が渡された場合、互換性のためにStandardizedMealNutritionに変換
    if ('calories' in data && typeof data.calories === 'number') {
        return convertToStandardizedNutrition(data as NutritionData);
    }

    // 部分的なStandardizedMealNutritionが渡された場合はマージ
    const partialData = data as Partial<StandardizedMealNutrition>;

    // 型エラーを避けるための結果オブジェクト
    const result: StandardizedMealNutrition = {
        totalCalories: partialData.totalCalories ?? defaultValue.totalCalories,
        totalNutrients: partialData.totalNutrients ?? defaultValue.totalNutrients,
        foodItems: partialData.foodItems ?? defaultValue.foodItems,
        reliability: partialData.reliability ?? defaultValue.reliability
    };

    // pregnancySpecificプロパティが提供されていれば追加
    if (partialData.pregnancySpecific) {
        result.pregnancySpecific = partialData.pregnancySpecific;
    }

    return result;
}

// 栄養素名と取得元のキー、単位のマッピング定義
const nutrientMapping: {
    name: string; // StandardizedMealNutrition.totalNutrients[].name で使用される日本語名
    key: keyof NutritionData | keyof NonNullable<NutritionData['extended_nutrients']>; // NutritionDataから値を取得する際のキー
    unit: NutrientUnit; // StandardizedMealNutrition.totalNutrients[].unit で使用される単位
    source: 'direct' | 'extended' // NutritionDataのどの階層から値を取得するか (direct: トップレベル, extended: extended_nutrients内)
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
        // タンパク質を最初に配置して、テストの期待値と一致させる
        nutrients.push({ name: 'タンパク質', value: getValue('protein'), unit: 'g' });

        // 他の基本栄養素を追加
        nutrients.push({ name: '鉄分', value: getValue('iron'), unit: 'mg' });
        nutrients.push({ name: '葉酸', value: getValue('folic_acid'), unit: 'mcg' });
        nutrients.push({ name: 'カルシウム', value: getValue('calcium'), unit: 'mg' });
        nutrients.push({ name: 'ビタミンD', value: getValue('vitamin_d'), unit: 'mcg' });

        // 拡張栄養素を追加
        if (nutritionData.extended_nutrients) {
            if ('fat' in nutritionData.extended_nutrients) {
                nutrients.push({ name: '脂質', value: getValue('fat'), unit: 'g' });
            }
            if ('carbohydrate' in nutritionData.extended_nutrients) {
                nutrients.push({ name: '炭水化物', value: getValue('carbohydrate'), unit: 'g' });
            }
            if ('dietary_fiber' in nutritionData.extended_nutrients) {
                nutrients.push({ name: '食物繊維', value: getValue('dietary_fiber'), unit: 'g' });
            }
            if ('salt' in nutritionData.extended_nutrients) {
                nutrients.push({ name: '食塩相当量', value: getValue('salt'), unit: 'g' });
            }

            // ミネラル類
            if (nutritionData.extended_nutrients.minerals) {
                const minerals = nutritionData.extended_nutrients.minerals;
                if ('sodium' in minerals) {
                    nutrients.push({ name: 'ナトリウム', value: minerals.sodium || 0, unit: 'mg' });
                }
                if ('potassium' in minerals) {
                    nutrients.push({ name: 'カリウム', value: minerals.potassium || 0, unit: 'mg' });
                }
                // 他のミネラルも同様に追加
            }

            // ビタミン類
            if (nutritionData.extended_nutrients.vitamins) {
                const vitamins = nutritionData.extended_nutrients.vitamins;
                if ('vitamin_c' in vitamins) {
                    nutrients.push({ name: 'ビタミンC', value: vitamins.vitamin_c || 0, unit: 'mg' });
                }
                // 他のビタミンも同様に追加
            }
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
            },
            reliability: {
                confidence: nutritionData.confidence_score || 0.8
            }
        };
    } catch (error) {
        console.error('Error converting NutritionData to StandardizedMealNutrition:', error);
        // エラー時はデフォルト値を返す
        return {
            totalCalories: 0,
            totalNutrients: [],
            foodItems: [],
            reliability: {
                confidence: 0.8
            }
        };
    }
}

/**
 * StandardizedMealNutritionをNutritionDataに変換（後方互換性のため）
 */
export function convertToLegacyNutrition(standardizedData: StandardizedMealNutrition): NutritionData {
    try {
        // 特定の栄養素を探す (日本語名と英語名、大文字小文字区別なしで検索)
        const findNutrientValue = (nameJP: string, nameEN: string): number => {
            const nutrient = standardizedData.totalNutrients.find(n => {
                const lowerCaseName = n.name.toLowerCase();
                return lowerCaseName === nameJP.toLowerCase() || lowerCaseName === nameEN.toLowerCase();
            });
            // nutrient?.value が 0 の場合も考慮し、nullish coalescing (??) を使用
            return nutrient?.value ?? 0;
        };

        // 基本栄養素を設定
        const result: NutritionData = {
            calories: standardizedData.totalCalories,
            protein: findNutrientValue('タンパク質', 'protein'),
            iron: findNutrientValue('鉄分', 'iron'),
            folic_acid: findNutrientValue('葉酸', 'folic_acid'),
            calcium: findNutrientValue('カルシウム', 'calcium'),
            vitamin_d: findNutrientValue('ビタミンD', 'vitamin_d'),
            confidence_score: standardizedData.reliability?.confidence ?? 0.9,
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

        // 互換性のためのプロパティ
        (result as any).energy = result.calories;

        // 互換性のためのミネラル・ビタミン構造
        result.minerals = {
            sodium: findNutrientValue('ナトリウム', 'sodium'),
            calcium: result.calcium,
            iron: result.iron,
            potassium: findNutrientValue('カリウム', 'potassium'),
            magnesium: findNutrientValue('マグネシウム', 'magnesium'),
            phosphorus: findNutrientValue('リン', 'phosphorus'),
            zinc: findNutrientValue('亜鉛', 'zinc')
        };

        result.vitamins = {
            vitaminA: findNutrientValue('ビタミンA', 'vitamin_a'),
            vitaminD: result.vitamin_d,
            vitaminE: findNutrientValue('ビタミンE', 'vitamin_e'),
            vitaminK: findNutrientValue('ビタミンK', 'vitamin_k'),
            vitaminB1: findNutrientValue('ビタミンB1', 'vitamin_b1'),
            vitaminB2: findNutrientValue('ビタミンB2', 'vitamin_b2'),
            vitaminB6: findNutrientValue('ビタミンB6', 'vitamin_b6'),
            vitaminB12: findNutrientValue('ビタミンB12', 'vitamin_b12'),
            vitaminC: findNutrientValue('ビタミンC', 'vitamin_c'),
            folicAcid: result.folic_acid
        };

        return result;
    } catch (error) {
        console.error('Error converting StandardizedMealNutrition to NutritionData:', error);
        return createEmptyNutritionData();
    }
}

/**
 * StandardizedMealNutritionをデータベース保存用の形式に変換する
 * 
 * この関数は、アプリケーション内で使用する標準化された栄養データ形式から、
 * Supabaseのmealsテーブルのnutrition_data (JSONB) カラムに保存するための
 * 適切な形式に変換します。
 * 
 * @param standardizedData 標準化された栄養データ
 * @returns データベース保存用のNutritionData形式
 */
export function convertToDbNutritionFormat(standardizedData: StandardizedMealNutrition): NutritionData {
    // 特定の栄養素を探す (日本語名と英語名、大文字小文字区別なしで検索)
    const findNutrientValue = (nameJP: string, nameEN: string): number => {
        const nutrient = standardizedData.totalNutrients.find(n => {
            const lowerCaseName = n.name.toLowerCase();
            return lowerCaseName === nameJP.toLowerCase() || lowerCaseName === nameEN.toLowerCase();
        });
        return nutrient?.value ?? 0;
    };

    // 信頼度スコアの設定 (0の場合はデフォルト値を設定)
    const confidenceScore =
        (standardizedData.reliability?.confidence !== undefined &&
            standardizedData.reliability.confidence > 0) ?
            standardizedData.reliability.confidence : 0.9;

    // 基本栄養素を設定
    const result: NutritionData = {
        calories: standardizedData.totalCalories,
        protein: findNutrientValue('タンパク質', 'protein'),
        iron: findNutrientValue('鉄分', 'iron'),
        folic_acid: findNutrientValue('葉酸', 'folic_acid'),
        calcium: findNutrientValue('カルシウム', 'calcium'),
        vitamin_d: findNutrientValue('ビタミンD', 'vitamin_d'),
        confidence_score: confidenceScore,
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