import {
    safeConvertNutritionData,
    createEmptyNutritionData
} from '@/lib/nutrition/nutrition-utils';
import {
    createStandardNutritionData
} from '@/lib/nutrition/nutrition-service-impl';
import { NutritionData } from '@/types/nutrition';

describe('栄養素データ変換関数', () => {
    test('不正なデータに対してもエラーを発生させず空のデータを返す', () => {
        const result = safeConvertNutritionData(null, 'nutrient');
        expect(result).toEqual(createEmptyNutritionData());
    });

    test('データの正しい変換が行われる', () => {
        // テストデータの準備
        const sourceData = {
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
        const result = createStandardNutritionData(sourceData);

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
        expect(result.extended_nutrients?.sugars).toBe(2);
        expect(result.extended_nutrients?.salt).toBe(1);

        // ミネラルの検証
        expect(result.extended_nutrients?.minerals?.sodium).toBe(150);
        expect(result.extended_nutrients?.minerals?.potassium).toBe(200);
        expect(result.extended_nutrients?.minerals?.magnesium).toBe(50);
        expect(result.extended_nutrients?.minerals?.phosphorus).toBe(100);
        expect(result.extended_nutrients?.minerals?.zinc).toBe(2);

        // ビタミンの検証
        expect(result.extended_nutrients?.vitamins?.vitamin_a).toBe(100);
        expect(result.extended_nutrients?.vitamins?.vitamin_b1).toBe(0.3);
        expect(result.extended_nutrients?.vitamins?.vitamin_b2).toBe(0.4);
        expect(result.extended_nutrients?.vitamins?.vitamin_b6).toBe(0.5);
        expect(result.extended_nutrients?.vitamins?.vitamin_b12).toBe(1.0);
        expect(result.extended_nutrients?.vitamins?.vitamin_c).toBe(30);
        expect(result.extended_nutrients?.vitamins?.vitamin_e).toBe(2);
        expect(result.extended_nutrients?.vitamins?.vitamin_k).toBe(50);
    });

    test('部分的なデータが適切にデフォルト値で補完される', () => {
        // 部分的なデータ
        const partialData = {
            calories: 150,
            protein: 8
        };

        // 変換の実行
        const result = createStandardNutritionData(partialData);

        // 基本栄養素の検証
        expect(result.calories).toBe(150);
        expect(result.protein).toBe(8);
        expect(result.iron).toBe(0); // デフォルト値
        expect(result.folic_acid).toBe(0); // デフォルト値
        expect(result.calcium).toBe(0); // デフォルト値
        expect(result.vitamin_d).toBe(0); // デフォルト値

        // 互換性プロパティの検証
        expect(result.energy).toBe(150); // caloriesと同じ値
    });
}); 