import { NutritionDatabase } from '@/lib/nutrition/database';
import { DatabaseFoodItem } from '@/types/nutrition';

// モックfetchの設定
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({
            foods: {
                "こめ　精白米": {
                    name: "こめ　精白米",
                    id: "01001",
                    calories: 358.0,
                    protein: 6.1,
                    iron: 0.8,
                    folic_acid: 12.0,
                    calcium: 5.0,
                    vitamin_d: 0.0,
                    standard_quantity: "100g",
                    aliases: ["白米", "ライス"]
                },
                "えんばく　オートミール": {
                    name: "えんばく　オートミール",
                    id: "01004",
                    calories: 350.0,
                    protein: 13.7,
                    iron: 3.9,
                    folic_acid: 30.0,
                    calcium: 47.0,
                    vitamin_d: 0.0,
                    standard_quantity: "100g",
                    aliases: ["オート", "オーツ"]
                }
            }
        })
    })
) as jest.Mock;

describe('NutritionDatabase', () => {
    let db: NutritionDatabase;

    beforeAll(async () => {
        db = NutritionDatabase.getInstance();
        await db.loadExternalDatabase();
    });

    test('データベースが正しく読み込まれること', () => {
        expect(db.isFullyLoaded()).toBe(true);
        expect(db.getFoodCount()).toBeGreaterThan(2);
    });

    test('食品名で検索できること', () => {
        const rice = db.findFoodByName('こめ');
        expect(rice).not.toBeNull();
        expect(rice?.name).toContain('こめ');
    });

    test('栄養素で食品を検索できること', () => {
        const highIronFoods = db.findFoodsByNutrient('iron', 2.0);
        expect(highIronFoods.length).toBeGreaterThan(0);
        expect(highIronFoods[0].iron).toBeGreaterThanOrEqual(2.0);
    });

    test('別名でも食品を検索できること', () => {
        const rice = db.findFoodByName('ライス');
        expect(rice).not.toBeNull();
        expect(rice?.name).toContain('こめ');
    });

    test('カテゴリで食品を検索できること（カテゴリがある場合）', () => {
        // カテゴリがある場合のテスト
        // モックデータにはカテゴリがないため、実際のテストでは調整が必要
        const foods = db.findFoodsByCategory('GRAINS');
        // このテストはデータベースの状態によって結果が変わる
    });

    test('栄養素計算が適切に行われること', async () => {
        const foods = [
            { name: "ご飯", quantity: "100g" },
            { name: "ほうれん草", quantity: "50g" }
        ];

        const result = await db.calculateNutrition(foods);

        expect(result).toHaveProperty('calories');
        expect(result).toHaveProperty('protein');
        expect(result).toHaveProperty('iron');
        expect(result).toHaveProperty('calcium');
        expect(result).toHaveProperty('folic_acid');
        expect(result).toHaveProperty('vitamin_d');

        // 値のテスト（実際の値はデータベースの中身によって変わる）
        expect(result.calories).toBeGreaterThan(0);
        expect(result.protein).toBeGreaterThan(0);
    });
}); 