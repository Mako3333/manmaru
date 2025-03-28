import {
    safeConvertNutritionData,
    createEmptyNutritionData
} from '@/lib/nutrition/nutrition-utils';
import {
    mapNutrientToNutritionData,
    mapNutritionToNutrientData
} from '@/lib/nutrition/nutrition-service-impl';
import { NutrientData, NutritionData } from '@/types/nutrition';

describe('栄養素データ変換関数', () => {
    test('不正なデータに対してもエラーを発生させず空のデータを返す', () => {
        const result = safeConvertNutritionData(null, 'nutrient');
        expect(result).toEqual(createEmptyNutritionData());
    });

    test('NutrientDataからNutritionDataへの変換が正しく行われる', () => {
        // テストデータの準備
        const nutrientData: NutrientData = {
            calories: 0,
            protein: 10,
            iron: 5,
            folic_acid: 200,
            calcium: 300,
            vitamin_d: 5,
            energy: 250,
            fat: 5,
            carbohydrate: 30,
            dietaryFiber: 3,
            sugars: 2,
            salt: 1,
            confidence_score: 0.9,
            minerals: {
                sodium: 150,
                calcium: 300,
                iron: 5,
                potassium: 200,
                magnesium: 50,
                phosphorus: 100,
                zinc: 2
            },
            vitamins: {
                vitaminA: 100,
                vitaminD: 5,
                vitaminE: 2,
                vitaminK: 50,
                vitaminB1: 0.3,
                vitaminB2: 0.4,
                vitaminB6: 0.5,
                vitaminB12: 1.0,
                vitaminC: 30,
                folicAcid: 200
            }
        };

        // 変換の実行
        const result = mapNutrientToNutritionData(nutrientData);

        // 結果の検証
        expect(result.calories).toBe(250); // energyがcaloriesに変換されていること
        expect(result.protein).toBe(10);
        expect(result.iron).toBe(5);
        expect(result.folic_acid).toBe(200);
        expect(result.calcium).toBe(300);
        expect(result.vitamin_d).toBe(5);
        expect(result.confidence_score).toBe(0.9);

        // 拡張栄養素の検証
        expect(result.extended_nutrients?.fat).toBe(5);
        expect(result.extended_nutrients?.carbohydrate).toBe(30);
        expect(result.extended_nutrients?.dietary_fiber).toBe(3);
        expect(result.extended_nutrients?.minerals?.sodium).toBe(150);
        expect(result.extended_nutrients?.vitamins?.vitamin_a).toBe(100);
    });

    test('NutritionDataからNutrientDataへの変換が正しく行われる', () => {
        // テストデータの準備
        const nutritionData: NutritionData = {
            calories: 250,
            protein: 10,
            iron: 5,
            folic_acid: 200,
            calcium: 300,
            vitamin_d: 5,
            confidence_score: 0.9,
            extended_nutrients: {
                fat: 5,
                carbohydrate: 30,
                dietary_fiber: 3,
                sugars: 2,
                salt: 1,
                minerals: {
                    sodium: 150,
                    potassium: 200,
                    magnesium: 50,
                    phosphorus: 100,
                    zinc: 2
                },
                vitamins: {
                    vitamin_a: 100,
                    vitamin_b1: 0.3,
                    vitamin_b2: 0.4,
                    vitamin_b6: 0.5,
                    vitamin_b12: 1.0,
                    vitamin_c: 30,
                    vitamin_e: 2,
                    vitamin_k: 50
                }
            }
        };

        // 変換の実行
        const result = mapNutritionToNutrientData(nutritionData);

        // 結果の検証
        expect(result.energy).toBe(250); // caloriesがenergyに変換されていること
        expect(result.protein).toBe(10);
        expect(result.fat).toBe(5);
        expect(result.carbohydrate).toBe(30);
        expect(result.dietaryFiber).toBe(3);

        // ミネラルの検証
        expect(result.minerals.sodium).toBe(150);
        expect(result.minerals.calcium).toBe(300);
        expect(result.minerals.iron).toBe(5);

        // ビタミンの検証
        expect(result.vitamins.vitaminA).toBe(100);
        expect(result.vitamins.vitaminD).toBe(5);
        expect(result.vitamins.folicAcid).toBe(200);
    });

    test('値が欠けているデータでも適切にデフォルト値で補完される', () => {
        // 一部のプロパティが欠けている栄養データ
        const incompleteData = {
            energy: 200,
            protein: 8,
            // iron, calcium, vitamin_dなどが欠けている
            confidence_score: 0.7,
            minerals: {
                // プロパティが一部欠けている
                sodium: 100
            },
            // vitaminsオブジェクト自体が欠けている
        } as NutrientData;

        // 変換の実行
        const result = mapNutrientToNutritionData(incompleteData);

        // 欠けているプロパティが0で補完されていることを検証
        expect(result.calories).toBe(200);
        expect(result.protein).toBe(8);
        expect(result.iron).toBe(0);
        expect(result.calcium).toBe(0);
        expect(result.vitamin_d).toBe(0);
        expect(result.folic_acid).toBe(0);
        expect(result.confidence_score).toBe(0.7);

        // 拡張栄養素も検証
        expect(result.extended_nutrients?.minerals?.sodium).toBe(100);
        expect(result.extended_nutrients?.minerals?.potassium).toBe(0);
    });
}); 