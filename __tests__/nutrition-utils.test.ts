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
        // テストデータの準備 (MVPスコープに合わせて基本栄養素のみに修正)
        const sourceData: NutritionData = {
            calories: 250, // カロリーは基本として残す
            protein: 10,
            iron: 5,
            folic_acid: 200,
            calcium: 300,
            vitamin_d: 5,
            confidence_score: 0.9, // 信頼度は残す
            // extended_nutrients はMVPスコープ外のため削除
            // fat, carbohydrate, minerals, vitamins なども削除
        };

        // 変換の実行
        const result = convertToStandardizedNutrition(sourceData);

        // 結果の検証 (基本栄養素のみ)
        expect(result.totalCalories).toBe(250);
        expect(result.totalNutrients.find(n => n.name === 'タンパク質')?.value).toBe(10);
        expect(result.totalNutrients.find(n => n.name === '鉄分')?.value).toBe(5);
        expect(result.totalNutrients.find(n => n.name === '葉酸')?.value).toBe(200);
        expect(result.totalNutrients.find(n => n.name === 'カルシウム')?.value).toBe(300);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンD')?.value).toBe(5);

        // 拡張栄養素の検証はコメントアウトまたは削除
        // expect(result.totalNutrients.find(n => n.name === '脂質')?.value).toBe(...);
        // expect(result.totalNutrients.find(n => n.name === '炭水化物')?.value).toBe(...);
        // ... 他の拡張栄養素の検証も削除 ...

        // totalNutrients 配列に基本栄養素以外が含まれていないことを確認（任意）
        const basicNutrientNames = ['タンパク質', '鉄分', '葉酸', 'カルシウム', 'ビタミンD'];
        expect(result.totalNutrients.length).toBe(basicNutrientNames.length);
        result.totalNutrients.forEach(nutrient => {
            expect(basicNutrientNames).toContain(nutrient.name);
        });
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
        expect(result.totalNutrients.find(n => n.name === '鉄分')?.value).toBe(0);
        expect(result.totalNutrients.find(n => n.name === '葉酸')?.value).toBe(0);
        expect(result.totalNutrients.find(n => n.name === 'カルシウム')?.value).toBe(0);
        expect(result.totalNutrients.find(n => n.name === 'ビタミンD')?.value).toBe(0);

        // 互換性プロパティの検証
        // expect(result.energy).toBe(150); // StandardizedMealNutrition に energy はない
    });
}); 