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
export function parseNutritionFromJson(jsonData: string | Record<string, unknown>): NutritionData {
    try {
        let parsedData: Record<string, unknown>;
        if (typeof jsonData === 'string') {
            parsedData = JSON.parse(jsonData);
        } else {
            parsedData = jsonData;
        }

        const result: NutritionData = {
            calories: Number(parsedData.calories || 0),
            protein: Number(parsedData.protein || 0),
            iron: Number(parsedData.iron || 0),
            folic_acid: Number(parsedData.folic_acid || 0),
            calcium: Number(parsedData.calcium || 0),
            vitamin_d: Number(parsedData.vitamin_d || 0),
            confidence_score: Number(parsedData.confidence_score || 0.5)
        };

        // オプショナルプロパティの代入を修正 (undefined/null でなく、object であることを確認)
        if (parsedData.extended_nutrients !== undefined && parsedData.extended_nutrients !== null) {
            if (typeof parsedData.extended_nutrients === 'object') {
                // 型アサーションを使用。より厳密な検証が望ましい場合がある。
                result.extended_nutrients = parsedData.extended_nutrients as NutritionData['extended_nutrients'];
            } else {
                console.warn('parsedData.extended_nutrients is not an object:', parsedData.extended_nutrients);
                // result.extended_nutrients は undefined のまま
            }
        }
        // parsedData.extended_nutrients が undefined または null の場合は代入しない

        // not_found_foods の代入（Array であることを確認）
        if (parsedData.not_found_foods !== undefined && Array.isArray(parsedData.not_found_foods)) {
            // さらに配列内の要素が string であることを確認
            if (parsedData.not_found_foods.every(item => typeof item === 'string')) {
                result.not_found_foods = parsedData.not_found_foods as string[];
            }
        }

        return result;
    } catch (error) {
        console.error('Failed to parse nutrition data:', error);
        return createEmptyNutritionData();
    }
}

/**
 * NutritionDataをJSONに変換
 */
export function serializeNutritionToJson(data: NutritionData): Record<string, unknown> {
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
 * 注意: pregnancySpecific の計算は現在ダミーデータです。将来的な実装が必要です。
 */
export function convertToStandardizedNutrition(nutritionData: NutritionData): StandardizedMealNutrition {
    try {
        const nutrients: Nutrient[] = [];

        // 各栄養素の値を取得し、数値でなければ 0 とするヘルパー関数
        const getValue = (key: keyof NutritionData | keyof NonNullable<NutritionData['extended_nutrients']>): number => {
            let val: unknown;
            // まずトップレベルプロパティを確認 (基本6種)
            if (key in nutritionData) {
                val = nutritionData[key as keyof NutritionData];
            } else if (nutritionData.extended_nutrients && key in nutritionData.extended_nutrients) {
                val = nutritionData.extended_nutrients[key as keyof typeof nutritionData.extended_nutrients];
            }

            // val が数値であることを確認し、そうでなければ 0 を返す
            if (typeof val === 'number') {
                return val;
            } else {
                console.warn(`Value for key "${String(key)}" is not a number or not found, defaulting to 0. Value:`, val);
                return 0;
            }
        };

        // nutrientMapping を使用して Nutrient 配列を生成
        nutrientMapping.forEach(mapping => {
            const value = getValue(mapping.key);
            // 値が 0 でない場合のみ追加（任意で変更可能）
            if (value !== 0) {
                nutrients.push({
                    name: mapping.name,
                    value: value,
                    unit: mapping.unit
                });
            }
        });

        // foodItems は NutritionData からは直接変換できないため空配列とする
        // (必要に応じて別の変換ロジックや入力が必要)
        const foodItems: StandardizedMealNutrition['foodItems'] = [];

        // reliability.confidence は NutritionData の confidence_score を使用
        const reliability: StandardizedMealNutrition['reliability'] = {
            confidence: nutritionData.confidence_score ?? 0.8 // ない場合はデフォルト値
            // balanceScore と completeness は NutritionData からは不明
        };

        // pregnancySpecific の計算ロジック (ダミー実装)
        const pregnancySpecific: StandardizedMealNutrition['pregnancySpecific'] = {
            folatePercentage: (getValue('folic_acid') / 600) * 100, // 例: 目標600μg
            ironPercentage: (getValue('iron') / 25) * 100,       // 例: 目標25mg
            calciumPercentage: (getValue('calcium') / 900) * 100    // 例: 目標900mg
        };

        return {
            totalCalories: getValue('calories'),
            totalNutrients: nutrients,
            foodItems: foodItems,
            pregnancySpecific: pregnancySpecific,
            reliability: reliability
        };
    } catch (error) {
        console.error('Error converting NutritionData to StandardizedMealNutrition:', error);
        // エラー発生時は空のデータを返す
        return createEmptyStandardizedNutrition();
    }
}

/**
 * StandardizedMealNutritionを旧式のNutritionDataに変換
 * @deprecated この関数は後方互換性のために残されています。新しいコードでは使用しないでください。
 *             最終的には削除される予定です。DB保存には convertToDbNutritionFormat を使用してください。
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
export function convertToDbNutritionFormat(standardizedData: StandardizedMealNutrition | undefined | null): NutritionData {
    // 入力データのバリデーション
    if (!standardizedData) {
        console.warn('convertToDbNutritionFormat: 栄養データがnullまたはundefinedです');
        return createEmptyNutritionData();
    }

    if (!standardizedData.totalNutrients || !Array.isArray(standardizedData.totalNutrients)) {
        console.warn('convertToDbNutritionFormat: totalNutrientsが不正な形式です', standardizedData);
        return createEmptyNutritionData();
    }

    // 特定の栄養素を探す (日本語名と英語名、大文字小文字区別なしで検索)
    const findNutrientValue = (nameJP: string, nameEN: string): number => {
        try {
            const nutrient = standardizedData.totalNutrients.find(n => {
                if (!n || !n.name) return false;
                const lowerCaseName = n.name.toLowerCase();
                return lowerCaseName === nameJP.toLowerCase() || lowerCaseName === nameEN.toLowerCase();
            });
            return nutrient?.value ?? 0;
        } catch (error) {
            console.error(`栄養素「${nameJP}/${nameEN}」の検索中にエラー:`, error);
            return 0;
        }
    };

    // 信頼度スコアの設定 (0の場合はデフォルト値を設定)
    const confidenceScore =
        (standardizedData.reliability?.confidence !== undefined &&
            standardizedData.reliability.confidence > 0) ?
            standardizedData.reliability.confidence : 0.9;

    // 基本栄養素を設定
    const result: NutritionData = {
        calories: standardizedData.totalCalories || 0,
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