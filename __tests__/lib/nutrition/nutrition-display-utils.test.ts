import {
    calculateNutritionScore,
    getNutrientColor,
    getNutrientBarColor,
    NutritionData
} from '../../../src/lib/nutrition/nutrition-display-utils';

describe('栄養表示ユーティリティ', () => {
    // 栄養スコア計算のテスト
    describe('calculateNutritionScore', () => {
        test('nullが渡された場合は0を返す', () => {
            expect(calculateNutritionScore(null)).toBe(0);
        });

        test('すべての栄養素が理想的な範囲内（50-110%）の場合、満点に近いスコアを返す', () => {
            const idealNutrition: NutritionData = {
                calories_percent: 100,
                protein_percent: 100,
                iron_percent: 100,
                folic_acid_percent: 100,
                calcium_percent: 100,
                vitamin_d_percent: 100
            };

            expect(calculateNutritionScore(idealNutrition)).toBe(100);
        });

        test('栄養素が不足している（50%未満）場合、低いスコアを返す', () => {
            const deficientNutrition: NutritionData = {
                calories_percent: 30,
                protein_percent: 20,
                iron_percent: 40,
                folic_acid_percent: 25,
                calcium_percent: 35,
                vitamin_d_percent: 15
            };

            // 50%未満は達成率の半分をスコアとするため、低めのスコアになる
            // 各スコアは平均して約14点なので、合計約84点。100点満点に換算して約28点。
            const expectedScore = Math.round((30 / 2 + 20 / 2 + 40 / 2 + 25 / 2 + 35 / 2 + 15 / 2) / 6 * 2);
            expect(calculateNutritionScore(deficientNutrition)).toBe(expectedScore);
        });

        test('栄養素が過剰（130%超）の場合、減点される', () => {
            const excessiveNutrition: NutritionData = {
                calories_percent: 150,
                protein_percent: 140,
                iron_percent: 160,
                folic_acid_percent: 130,
                calcium_percent: 145,
                vitamin_d_percent: 170
            };

            // 130%超は25点になる。130%ちょうどは減点されるが25点より高い。
            // 6項目とも25点なので、合計150点。100点満点に換算して50点。
            expect(calculateNutritionScore(excessiveNutrition)).toBe(50);
        });

        test('栄養素が混在している場合、適切なスコアを返す', () => {
            const mixedNutrition: NutritionData = {
                calories_percent: 60,  // 理想範囲内: 50点
                protein_percent: 40,   // 不足: 20点
                iron_percent: 120,     // やや過剰: 約37.5点
                folic_acid_percent: 90, // 理想範囲内: 50点
                calcium_percent: 30,    // 不足: 15点
                vitamin_d_percent: 140  // 過剰: 25点
            };

            // (50 + 20 + 37.5 + 50 + 15 + 25) / 6 * 2 ≈ 65.8 → 66点
            const expectedScore = Math.round((50 + 20 + (50 - (10 / 20) * 25) + 50 + 15 + 25) / 6 * 2);
            expect(calculateNutritionScore(mixedNutrition)).toBe(expectedScore);
        });
    });

    // 栄養素色クラス取得のテスト
    describe('getNutrientColor', () => {
        test('50%未満の場合、赤色を返す', () => {
            expect(getNutrientColor(0)).toBe('text-red-500 bg-red-50');
            expect(getNutrientColor(30)).toBe('text-red-500 bg-red-50');
            expect(getNutrientColor(49.9)).toBe('text-red-500 bg-red-50');
        });

        test('50%～70%未満の場合、オレンジ色を返す', () => {
            expect(getNutrientColor(50)).toBe('text-orange-500 bg-orange-50');
            expect(getNutrientColor(60)).toBe('text-orange-500 bg-orange-50');
            expect(getNutrientColor(69.9)).toBe('text-orange-500 bg-orange-50');
        });

        test('70%～110%の場合、緑色を返す', () => {
            expect(getNutrientColor(70)).toBe('text-green-500 bg-green-50');
            expect(getNutrientColor(100)).toBe('text-green-500 bg-green-50');
            expect(getNutrientColor(110)).toBe('text-green-500 bg-green-50');
        });

        test('110%超～130%以下の場合、オレンジ色を返す', () => {
            expect(getNutrientColor(110.1)).toBe('text-orange-500 bg-orange-50');
            expect(getNutrientColor(120)).toBe('text-orange-500 bg-orange-50');
            expect(getNutrientColor(130)).toBe('text-orange-500 bg-orange-50');
        });

        test('130%超の場合、赤色を返す', () => {
            expect(getNutrientColor(130.1)).toBe('text-red-500 bg-red-50');
            expect(getNutrientColor(150)).toBe('text-red-500 bg-red-50');
            expect(getNutrientColor(200)).toBe('text-red-500 bg-red-50');
        });
    });

    // 栄養素バー色取得のテスト
    describe('getNutrientBarColor', () => {
        test('50%未満の場合、赤色を返す', () => {
            expect(getNutrientBarColor(0)).toBe('bg-red-500');
            expect(getNutrientBarColor(30)).toBe('bg-red-500');
            expect(getNutrientBarColor(49.9)).toBe('bg-red-500');
        });

        test('50%～70%未満の場合、オレンジ色を返す', () => {
            expect(getNutrientBarColor(50)).toBe('bg-orange-500');
            expect(getNutrientBarColor(60)).toBe('bg-orange-500');
            expect(getNutrientBarColor(69.9)).toBe('bg-orange-500');
        });

        test('70%～110%の場合、緑色を返す', () => {
            expect(getNutrientBarColor(70)).toBe('bg-green-500');
            expect(getNutrientBarColor(100)).toBe('bg-green-500');
            expect(getNutrientBarColor(110)).toBe('bg-green-500');
        });

        test('110%超～130%以下の場合、オレンジ色を返す', () => {
            expect(getNutrientBarColor(110.1)).toBe('bg-orange-500');
            expect(getNutrientBarColor(120)).toBe('bg-orange-500');
            expect(getNutrientBarColor(130)).toBe('bg-orange-500');
        });

        test('130%超の場合、赤色を返す', () => {
            expect(getNutrientBarColor(130.1)).toBe('bg-red-500');
            expect(getNutrientBarColor(150)).toBe('bg-red-500');
            expect(getNutrientBarColor(200)).toBe('bg-red-500');
        });
    });
}); 