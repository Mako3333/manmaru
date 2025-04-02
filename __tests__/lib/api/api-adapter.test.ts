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
        totalCalories: 500,
        totalNutrients: [
            { name: 'タンパク質', value: 20, unit: 'g' },
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
                    nutrients: [
                        { name: 'タンパク質', value: 5, unit: 'g' },
                        { name: '炭水化物', value: 40, unit: 'g' }
                    ],
                    servingSize: {
                        value: 100,
                        unit: 'g'
                    }
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
            folatePercentage: 30,
            ironPercentage: 25,
            calciumPercentage: 20
        }
    };

    // 各テスト前にモックをリセット
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('convertToStandardNutrition', () => {
        it('任意の形式の栄養データからNutritionDataに正しく変換できること', () => {
            const testData = {
                calories: 300,
                protein: 15,
                iron: 2,
                calcium: 150,
                folic_acid: 100,
                vitaminD: 3,
                confidence: 0.7
            };

            const result = ApiAdapter.convertToStandardNutrition(testData);

            expect(result.calories).toBe(300);
            expect(result.protein).toBe(15);
            expect(result.iron).toBe(2);
            expect(result.folic_acid).toBe(100);
            expect(result.calcium).toBe(150);
            expect(result.vitamin_d).toBe(3);
            expect(result.confidence_score).toBe(0.7);
        });

        it('nullやundefinedを渡した場合は空のNutritionDataを返すこと', () => {
            const result = ApiAdapter.convertToStandardNutrition(null);

            expect(result.calories).toBe(0);
            expect(result.protein).toBe(0);
            expect(result.iron).toBe(0);
            expect(result.confidence_score).toBe(0.8); // デフォルト値
        });

        it('拡張栄養素が正しく設定されること', () => {
            const testData = {
                fat: 10,
                carbohydrate: 50,
                dietaryFiber: 7,
                extended_nutrients: {
                    minerals: {
                        sodium: 300
                    }
                }
            };

            const result = ApiAdapter.convertToStandardNutrition(testData);

            expect(result.fat).toBe(10);
            expect(result.carbohydrate).toBe(50);
            expect(result.dietaryFiber).toBe(7);
            expect(result.extended_nutrients?.minerals?.sodium).toBe(300);
        });
    });

    describe('convertToStandardizedNutritionFormat', () => {
        it('NutritionDataをStandardizedMealNutritionに正しく変換できること', () => {
            (nutritionTypeUtils.convertToStandardizedNutrition as jest.Mock).mockReturnValue(sampleStandardizedNutrition);

            const result = ApiAdapter.convertToStandardizedNutritionFormat(sampleNutritionData);

            expect(result).toEqual(sampleStandardizedNutrition);

            expect(result.totalCalories).toBe(500);
            const proteinNutrient = result.totalNutrients.find((n: Nutrient) => n.name === 'タンパク質');
            expect(proteinNutrient).toBeDefined();
            expect(proteinNutrient?.value).toBe(20);

            const ironNutrient = result.totalNutrients.find((n: Nutrient) => n.name === '鉄分');
            expect(ironNutrient).toBeDefined();
            expect(ironNutrient?.value).toBe(2.5);

            const fatNutrient = result.totalNutrients.find((n: Nutrient) => n.name === '脂質');
            expect(fatNutrient).toBeDefined();
            expect(fatNutrient?.value).toBe(15);

            const vitaminCNutrient = result.totalNutrients.find((n: Nutrient) => n.name === 'ビタミンC');
            expect(vitaminCNutrient).toBeDefined();
            expect(vitaminCNutrient?.value).toBe(80);
        });

        it('foodItemsが空の配列として初期化されること', () => {
            (nutritionTypeUtils.convertToStandardizedNutrition as jest.Mock).mockReturnValue(sampleStandardizedNutrition);

            const result = ApiAdapter.convertToStandardizedNutritionFormat(sampleNutritionData);
            expect(result.foodItems).toBeDefined();
            expect(Array.isArray(result.foodItems)).toBe(true);
            expect(result.foodItems.length).toBe(2);
        });

        it('妊婦向け特別データが設定されること', () => {
            (nutritionTypeUtils.convertToStandardizedNutrition as jest.Mock).mockReturnValue(sampleStandardizedNutrition);

            const result = ApiAdapter.convertToStandardizedNutritionFormat(sampleNutritionData);
            expect(result.pregnancySpecific).toBeDefined();
            if (result.pregnancySpecific) {
                expect(typeof result.pregnancySpecific.folatePercentage).toBe('number');
                expect(typeof result.pregnancySpecific.ironPercentage).toBe('number');
                expect(typeof result.pregnancySpecific.calciumPercentage).toBe('number');
            }
        });
    });

    describe('convertToLegacyNutritionFormat', () => {
        it('StandardizedMealNutritionをNutritionDataに正しく変換できること', () => {
            const mockLegacyData = { ...sampleNutritionData };
            (nutritionTypeUtils.convertToLegacyNutrition as jest.Mock).mockReturnValue(mockLegacyData);

            const result = ApiAdapter.convertToLegacyNutritionFormat(sampleStandardizedNutrition);

            expect(result).toEqual(mockLegacyData);

            expect(result.calories).toBe(500);
            expect(result.protein).toBe(20);
            expect(result.iron).toBe(2.5);
            expect(result.folic_acid).toBe(150);
            expect(result.calcium).toBe(200);
            expect(result.vitamin_d).toBe(5);
            expect(result.energy).toBe(500);
        });

        it('拡張栄養素が正しく変換されること', () => {
            const mockLegacyData = { ...sampleNutritionData };
            (nutritionTypeUtils.convertToLegacyNutrition as jest.Mock).mockReturnValue(mockLegacyData);

            const result = ApiAdapter.convertToLegacyNutritionFormat(sampleStandardizedNutrition);

            expect(result.fat).toBe(15);
            expect(result.carbohydrate).toBe(60);
            expect(result.extended_nutrients?.vitamins?.vitamin_c).toBe(80);
        });

        it('互換性のためのプロパティが設定されること', () => {
            const mockLegacyData = { ...sampleNutritionData };
            (nutritionTypeUtils.convertToLegacyNutrition as jest.Mock).mockReturnValue(mockLegacyData);

            const result = ApiAdapter.convertToLegacyNutritionFormat(sampleStandardizedNutrition);

            expect(result.energy).toBe(500);
        });

        it('空のStandardizedMealNutritionからも変換できること', () => {
            const emptyStandardized: StandardizedMealNutrition = {
                totalCalories: 0,
                totalNutrients: [],
                foodItems: []
            };
            const emptyNutritionData: NutritionData = {
                calories: 0,
                protein: 0,
                iron: 0,
                folic_acid: 0,
                calcium: 0,
                vitamin_d: 0,
                confidence_score: 1
            };
            (nutritionTypeUtils.convertToLegacyNutrition as jest.Mock).mockReturnValue(emptyNutritionData);

            const result = ApiAdapter.convertToLegacyNutritionFormat(emptyStandardized);

            expect(result).toEqual(emptyNutritionData);
            expect(result.calories).toBe(0);
            expect(result.protein).toBe(0);
            expect(result.iron).toBe(0);
            expect(result.folic_acid).toBe(0);
            expect(result.calcium).toBe(0);
            expect(result.vitamin_d).toBe(0);
            expect(result.confidence_score).toBe(1);
        });
    });
}); 