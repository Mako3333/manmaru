import {
    convertToStandardizedNutrition,
} from '@/lib/nutrition/nutrition-type-utils';
import {
    safeConvertNutritionData,
    createEmptyNutritionData
} from '@/lib/nutrition/nutrition-utils';
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
        const result = convertToStandardizedNutrition(sourceData);

        // 結果の検証
        expect(result.totalCalories).toBe(0); // sourceData.calories is 0
        expect(result.totalNutrients.find(n => n.name === 'タンパク質')?.value).toBe(10);
        expect(result.totalNutrients.find(n => n.name === '鉄')?.value).toBe(5);
        expect(result.totalNutrients.find(n => n.name === '葉酸')?.value).toBe(200);
        expect(result.totalNutrients.find(n => n.name === 'カルシウム')?.value).toBe(300);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンD')?.value).toBe(5);

        // 拡張栄養素の検証 (StandardizedMealNutrition の構造に合わせて修正)
        expect(result.totalNutrients.find(n => n.name === '脂質')?.value).toBe(5);
        expect(result.totalNutrients.find(n => n.name === '炭水化物')?.value).toBe(30);
        expect(result.totalNutrients.find(n => n.name === '食物繊維')?.value).toBe(3);
        expect(result.totalNutrients.find(n => n.name === '糖質')?.value).toBe(2);
        expect(result.totalNutrients.find(n => n.name === '食塩相当量')?.value).toBe(1);

        // ミネラルの検証
        expect(result.totalNutrients.find(n => n.name === 'ナトリウム')?.value).toBe(150);
        expect(result.totalNutrients.find(n => n.name === 'カリウム')?.value).toBe(200);
        expect(result.totalNutrients.find(n => n.name === 'マグネシウム')?.value).toBe(50);
        expect(result.totalNutrients.find(n => n.name === 'リン')?.value).toBe(100);
        expect(result.totalNutrients.find(n => n.name === '亜鉛')?.value).toBe(2);

        // ビタミンの検証
        expect(result.totalNutrients.find(n => n.name === 'ビタミンA')?.value).toBe(100);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンB1')?.value).toBe(0.3);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンB2')?.value).toBe(0.4);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンB6')?.value).toBe(0.5);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンB12')?.value).toBe(1.0);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンC')?.value).toBe(30);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンE')?.value).toBe(2);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンK')?.value).toBe(50);
    });

    test('部分的なデータが適切にデフォルト値で補完される', () => {
        // 部分的なデータ
        const partialData: Partial<NutritionData> = {
            calories: 150,
            protein: 8
        };

        // 変換の実行
        const result = convertToStandardizedNutrition(partialData as NutritionData); // 型アサーションが必要な場合がある

        // 基本栄養素の検証
        expect(result.totalCalories).toBe(150);
        expect(result.totalNutrients.find(n => n.name === 'タンパク質')?.value).toBe(8);
        expect(result.totalNutrients.find(n => n.name === '鉄')?.value).toBe(0);
        expect(result.totalNutrients.find(n => n.name === '葉酸')?.value).toBe(0);
        expect(result.totalNutrients.find(n => n.name === 'カルシウム')?.value).toBe(0);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンD')?.value).toBe(0);

        // 互換性プロパティの検証
        // expect(result.energy).toBe(150); // StandardizedMealNutrition に energy はない
    });
}); 