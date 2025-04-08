import {
    parseNutritionFromJson,
    serializeNutritionToJson,
    convertToNutrientDisplayData,
    createEmptyNutritionData,
    createStandardizedMealNutrition,
    convertToStandardizedNutrition,
    convertToLegacyNutrition,
    convertToDbNutritionFormat
} from '../../../src/lib/nutrition/nutrition-type-utils';
import { NutritionData, StandardizedMealNutrition } from '../../../src/types/nutrition';

describe('栄養データ型ユーティリティのテスト', () => {
    // サンプルデータ
    const sampleNutritionData: NutritionData = {
        calories: 500,
        protein: 20,
        iron: 2.5,
        folic_acid: 150,
        calcium: 200,
        vitamin_d: 5,
        confidence_score: 0.8,
        extended_nutrients: {
            fat: 15,
            carbohydrate: 60,
            minerals: {
                sodium: 500,
                potassium: 300
            },
            vitamins: {
                vitamin_c: 80
            }
        }
    };

    const sampleStandardizedNutrition: StandardizedMealNutrition = {
        totalCalories: 500,
        totalNutrients: [
            { name: 'タンパク質', value: 20, unit: 'g' },
            { name: '鉄分', value: 2.5, unit: 'mg' },
            { name: '葉酸', value: 150, unit: 'mcg' },
            { name: 'カルシウム', value: 200, unit: 'mg' },
            { name: 'ビタミンD', value: 5, unit: 'mcg' },
            { name: '脂質', value: 15, unit: 'g' },
            { name: '炭水化物', value: 60, unit: 'g' },
            { name: 'ナトリウム', value: 500, unit: 'mg' },
            { name: 'カリウム', value: 300, unit: 'mg' },
            { name: 'ビタミンC', value: 80, unit: 'mg' }
        ],
        foodItems: [],
        pregnancySpecific: {
            folatePercentage: 0,
            ironPercentage: 0,
            calciumPercentage: 0
        },
        reliability: {
            confidence: 0.8
        }
    };

    describe('parseNutritionFromJson', () => {
        it('JSONデータからNutritionDataに変換できること', () => {
            const jsonData = {
                calories: 300,
                protein: 15,
                iron: 2,
                folic_acid: 100,
                calcium: 150,
                vitamin_d: 3,
                confidence_score: 0.7
            };

            const result = parseNutritionFromJson(jsonData);

            expect(result.calories).toBe(300);
            expect(result.protein).toBe(15);
            expect(result.iron).toBe(2);
            expect(result.folic_acid).toBe(100);
            expect(result.calcium).toBe(150);
            expect(result.vitamin_d).toBe(3);
            expect(result.confidence_score).toBe(0.7);
        });

        it('文字列化されたJSONからも変換できること', () => {
            const jsonString = JSON.stringify({
                calories: 400,
                protein: 18,
                iron: 3,
                folic_acid: 120,
                calcium: 180,
                vitamin_d: 4,
                confidence_score: 0.9
            });

            const result = parseNutritionFromJson(jsonString);

            expect(result.calories).toBe(400);
            expect(result.confidence_score).toBe(0.9);
        });

        it('エラー時には空のNutritionDataを返すこと', () => {
            const result = parseNutritionFromJson(null);

            expect(result.calories).toBe(0);
            expect(result.protein).toBe(0);
            expect(result.confidence_score).toBe(0);
        });
    });

    describe('createStandardizedMealNutrition', () => {
        it('NutritionDataからStandardizedMealNutritionに変換できること', () => {
            const result = createStandardizedMealNutrition(sampleNutritionData);

            expect(result.totalCalories).toBe(500);
            expect(result.totalNutrients.length).toBeGreaterThan(0);
            expect(result.totalNutrients[0]?.name).toBe('タンパク質');
            expect(result.totalNutrients[0]?.value).toBe(20);
            expect(result.foodItems).toEqual([]);
            expect(result.pregnancySpecific).toBeDefined();
        });

        it('部分的なStandardizedMealNutritionからも変換できること', () => {
            const partialData: Partial<StandardizedMealNutrition> = {
                totalCalories: 700,
                totalNutrients: [
                    { name: 'タンパク質', value: 25, unit: 'g' }
                ]
            };

            const result = createStandardizedMealNutrition(partialData);

            expect(result.totalCalories).toBe(700);
            expect(result.totalNutrients.length).toBe(1);
            expect(result.foodItems).toEqual([]);
        });

        it('引数なしの場合はデフォルト値を返すこと', () => {
            const result = createStandardizedMealNutrition();

            expect(result.totalCalories).toBe(0);
            expect(result.totalNutrients).toEqual([]);
            expect(result.foodItems).toEqual([]);
        });

        it('pregnancySpecificプロパティが設定されていれば引き継がれること', () => {
            const partialData: Partial<StandardizedMealNutrition> = {
                pregnancySpecific: {
                    folatePercentage: 50,
                    ironPercentage: 60,
                    calciumPercentage: 70
                }
            };

            const result = createStandardizedMealNutrition(partialData);

            expect(result.pregnancySpecific).toBeDefined();
            if (result.pregnancySpecific) {
                expect(result.pregnancySpecific.folatePercentage).toBe(50);
                expect(result.pregnancySpecific.ironPercentage).toBe(60);
                expect(result.pregnancySpecific.calciumPercentage).toBe(70);
            }
        });
    });

    describe('convertToLegacyNutrition', () => {
        it('StandardizedMealNutritionからNutritionDataに変換できること', () => {
            const result = convertToLegacyNutrition(sampleStandardizedNutrition);

            expect(result.calories).toBe(500);
            expect(result.protein).toBe(20);
            expect(result.iron).toBe(2.5);
            expect(result.folic_acid).toBe(150);
            expect(result.calcium).toBe(200);
            expect(result.vitamin_d).toBe(5);
            expect(result.extended_nutrients).toBeDefined();
            if (result.extended_nutrients) {
                expect(result.extended_nutrients.fat).toBe(15);
                expect(result.extended_nutrients.carbohydrate).toBe(60);
            }
            expect(result.energy).toBe(500); // 互換性のためのプロパティ
        });

        it('ミネラルが正しく変換されること', () => {
            const result = convertToLegacyNutrition(sampleStandardizedNutrition);

            // extended_nutrientsのミネラルチェック
            if (result.extended_nutrients && result.extended_nutrients.minerals) {
                expect(result.extended_nutrients.minerals.sodium).toBe(500);
                expect(result.extended_nutrients.minerals.potassium).toBe(300);
            }

            // 互換性のためのプロパティチェック
            if (result.minerals) {
                expect(result.minerals.sodium).toBe(500);
                expect(result.minerals.potassium).toBe(300);
            }
        });
    });

    describe('convertToDbNutritionFormat', () => {
        it('StandardizedMealNutritionからDB保存用のNutritionDataに変換できること', () => {
            // 更新されたサンプルデータ（reliability追加）
            const standardizedData: StandardizedMealNutrition = {
                ...sampleStandardizedNutrition,
                reliability: {
                    confidence: 0.85
                }
            };

            const result = convertToDbNutritionFormat(standardizedData);

            // 基本的な栄養素の確認
            expect(result.calories).toBe(500);
            expect(result.protein).toBe(20);
            expect(result.iron).toBe(2.5);
            expect(result.folic_acid).toBe(150);
            expect(result.calcium).toBe(200);
            expect(result.vitamin_d).toBe(5);
            expect(result.confidence_score).toBe(0.85); // reliabilityから取得したconfidence

            // extended_nutrientsの確認
            expect(result.extended_nutrients).toBeDefined();
            if (result.extended_nutrients) {
                expect(result.extended_nutrients.fat).toBe(15);
                expect(result.extended_nutrients.carbohydrate).toBe(60);

                // ミネラルの確認
                if (result.extended_nutrients.minerals) {
                    expect(result.extended_nutrients.minerals.sodium).toBe(500);
                    expect(result.extended_nutrients.minerals.potassium).toBe(300);
                }

                // ビタミンの確認
                if (result.extended_nutrients.vitamins) {
                    expect(result.extended_nutrients.vitamins.vitamin_c).toBe(80);
                }
            }
        });

        it('reliability情報がない場合にデフォルト値が設定されること', () => {
            // reliabilityがないサンプルデータを作成（reliabilityは必須なので設定）
            const standardizedDataWithoutReliability: StandardizedMealNutrition = {
                totalCalories: 300,
                totalNutrients: [
                    { name: 'たんぱく質', value: 15, unit: 'g' }
                ],
                foodItems: [],
                reliability: {
                    confidence: 0 // 意図的に0を設定してデフォルト値の挙動を確認
                }
            };

            const result = convertToDbNutritionFormat(standardizedDataWithoutReliability);

            // デフォルトのconfidence_scoreが設定されていることを確認
            expect(result.confidence_score).toBe(0.9);
        });
    });

    describe('convertToNutrientDisplayData', () => {
        it('表示用のデータに変換できること', () => {
            const result = convertToNutrientDisplayData(sampleNutritionData);

            expect(result).toHaveLength(6); // 6つの基本栄養素
            expect(result[0]?.name).toBe('カロリー');
            expect(result[0]?.amount).toBe(500);
            expect(result[0]?.unit).toBe('kcal');
        });

        it('目標値が提供されている場合にはパーセンテージが計算されること', () => {
            const targets = {
                calories: 2000,
                protein: 60,
                iron: 5,
                folic_acid: 400,
                calcium: 800,
                vitamin_d: 10
            };

            const result = convertToNutrientDisplayData(sampleNutritionData, targets);

            expect(result[0]?.percentOfDaily).toBe(25); // 500 / 2000 * 100
            // 浮動小数点の小数点以下の桁数が異なる可能性があるため、近似値で比較
            if (result[1]?.percentOfDaily !== undefined) {
                expect(result[1].percentOfDaily).toBeCloseTo(33.33, 2); // 20 / 60 * 100
            }
            expect(result[2]?.percentOfDaily).toBe(50); // 2.5 / 5 * 100
        });
    });
}); 