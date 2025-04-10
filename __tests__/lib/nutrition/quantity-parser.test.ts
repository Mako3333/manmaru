import { QuantityParser } from '@/lib/nutrition/quantity-parser';
import { FoodQuantity } from '@/types/food';

describe('QuantityParser', () => {
    describe('parseQuantity', () => {
        // 正常系テストケース
        test.each([
            // 標準的な入力
            { input: '100g', expectedValue: 100, expectedUnit: 'g', expectedConfidence: 0.9 },
            { input: '500ml', expectedValue: 500, expectedUnit: 'ml', expectedConfidence: 0.9 },
            { input: '1.5kg', expectedValue: 1.5, expectedUnit: 'kg', expectedConfidence: 0.9 },
            { input: '大さじ2', expectedValue: 2, expectedUnit: '大さじ', expectedConfidence: 0.9 },
            { input: '小さじ0.5', expectedValue: 0.5, expectedUnit: '小さじ', expectedConfidence: 0.9 },
            { input: '1カップ', expectedValue: 1, expectedUnit: 'カップ', expectedConfidence: 0.9 },
            { input: '3個', expectedValue: 3, expectedUnit: '個', expectedConfidence: 0.9 },
            { input: '2切れ', expectedValue: 2, expectedUnit: '切れ', expectedConfidence: 0.9 },
            { input: '1本', expectedValue: 1, expectedUnit: '本', expectedConfidence: 0.9 },
            // スペースや全角文字を含む入力
            { input: ' 200 ｇ ', expectedValue: 200, expectedUnit: 'g', expectedConfidence: 0.9 },
            { input: '３枚', expectedValue: 3, expectedUnit: '枚', expectedConfidence: 0.9 }, // 全角数字対応 (実装依存)
            // 日本語単位 + 数値
            { input: '大匙1', expectedValue: 1, expectedUnit: '大さじ', expectedConfidence: 0.9 },
            { input: 'こさじ3', expectedValue: 3, expectedUnit: '小さじ', expectedConfidence: 0.9 },
            // 数値のみ (標準量扱い)
            { input: '150', expectedValue: 150, expectedUnit: '標準量', expectedConfidence: 0.7 },
            { input: '0.5', expectedValue: 0.5, expectedUnit: '標準量', expectedConfidence: 0.7 },
            // 漢数字 (実装依存 - extractJapaneseNumber)
            { input: '一つまみ', expectedValue: 1, expectedUnit: '標準量', expectedConfidence: 0.5 }, // 想定: 未対応? デフォルト値
            { input: '五個', expectedValue: 5, expectedUnit: '個', expectedConfidence: 0.8 }, // 想定: 漢数字から抽出
            { input: '半カップ', expectedValue: 0.5, expectedUnit: 'カップ', expectedConfidence: 0.8 }, // 想定: 漢数字から抽出
        ])('$input -> value=$expectedValue, unit=$expectedUnit', ({ input, expectedValue, expectedUnit, expectedConfidence }) => {
            const { quantity, confidence } = QuantityParser.parseQuantity(input);
            expect(quantity.value).toBe(expectedValue);
            expect(quantity.unit).toBe(expectedUnit);
            expect(confidence).toBeCloseTo(expectedConfidence);
        });

        // 不正な入力や解析不能なケース
        test.each([
            { input: undefined, expectedUnit: '標準量', expectedValue: 1, expectedConfidence: 0.5 },
            { input: '', expectedUnit: '標準量', expectedValue: 1, expectedConfidence: 0.5 },
            { input: '不明な単位', expectedUnit: '標準量', expectedValue: 1, expectedConfidence: 0.5 },
            { input: '約100グラム', expectedUnit: '標準量', expectedValue: 1, expectedConfidence: 0.5 }, // 「約」は未対応想定
            { input: '100グラムと50グラム', expectedUnit: '標準量', expectedValue: 1, expectedConfidence: 0.5 }, // 複数数値は未対応想定
        ])('不正な入力 $input はデフォルト値を返す', ({ input, expectedUnit, expectedValue, expectedConfidence }) => {
            const { quantity, confidence } = QuantityParser.parseQuantity(input as string | undefined);
            expect(quantity.unit).toBe(expectedUnit);
            expect(quantity.value).toBe(expectedValue);
            expect(confidence).toBeCloseTo(expectedConfidence);
        });

        // foodName や category 引数は parseQuantity では直接使用されないはず (convertToGrams で使用)
        test('foodNameやcategory引数は結果に影響しないこと', () => {
            const { quantity: q1, confidence: c1 } = QuantityParser.parseQuantity('100g');
            const { quantity: q2, confidence: c2 } = QuantityParser.parseQuantity('100g', 'りんご', '果物');
            expect(q1).toEqual(q2);
            expect(c1).toEqual(c2);
        });
    });

    describe('convertToGrams', () => {
        test.each([
            // 基本単位
            { input: { value: 150, unit: 'g' }, expectedGrams: 150, expectedConfidence: 1.0 },
            { input: { value: 2, unit: 'kg' }, expectedGrams: 2000, expectedConfidence: 1.0 },
            { input: { value: 250, unit: 'ml' }, expectedGrams: 250, expectedConfidence: 0.9 }, // mlは概算
            // 一般的な計量単位
            { input: { value: 2, unit: '大さじ' }, expectedGrams: 30, expectedConfidence: 0.85 },
            { input: { value: 1, unit: '小さじ' }, expectedGrams: 5, expectedConfidence: 0.85 },
            { input: { value: 1.5, unit: 'カップ' }, expectedGrams: 300, expectedConfidence: 0.8 }, // カップは信頼度低め
            // 食品特有の単位 (デフォルト)
            { input: { value: 1, unit: '個' }, expectedGrams: 50, expectedConfidence: 0.7 }, // デフォルト個
            { input: { value: 2, unit: '切れ' }, expectedGrams: 160, expectedConfidence: 0.7 }, // デフォルト切れ
            { input: { value: 3, unit: '枚' }, expectedGrams: 180, expectedConfidence: 0.7 }, // デフォルト枚
            // カテゴリ/食品名による特殊ケース
            { input: { value: 1, unit: '個' }, foodName: 'りんご', category: '果物', expectedGrams: 200, expectedConfidence: 0.95 },
            { input: { value: 2, unit: '個' }, foodName: 'みかん', category: '果物', expectedGrams: 160, expectedConfidence: 0.95 },
            { input: { value: 1, unit: '個' }, foodName: 'ぶどう', category: '果物', expectedGrams: 50, expectedConfidence: 0.7 }, // 特殊ケースなし -> デフォルト個
            { input: { value: 1, unit: '杯' }, category: '穀類-米', expectedGrams: 150, expectedConfidence: 0.9 },
            { input: { value: 1, unit: '束' }, category: '野菜-葉物', expectedGrams: 80, expectedConfidence: 0.9 },
            { input: { value: 1, unit: '切れ' }, category: '肉類', expectedGrams: 100, expectedConfidence: 0.9 },
            { input: { value: 1, unit: '尾' }, category: '魚介類', expectedGrams: 100, expectedConfidence: 0.9 },
            // 未知の単位
            { input: { value: 1, unit: '不明単位' }, expectedGrams: 1, expectedConfidence: 0.5 }, // デフォルト値 1g
            { input: { value: 10, unit: '標準量' }, expectedGrams: 10, expectedConfidence: 0.5 }, // 標準量もデフォルト1g換算
        ])('$input.value $input.unit (food: $foodName, cat: $category) -> $expectedGrams g', ({ input, foodName, category, expectedGrams, expectedConfidence }) => {
            const { grams, confidence } = QuantityParser.convertToGrams(input, foodName, category);
            expect(grams).toBeCloseTo(expectedGrams);
            expect(confidence).toBeCloseTo(expectedConfidence);
        });
    });
}); 