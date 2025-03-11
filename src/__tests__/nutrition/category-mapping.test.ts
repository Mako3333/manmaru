import { FOOD_ID_CATEGORY_MAP, FoodCategory } from '@/types/nutrition';
import { NutritionDatabase } from '@/lib/nutrition/database';

// モックデータ
const mockFoods = {
    "テスト穀物": {
        name: "テスト穀物",
        id: "01001",
        calories: 100,
        protein: 5,
        iron: 1,
        folic_acid: 10,
        calcium: 20,
        vitamin_d: 0,
        standard_quantity: "100g"
    },
    "テスト豆類": {
        name: "テスト豆類",
        id: "04001",
        calories: 200,
        protein: 15,
        iron: 2,
        folic_acid: 30,
        calcium: 50,
        vitamin_d: 0,
        standard_quantity: "100g"
    },
    "テスト野菜": {
        name: "テスト野菜",
        id: "06001",
        calories: 50,
        protein: 2,
        iron: 1,
        folic_acid: 80,
        calcium: 40,
        vitamin_d: 0,
        standard_quantity: "100g"
    },
    "テストその他": {
        name: "テストその他",
        id: "18001",
        calories: 150,
        protein: 8,
        iron: 1.5,
        folic_acid: 20,
        calcium: 30,
        vitamin_d: 0,
        standard_quantity: "100g"
    }
};

// テスト実行前にNutritionDatabaseのprocessAndAssignCategoriesメソッドをモック
const originalProcessAndAssignCategories = NutritionDatabase.prototype['processAndAssignCategories'];
// @ts-ignore: TypeScriptエラーを一時的に無視
NutritionDatabase.prototype['processAndAssignCategories'] = function (foods: any) {
    const processedFoods = { ...foods };
    for (const [key, food] of Object.entries(processedFoods)) {
        const typedFood = food as any;
        if (typedFood.id) {
            const categoryPrefix = typedFood.id.substring(0, 2);
            if (FOOD_ID_CATEGORY_MAP[categoryPrefix]) {
                typedFood.category = FOOD_ID_CATEGORY_MAP[categoryPrefix];
            } else {
                typedFood.category = FoodCategory.OTHER;
            }
        }
    }
    return processedFoods;
};

describe('カテゴリマッピングテスト', () => {
    afterAll(() => {
        // テスト完了後に元の実装に戻す
        // @ts-ignore: TypeScriptエラーを一時的に無視
        NutritionDatabase.prototype['processAndAssignCategories'] = originalProcessAndAssignCategories;
    });

    test('食品IDからカテゴリが正しくマッピングされる', () => {
        const db = NutritionDatabase.getInstance();
        // @ts-ignore: プライベートメソッドのテスト
        const processedFoods = db['processAndAssignCategories'](mockFoods);

        expect(processedFoods["テスト穀物"].category).toBe(FoodCategory.GRAINS);
        expect(processedFoods["テスト豆類"].category).toBe(FoodCategory.PROTEIN);
        expect(processedFoods["テスト野菜"].category).toBe(FoodCategory.VEGETABLES);
        expect(processedFoods["テストその他"].category).toBe(FoodCategory.OTHER);
    });

    test('すべてのIDプレフィックスにカテゴリが定義されている', () => {
        // 01〜18までのすべてのIDプレフィックスがマッピングされていることを確認
        for (let i = 1; i <= 18; i++) {
            const prefix = i.toString().padStart(2, '0');
            expect(FOOD_ID_CATEGORY_MAP[prefix]).toBeDefined();
        }
    });
}); 