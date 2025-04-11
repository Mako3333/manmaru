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
// import { AppError } from '../error/types/base-error'; // 未使用
// import { ErrorCode } from '../error/codes/error-codes'; // 未使用

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
            confidence: 0.8,
            completeness: 0.5,
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
    // 基本構造を初期化 (balanceScore: undefined を削除)
    const defaultValue: Omit<StandardizedMealNutrition, 'reliability'> & { reliability: Omit<StandardizedMealNutrition['reliability'], 'balanceScore'> } = {
        totalCalories: 0,
        totalNutrients: [],
        foodItems: [],
        reliability: {
            confidence: 0.8,
            completeness: 0.5,
        }
    };

    // dataが提供されない場合は、defaultValue を StandardizedMealNutrition 型にキャストして返す
    if (!data) {
        return defaultValue as StandardizedMealNutrition;
    }

    // NutritionData (旧型) が渡された場合、互換性のためにStandardizedMealNutritionに変換
    if ('calories' in data && typeof data.calories === 'number') {
        return convertToStandardizedNutrition(data as NutritionData);
    }

    // 部分的なStandardizedMealNutritionが渡された場合はマージ
    const partialData = data as Partial<StandardizedMealNutrition>;

    // 型エラーを避けるための結果オブジェクトの reliability 部分を修正
    const reliabilityResult: StandardizedMealNutrition['reliability'] = {
        confidence: partialData.reliability?.confidence ?? defaultValue.reliability.confidence,
        completeness: partialData.reliability?.completeness ?? defaultValue.reliability.completeness,
    };
    // balanceScore が undefined でない場合のみプロパティを追加
    if (partialData.reliability?.balanceScore !== undefined) {
        reliabilityResult.balanceScore = partialData.reliability.balanceScore;
    }

    const result: StandardizedMealNutrition = {
        totalCalories: partialData.totalCalories ?? defaultValue.totalCalories,
        totalNutrients: partialData.totalNutrients ?? defaultValue.totalNutrients,
        foodItems: partialData.foodItems ?? defaultValue.foodItems,
        reliability: reliabilityResult
    };

    // pregnancySpecificプロパティが提供されていれば追加
    if (partialData.pregnancySpecific) {
        result.pregnancySpecific = partialData.pregnancySpecific;
    }

    return result;
}

// 栄養素名と取得元のキー、単位のマッピング定義 (Nutrient.value を使用)
const nutrientMapping: {
    name: string;
    key: keyof NutritionData | keyof NonNullable<NutritionData['extended_nutrients']>;
    unit: NutrientUnit;
    source: 'direct' | 'extended'
}[] = [
        { name: 'エネルギー', key: 'calories', unit: 'kcal', source: 'direct' },
        { name: 'たんぱく質', key: 'protein', unit: 'g', source: 'direct' },
        { name: '鉄', key: 'iron', unit: 'mg', source: 'direct' },
        { name: '葉酸', key: 'folic_acid', unit: 'mcg', source: 'direct' }, // μg -> mcg (NutrientUnitに合わせる)
        { name: 'カルシウム', key: 'calcium', unit: 'mg', source: 'direct' },
        { name: 'ビタミンD', key: 'vitamin_d', unit: 'mcg', source: 'direct' }, // μg -> mcg
        // 以下は extended_nutrients から取得する想定
        { name: '脂質', key: 'fat', unit: 'g', source: 'extended' },
        { name: '炭水化物', key: 'carbohydrate', unit: 'g', source: 'extended' },
        { name: '食物繊維', key: 'dietary_fiber', unit: 'g', source: 'extended' },
        { name: '糖質', key: 'sugars', unit: 'g', source: 'extended' },
        { name: '食塩相当量', key: 'salt', unit: 'g', source: 'extended' },
        // 必要に応じてミネラル、ビタミンを追加
    ];

/**
 * NutritionData (旧型) を StandardizedMealNutrition に変換
 */
export function convertToStandardizedNutrition(nutritionData: NutritionData): StandardizedMealNutrition {
    const getValue = (key: keyof NutritionData | keyof NonNullable<NutritionData['extended_nutrients']>) => {
        if (key in nutritionData && typeof nutritionData[key as keyof NutritionData] === 'number') {
            return nutritionData[key as keyof NutritionData] as number;
        } else if (nutritionData.extended_nutrients && key in nutritionData.extended_nutrients) {
            const extended = nutritionData.extended_nutrients as Record<string, number | undefined>; // 型キャスト
            return extended[key] ?? 0;
        }
        return 0;
    };

    const totalNutrients: Nutrient[] = nutrientMapping
        .map(mapping => ({
            name: mapping.name,
            value: getValue(mapping.key), // value を使用
            unit: mapping.unit,
        }));

    const foodItems: StandardizedMealNutrition['foodItems'] = [];

    const reliability: StandardizedMealNutrition['reliability'] = {
        confidence: nutritionData.confidence_score ?? 0.8,
        completeness: 0.5, // 旧型には情報がないためデフォルト値
        // balanceScore: undefined, // exactOptionalPropertyTypes エラーのため一旦コメントアウト
    };

    return {
        totalCalories: getValue('calories'),
        totalNutrients,
        foodItems,
        reliability,
    };
}

/**
 * StandardizedMealNutrition を NutritionData (旧型) に変換 (互換性のため)
 */
export function convertToLegacyNutrition(standardizedData: StandardizedMealNutrition): NutritionData {
    const findNutrientValue = (name: string): number => {
        return standardizedData.totalNutrients.find(n => n.name === name)?.value ?? 0; // value を使用
    };

    const legacyData: NutritionData = {
        calories: findNutrientValue('エネルギー'),
        protein: findNutrientValue('たんぱく質'),
        iron: findNutrientValue('鉄'),
        folic_acid: findNutrientValue('葉酸'),
        calcium: findNutrientValue('カルシウム'),
        vitamin_d: findNutrientValue('ビタミンD'),
        confidence_score: standardizedData.reliability.confidence,
        extended_nutrients: {
            fat: findNutrientValue('脂質'),
            carbohydrate: findNutrientValue('炭水化物'),
            dietary_fiber: findNutrientValue('食物繊維'),
            sugars: findNutrientValue('糖質'),
            salt: findNutrientValue('食塩相当量'),
            // 必要に応じてミネラル、ビタミンを extended_nutrients に追加
        },
        // not_found_foods は StandardizedMealNutrition にはないため設定しない
    };

    return legacyData;
}

/**
 * StandardizedMealNutrition をデータベース保存形式 (Record<string, unknown>) に変換
 */
export function convertToDbNutritionFormat(
    standardizedData: StandardizedMealNutrition | undefined | null
): Record<string, unknown> | null {
    if (!standardizedData) {
        return null;
    }

    // 基本的な栄養素と信頼性をトップレベルに配置
    const dbData: Record<string, unknown> = {
        totalCalories: standardizedData.totalCalories,
        protein: standardizedData.totalNutrients.find(n => n.name === 'たんぱく質')?.value ?? 0, // value
        iron: standardizedData.totalNutrients.find(n => n.name === '鉄')?.value ?? 0, // value
        folic_acid: standardizedData.totalNutrients.find(n => n.name === '葉酸')?.value ?? 0, // value
        calcium: standardizedData.totalNutrients.find(n => n.name === 'カルシウム')?.value ?? 0, // value
        vitamin_d: standardizedData.totalNutrients.find(n => n.name === 'ビタミンD')?.value ?? 0, // value
        confidence: standardizedData.reliability.confidence,
        completeness: standardizedData.reliability.completeness,
        // balanceScore: standardizedData.reliability.balanceScore, // エラー回避のためコメントアウトされる可能性
    };

    // 信頼性情報 (balanceScore は undefined の可能性あり)
    if (standardizedData.reliability.balanceScore !== undefined) {
        dbData.balanceScore = standardizedData.reliability.balanceScore;
    }

    // 全栄養素リストをJSON文字列として保存
    try {
        dbData.totalNutrientsJson = JSON.stringify(standardizedData.totalNutrients);
    } catch (e) {
        console.error('Error stringifying totalNutrients:', e);
        dbData.totalNutrientsJson = '[]';
    }

    // 食品アイテムリストをJSON文字列として保存 (StandardizedMealNutrition['foodItems'] の型に合わせる)
    try {
        // DBに保存する食品アイテムの構造を定義 (StandardizedMealNutrition['foodItems'] の要素と同じ)
        const itemsToStore = standardizedData.foodItems.map(item => ({
            id: item.id,
            name: item.name,
            amount: item.amount,
            unit: item.unit,
            nutrition: {
                calories: item.nutrition.calories,
                nutrients: item.nutrition.nutrients,
                servingSize: item.nutrition.servingSize
            },
            confidence: item.confidence
        }));
        dbData.foodItemsJson = JSON.stringify(itemsToStore);
    } catch (e) {
        console.error('Error stringifying foodItems:', e);
        dbData.foodItemsJson = '[]';
    }

    return dbData;
}

/**
 * データベース形式 (Record<string, unknown>) から StandardizedMealNutrition に変換
 */
export function convertDbFormatToStandardizedNutrition(
    dbData: Record<string, unknown> | null | undefined
): StandardizedMealNutrition | null {
    if (!dbData || typeof dbData !== 'object') {
        return null;
    }

    let totalNutrients: Nutrient[] = [];
    if (typeof dbData.totalNutrientsJson === 'string') {
        try {
            const parsedNutrients = JSON.parse(dbData.totalNutrientsJson);
            if (Array.isArray(parsedNutrients) && parsedNutrients.every(n => typeof n === 'object' && n !== null && 'name' in n && 'value' in n && 'unit' in n)) {
                totalNutrients = parsedNutrients as Nutrient[];
            }
        } catch (e) {
            console.error('Error parsing totalNutrientsJson:', e);
        }
    }
    if (totalNutrients.length === 0) {
        totalNutrients = nutrientMapping
            .map(mapping => {
                const key = mapping.key;
                if (key in dbData && typeof dbData[key] === 'number') {
                    return { name: mapping.name, value: dbData[key] as number, unit: mapping.unit };
                }
                return null;
            })
            .filter((n): n is Nutrient => n !== null && typeof n === 'object' && 'value' in n);
    }

    let foodItems: StandardizedMealNutrition['foodItems'] = [];
    if (typeof dbData.foodItemsJson === 'string') {
        try {
            const parsedItems = JSON.parse(dbData.foodItemsJson);
            if (Array.isArray(parsedItems) && parsedItems.every(item =>
                typeof item === 'object' && item !== null &&
                'id' in item && typeof item.id === 'string' &&
                'name' in item && typeof item.name === 'string' &&
                'amount' in item && typeof item.amount === 'number' &&
                'unit' in item && typeof item.unit === 'string' &&
                'nutrition' in item && typeof item.nutrition === 'object' && item.nutrition !== null &&
                'calories' in item.nutrition && typeof item.nutrition.calories === 'number' &&
                'nutrients' in item.nutrition && Array.isArray(item.nutrition.nutrients) &&
                item.nutrition.nutrients.every((n: unknown): n is Nutrient =>
                    typeof n === 'object' && n !== null && 'name' in n && 'value' in n && 'unit' in n
                ) &&
                'servingSize' in item.nutrition && typeof item.nutrition.servingSize === 'object' && item.nutrition.servingSize !== null &&
                'value' in item.nutrition.servingSize && typeof item.nutrition.servingSize.value === 'number' &&
                'unit' in item.nutrition.servingSize && typeof item.nutrition.servingSize.unit === 'string'
            )) {
                foodItems = parsedItems as StandardizedMealNutrition['foodItems'];
            }
        } catch (e) {
            console.error('Error parsing foodItemsJson:', e);
        }
    }

    const reliability: StandardizedMealNutrition['reliability'] = {
        confidence: typeof dbData.confidence === 'number' ? dbData.confidence : 0.8,
        completeness: typeof dbData.completeness === 'number' ? dbData.completeness : 0.5,
    };
    if (typeof dbData.balanceScore === 'number') {
        reliability.balanceScore = dbData.balanceScore;
    }
    const standardizedData: StandardizedMealNutrition = {
        totalCalories: typeof dbData.totalCalories === 'number' ? dbData.totalCalories : 0,
        totalNutrients: totalNutrients,
        foodItems: foodItems,
        reliability: reliability
    };

    return standardizedData;
}