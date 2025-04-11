import {
    calculateNutritionScore,
    getNutrientColor,
    getNutrientBarColor,
    getNutrientValueByName,
    sortNutrients
} from '../../../src/lib/nutrition/nutrition-display-utils';
import { StandardizedMealNutrition, Nutrient, NutritionProgress/*, NutrientUnit*/ } from '../../../src/types/nutrition';

describe('栄養表示ユーティリティ', () => {
    // 栄養スコア計算のテスト
    describe('calculateNutritionScore', () => {
        test('nullが渡された場合は0を返す', () => {
            expect(calculateNutritionScore(null)).toBe(0);
        });

        test('StandardizedMealNutritionで良好な値の場合、高いスコアを返す', () => {
            const standardizedNutrition: StandardizedMealNutrition = {
                totalCalories: 2000,
                totalNutrients: [
                    { name: 'タンパク質', value: 50, unit: 'g' },
                    { name: '鉄分', value: 10, unit: 'mg' },
                    { name: '葉酸', value: 240, unit: 'mcg' },
                    { name: 'カルシウム', value: 650, unit: 'mg' },
                    { name: 'ビタミンD', value: 8.5, unit: 'mcg' }
                ],
                foodItems: [],
                reliability: {
                    confidence: 0.8
                }
            };

            expect(calculateNutritionScore(standardizedNutrition)).toBe(99);
        });

        test('栄養素が不足している（50%未満）場合、低いスコアを返す', () => {
            const deficientNutrition: NutritionProgress = {
                user_id: '1',
                meal_date: '2023-01-01',
                target_calories: 2000,
                target_protein: 60,
                target_iron: 10,
                target_folic_acid: 240,
                target_calcium: 650,
                target_vitamin_d: 8.5,
                actual_calories: 600,
                actual_protein: 12,
                actual_iron: 4,
                actual_folic_acid: 60,
                actual_calcium: 227.5,
                actual_vitamin_d: 1.275,
                calories_percent: 30,
                protein_percent: 20,
                iron_percent: 40,
                folic_acid_percent: 25,
                calcium_percent: 35,
                vitamin_d_percent: 15
            };

            // 各栄養素が目標値の30%以下のため、低めのスコアになる
            expect(calculateNutritionScore(deficientNutrition)).toBeLessThan(50);
        });

        test('栄養素が混在している場合、適切なスコアを返す', () => {
            const mixedNutrition: NutritionProgress = {
                user_id: '1',
                meal_date: '2023-01-01',
                target_calories: 2000,
                target_protein: 60,
                target_iron: 10,
                target_folic_acid: 240,
                target_calcium: 650,
                target_vitamin_d: 8.5,
                actual_calories: 1200,
                actual_protein: 24,
                actual_iron: 12,
                actual_folic_acid: 216,
                actual_calcium: 195,
                actual_vitamin_d: 11.9,
                calories_percent: 60,
                protein_percent: 40,
                iron_percent: 120,
                folic_acid_percent: 90,
                calcium_percent: 30,
                vitamin_d_percent: 140
            };

            // 一部の栄養素が目標を下回り、一部が目標を上回る
            const score = calculateNutritionScore(mixedNutrition);
            expect(score).toBeGreaterThan(30);
            expect(score).toBeLessThan(90);
        });
    });

    // 栄養素色クラス取得のテスト
    describe('getNutrientColor', () => {
        test('50%未満の場合、赤色を返す', () => {
            expect(getNutrientColor(0)).toBe('text-red-500 bg-red-50');
            expect(getNutrientColor(30)).toBe('text-red-500 bg-red-50');
            expect(getNutrientColor(49.9)).toBe('text-red-500 bg-red-50');
        });

        test('50%～80%未満の場合、オレンジ色を返す', () => {
            expect(getNutrientColor(50)).toBe('text-orange-500 bg-orange-50');
            expect(getNutrientColor(65)).toBe('text-orange-500 bg-orange-50');
            expect(getNutrientColor(79.9)).toBe('text-orange-500 bg-orange-50');
        });

        test('80%～120%の場合、緑色を返す', () => {
            expect(getNutrientColor(80)).toBe('text-green-500 bg-green-50');
            expect(getNutrientColor(100)).toBe('text-green-500 bg-green-50');
            expect(getNutrientColor(120)).toBe('text-green-500 bg-green-50');
        });

        test('120%超～150%以下の場合、オレンジ色を返す', () => {
            expect(getNutrientColor(121)).toBe('text-orange-500 bg-orange-50');
            expect(getNutrientColor(135)).toBe('text-orange-500 bg-orange-50');
            expect(getNutrientColor(150)).toBe('text-orange-500 bg-orange-50');
        });

        test('150%超の場合、赤色を返す', () => {
            expect(getNutrientColor(151)).toBe('text-red-500 bg-red-50');
            expect(getNutrientColor(180)).toBe('text-red-500 bg-red-50');
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

        test('50%～80%未満の場合、オレンジ色を返す', () => {
            expect(getNutrientBarColor(50)).toBe('bg-orange-500');
            expect(getNutrientBarColor(65)).toBe('bg-orange-500');
            expect(getNutrientBarColor(79.9)).toBe('bg-orange-500');
        });

        test('80%～120%の場合、緑色を返す', () => {
            expect(getNutrientBarColor(80)).toBe('bg-green-500');
            expect(getNutrientBarColor(100)).toBe('bg-green-500');
            expect(getNutrientBarColor(120)).toBe('bg-green-500');
        });

        test('120%超～150%以下の場合、オレンジ色を返す', () => {
            expect(getNutrientBarColor(121)).toBe('bg-orange-500');
            expect(getNutrientBarColor(135)).toBe('bg-orange-500');
            expect(getNutrientBarColor(150)).toBe('bg-orange-500');
        });

        test('150%超の場合、赤色を返す', () => {
            expect(getNutrientBarColor(151)).toBe('bg-red-500');
            expect(getNutrientBarColor(180)).toBe('bg-red-500');
            expect(getNutrientBarColor(200)).toBe('bg-red-500');
        });
    });

    // getNutrientValueByName関数のテスト
    describe('getNutrientValueByName', () => {
        const testNutrition: StandardizedMealNutrition = {
            totalCalories: 500,
            totalNutrients: [
                { name: 'タンパク質', value: 20, unit: 'g' },
                { name: '鉄分', value: 2.5, unit: 'mg' },
                { name: '葉酸', value: 150, unit: 'mcg' },
                { name: 'カルシウム', value: 200, unit: 'mg' }
            ],
            foodItems: [],
            reliability: {
                confidence: 0.8
            }
        };

        test('存在する栄養素の値を正しく取得できる', () => {
            expect(getNutrientValueByName(testNutrition, 'タンパク質')).toBe(20);
            expect(getNutrientValueByName(testNutrition, '鉄分')).toBe(2.5);
        });

        test('カロリーを特別扱いで取得できる', () => {
            expect(getNutrientValueByName(testNutrition, 'calories')).toBe(500);
            expect(getNutrientValueByName(testNutrition, 'カロリー')).toBe(500);
            expect(getNutrientValueByName(testNutrition, 'エネルギー')).toBe(500);
        });

        test('存在しない栄養素の場合は0を返す', () => {
            expect(getNutrientValueByName(testNutrition, 'ビタミンC')).toBe(0);
            expect(getNutrientValueByName(testNutrition, '亜鉛')).toBe(0);
        });

        test('nullやundefinedの場合は0を返す', () => {
            expect(getNutrientValueByName(null as unknown as StandardizedMealNutrition, 'タンパク質')).toBe(0);
            const emptyNutrition = {} as StandardizedMealNutrition;
            expect(getNutrientValueByName(emptyNutrition, 'タンパク質')).toBe(0);
        });
    });

    // sortNutrients関数のテスト
    describe('sortNutrients', () => {
        test('栄養素を優先順位に従ってソートする', () => {
            const nutrients: Nutrient[] = [
                { name: '食物繊維', value: 10, unit: 'g' },
                { name: 'カルシウム', value: 200, unit: 'mg' },
                { name: 'ビタミンC', value: 80, unit: 'mg' },
                { name: 'タンパク質', value: 20, unit: 'g' },
                { name: '鉄分', value: 2.5, unit: 'mg' }
            ];

            const sorted = sortNutrients(nutrients);

            // タンパク質、鉄分、カルシウムが上位に来るべき
            expect(sorted[0]?.name).toBe('タンパク質');
            expect(sorted[1]?.name).toBe('鉄分');
            expect(sorted[2]?.name).toBe('カルシウム');
            expect(sorted[3]?.name).toBe('食物繊維');
            // ビタミンCは優先順位が定義されていないため最後尾
            expect(sorted[4]?.name).toBe('ビタミンC');
        });

        test('空の配列や未定義の場合は空配列を返す', () => {
            expect(sortNutrients([])).toEqual([]);
            expect(sortNutrients(undefined as unknown as Nutrient[])).toEqual([]);
        });

        test('同じ優先順位の場合はアルファベット順にソートする', () => {
            const nutrients: Nutrient[] = [
                { name: 'ビタミンC', value: 80, unit: 'mg' },
                { name: 'ビタミンA', value: 100, unit: 'mcg' },
                { name: 'ビタミンB12', value: 2, unit: 'mcg' }
            ];

            const sorted = sortNutrients(nutrients);

            // アルファベット順（日本語の場合は文字コード順）
            expect(sorted[0]?.name).toBe('ビタミンA');
            expect(sorted[1]?.name).toBe('ビタミンB12');
            expect(sorted[2]?.name).toBe('ビタミンC');
        });
    });
}); 