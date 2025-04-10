import { ApiAdapter } from '../../../src/lib/api/api-adapter';
import * as nutritionTypeUtils from '../../../src/lib/nutrition/nutrition-type-utils';
import { StandardizedMealNutrition, Nutrient, NutritionData } from '../../../src/types/nutrition';

// nutritionTypeUtilsのモック
jest.mock('../../../src/lib/nutrition/nutrition-type-utils');

describe('APIアダプターのテスト', () => {
    // テスト用サンプルデータ
    const sampleNutritionData: NutritionData = {
        calories: 500,
        protein: 20,
        fat: 15,
        carbohydrate: 60,
        iron: 2.5,
        folic_acid: 150,
        calcium: 200,
        vitamin_d: 5,
        dietaryFiber: 5,
        sugars: 10,
        salt: 2,
        confidence_score: 0.8,
        energy: 500,
        extended_nutrients: {
            minerals: {
                sodium: 500,
                potassium: 300,
                magnesium: 100,
                phosphorus: 250,
                zinc: 3
            },
            vitamins: {
                vitamin_a: 300,
                vitamin_b1: 0.5,
                vitamin_b2: 0.6,
                vitamin_b6: 0.7,
                vitamin_b12: 1.5,
                vitamin_c: 80,
                vitamin_e: 5,
                vitamin_k: 70
            }
        }
    };

    // テスト用StandardizedMealNutrition
    const sampleStandardizedNutrition: StandardizedMealNutrition = {
        totalCalories: 320,
        totalNutrients: [
            { name: 'タンパク質', value: 15, unit: 'g' },
            { name: '脂質', value: 15, unit: 'g' },
            { name: '炭水化物', value: 60, unit: 'g' },
            { name: '鉄分', value: 2.5, unit: 'mg' },
            { name: '葉酸', value: 150, unit: 'mcg' },
            { name: 'カルシウム', value: 200, unit: 'mg' },
            { name: 'ビタミンD', value: 5, unit: 'mcg' },
            { name: '食物繊維', value: 5, unit: 'g' },
            { name: '糖類', value: 10, unit: 'g' },
            { name: '食塩相当量', value: 2, unit: 'g' },
            { name: 'ナトリウム', value: 500, unit: 'mg' },
            { name: 'カリウム', value: 300, unit: 'mg' },
            { name: 'マグネシウム', value: 100, unit: 'mg' },
            { name: 'リン', value: 250, unit: 'mg' },
            { name: '亜鉛', value: 3, unit: 'mg' },
            { name: 'ビタミンA', value: 300, unit: 'mcg' },
            { name: 'ビタミンB1', value: 0.5, unit: 'mg' },
            { name: 'ビタミンB2', value: 0.6, unit: 'mg' },
            { name: 'ビタミンB6', value: 0.7, unit: 'mg' },
            { name: 'ビタミンB12', value: 1.5, unit: 'mcg' },
            { name: 'ビタミンC', value: 80, unit: 'mg' },
            { name: 'ビタミンE', value: 5, unit: 'mg' },
            { name: 'ビタミンK', value: 70, unit: 'mcg' }
        ],
        foodItems: [
            {
                id: '1',
                name: 'ごはん',
                nutrition: {
                    calories: 200,
                    nutrients: [],
                    servingSize: { value: 100, unit: 'g' }
                },
                amount: 150,
                unit: 'g'
            },
            {
                id: '2',
                name: '卵',
                nutrition: {
                    calories: 80,
                    nutrients: [
                        { name: 'タンパク質', value: 7, unit: 'g' },
                        { name: '脂質', value: 6, unit: 'g' }
                    ],
                    servingSize: {
                        value: 1,
                        unit: '個'
                    }
                },
                amount: 2,
                unit: '個'
            }
        ],
        pregnancySpecific: {
            folatePercentage: 25,
            ironPercentage: 15,
            calciumPercentage: 5
        },
        reliability: {
            confidence: 0.9,
            balanceScore: 75,
            completeness: 0.95
        }
    };

    // 各テスト前にモックをリセット
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ここに convertLegacyToStandard, convertStandardToLegacy, createErrorResponse のテストが続く想定 (もしあれば)
    // なければ describe ブロックはこれで終わり
}); 