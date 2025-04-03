import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v2/recipe/parse/route';
import { FoodRepositoryFactory } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { NutritionData, StandardizedMealNutrition } from '@/types/nutrition';
import { StandardApiResponse } from '@/types/api-interfaces';
import { AIServiceFactory } from '@/lib/ai/ai-service-factory';

jest.mock('@/lib/ai/ai-service-factory');
jest.mock('@/lib/nutrition/nutrition-service-factory');
jest.mock('@/lib/food/food-repository-factory');

describe('レシピ解析API v2のテスト', () => {
    // テスト用サンプルデータ (他のテストから流用・調整)
    const mockIngredients = [
        { name: '鶏むね肉', quantity: '1枚' },
        { name: '玉ねぎ', quantity: '1/2個' },
        { name: '醤油', quantity: '大さじ2' }
    ];
    const mockLegacyNutrition: NutritionData = {
        calories: 450, protein: 40, fat: 10, carbohydrate: 45, iron: 1.5,
        folic_acid: 80, calcium: 50, vitamin_d: 2, confidence_score: 0.85
    };
    const mockStandardNutrition: StandardizedMealNutrition = {
        totalCalories: 450,
        totalNutrients: [{ name: 'エネルギー', value: 450, unit: 'kcal' }],
        foodItems: [], // レシピ解析では foodItems は空になることが多い
        pregnancySpecific: { folatePercentage: 20, ironPercentage: 10, calciumPercentage: 5 }
    };
    // 1人前データ (例)
    const mockLegacyPerServing: NutritionData = {
        calories: 225, protein: 20, fat: 5, carbohydrate: 22.5, iron: 0.75,
        folic_acid: 40, calcium: 25, vitamin_d: 1, confidence_score: 0.85
    };
    const mockStandardPerServing: StandardizedMealNutrition = {
        totalCalories: 225,
        totalNutrients: [{ name: 'エネルギー', value: 225, unit: 'kcal' }],
        foodItems: [],
        pregnancySpecific: { folatePercentage: 10, ironPercentage: 5, calciumPercentage: 2.5 }
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('有効なレシピURLで正常なレスポンスを返すこと', async () => {
        // AIサービス (レシピ解析) のモック
        const mockAIService = {
            parseRecipeFromUrl: jest.fn().mockResolvedValue({
                parseResult: {
                    title: '簡単鶏むね肉の照り焼き',
                    servings: '2人分',
                    foods: mockIngredients,
                },
                error: null
            }),
            analyzeRecipeText: jest.fn().mockResolvedValue({
                parseResult: {
                    title: 'ダミーテキストレシピ',
                    servings: '1人分',
                    foods: [{ foodName: 'ダミー材料', quantityText: '少々' }]
                },
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // NutritionService のモックを設定
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: mockLegacyNutrition,
                reliability: { confidence: 0.85, balanceScore: 70, completeness: 0.9 },
                matchResults: mockIngredients.map(ing => ({ foodName: ing.name, matchedFood: { id: `db-${ing.name}`, name: `DB ${ing.name}` } })),
                foods: []
                // standardizedNutrition はルート内で変換するので不要
            })
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // FoodRepository のモック
        const mockFoodRepo = {};
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepo);

        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({ url: 'https://example.com/recipe' }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<any> = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        expect(responseData.data.data.recipe).toBeDefined();
        expect(responseData.data.data.recipe.ingredients).toBeDefined();
        expect(responseData.data.data.recipe.ingredients).toHaveLength(3);
        expect(responseData.data.data.recipe.title).toBe('簡単鶏むね肉の照り焼き');
        expect(responseData.data.data.recipe.servings).toBe('2人分');

        // 栄養データの検証
        expect(responseData.data.data.nutritionResult).toBeDefined();
        expect(responseData.data.data.nutritionResult.nutrition).toBeDefined();
        expect(responseData.data.data.nutritionResult.nutrition.totalCalories).toBe(450);
        expect(responseData.data.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.data.nutritionResult.legacyNutrition.calories).toBe(450);

        // 1人前データの検証 (存在することを確認)
        expect(responseData.data.data.nutritionResult.perServing).toBeDefined();
        expect(responseData.data.data.nutritionResult.legacyPerServing).toBeDefined();
    });

    it('後方互換性のためのlegacyNutritionフィールドが含まれていること', async () => {
        // AIサービス (レシピ解析) のモック
        const mockAIService = {
            parseRecipeFromUrl: jest.fn().mockResolvedValue({
                parseResult: {
                    title: 'サンプルレシピ',
                    servings: '1人分',
                    foods: [{ foodName: '豆腐', quantityText: '1丁' }]
                },
                error: null
            }),
            analyzeRecipeText: jest.fn().mockResolvedValue({
                parseResult: {
                    title: 'ダミーテキストレシピ',
                    servings: '1人分',
                    foods: [{ foodName: 'ダミー材料', quantityText: '少々' }]
                },
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // NutritionService のモックを設定
        const mockLegacyNutritionOneServing: NutritionData = {
            calories: 160, protein: 15, fat: 8, carbohydrate: 5, iron: 2,
            folic_acid: 50, calcium: 150, vitamin_d: 0, confidence_score: 0.9
        };
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: mockLegacyNutritionOneServing,
                reliability: { confidence: 0.9, balanceScore: 80, completeness: 0.95 },
                matchResults: [{ foodName: '豆腐', matchedFood: { id: 'db-tofu', name: '木綿豆腐' } }],
                foods: []
            })
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // FoodRepository のモック
        const mockFoodRepo = {};
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepo);


        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({ url: 'https://example.com/recipe2' }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<any> = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.data.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.data.nutritionResult.legacyNutrition.calories).toBe(160);
        expect(responseData.data.data.nutritionResult.legacyNutrition.protein).toBe(15);
        // 1人前データもlegacyNutritionと同じはず
        expect(responseData.data.data.nutritionResult.legacyPerServing).toBeDefined();
        expect(responseData.data.data.nutritionResult.legacyPerServing.calories).toBe(160);
    });

    it('無効なURLの場合、適切なエラーレスポンスを返すこと', async () => {
        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({ url: 'invalid-url' }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<null> = await response.json();

        expect(response.status).toBe(400);
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        if (responseData.error) {
            expect(responseData.error.code).toBe(ErrorCode.Base.DATA_VALIDATION_ERROR);
            expect(responseData.error.message).toContain('入力データが無効です');
        }
    });

    it('レシピに材料がない場合、適切なエラーレスポンスを返すこと', async () => {
        // 材料リストが空で返るAIサービスのモック
        const mockAIService = {
            parseRecipeFromUrl: jest.fn().mockResolvedValue({
                parseResult: {
                    title: '材料なしレシピ',
                    servings: '1人分',
                    foods: [],
                },
                error: null
            }),
            analyzeRecipeText: jest.fn().mockResolvedValue({
                parseResult: {
                    title: 'ダミーテキストレシピ（材料なし）',
                    servings: '1人分',
                    foods: []
                },
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // NutritionService は呼ばれないはず
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn()
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // FoodRepository のモック
        const mockFoodRepo = {};
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepo);

        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({ url: 'https://example.com/no-ingredients' }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<null> = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(400); // ステータスコード 400 を期待
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        if (responseData.error) {
            expect(responseData.error.code).toBe(ErrorCode.Nutrition.FOOD_NOT_FOUND);
            expect(responseData.error.message).toBe('食品が見つかりませんでした。');
        }
    });
}); 