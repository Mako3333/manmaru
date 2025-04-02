import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v2/recipe/parse/route';
import { FoodRepositoryFactory } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { NutritionData, StandardizedMealNutrition } from '@/types/nutrition';
import { StandardApiResponse } from '@/types/api-interfaces';

jest.mock('@/lib/food/food-repository-factory');
jest.mock('@/lib/nutrition/nutrition-service-factory');

describe('レシピ解析API v2のテスト', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('有効なレシピURLで正常なレスポンスを返すこと', async () => {
        // 認識される食材のモックデータ
        const mockIngredients = [
            { name: '豚肉', amount: '300g' },
            { name: '玉ねぎ', amount: '1個' },
            { name: '人参', amount: '1本' }
        ];

        // 栄養計算の結果のモックデータ
        const mockLegacyNutrition: NutritionData = {
            calories: 450,
            protein: 25,
            iron: 3.5,
            folic_acid: 120,
            calcium: 60,
            vitamin_d: 1.2,
            confidence_score: 0.85
        };

        const mockStandardizedNutrition: StandardizedMealNutrition = {
            totalCalories: 450,
            totalNutrients: [
                { name: 'エネルギー', value: 450, unit: 'kcal' },
                { name: 'たんぱく質', value: 25, unit: 'g' },
                { name: '鉄', value: 3.5, unit: 'mg' },
                { name: '葉酸', value: 120, unit: 'mcg' }
            ],
            foodItems: [
                {
                    id: '1',
                    name: '豚肉',
                    amount: 300,
                    unit: 'g',
                    nutrition: {
                        calories: 300,
                        nutrients: [{ name: 'エネルギー', value: 300, unit: 'kcal' }],
                        servingSize: { value: 300, unit: 'g' }
                    }
                },
                {
                    id: '2',
                    name: '野菜類',
                    amount: 200,
                    unit: 'g',
                    nutrition: {
                        calories: 150,
                        nutrients: [{ name: 'エネルギー', value: 150, unit: 'kcal' }],
                        servingSize: { value: 200, unit: 'g' }
                    }
                }
            ],
            pregnancySpecific: {
                folatePercentage: 30,
                ironPercentage: 20,
                calciumPercentage: 6
            }
        };

        // レシピ解析サービスとFoodRepositoryのモック
        const mockRecipeService = {
            parseRecipeUrl: jest.fn().mockResolvedValue({
                ingredients: mockIngredients,
                title: '簡単豚汁',
                servings: 4,
                reliability: { confidence: 0.9 }
            })
        };

        const mockRecipeServiceFactory = {
            createRecipeService: jest.fn().mockReturnValue(mockRecipeService)
        };

        const mockNutritionService = {
            calculateNutritionFromIngredients: jest.fn().mockResolvedValue({
                nutrition: mockLegacyNutrition,
                standardizedNutrition: mockStandardizedNutrition,
                reliability: {
                    confidence: 0.85,
                    balanceScore: 70,
                    completeness: 0.8
                }
            })
        };

        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };

        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue({});
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // リクエストの作成
        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({
                url: 'https://recipe-example.com/pork-soup',
                userId: 'test-user-123'
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<any> = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        expect(responseData.data.ingredients).toBeDefined();
        expect(responseData.data.ingredients).toHaveLength(3);
        expect(responseData.data.title).toBe('簡単豚汁');

        // 栄養データの検証
        expect(responseData.data.nutritionResult).toBeDefined();
        expect(responseData.data.nutritionResult.nutrition).toBeDefined();
        expect(responseData.data.nutritionResult.nutrition.totalCalories).toBe(450);

        // レガシーフォーマットの栄養データも含まれていることを確認
        expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(450);
    });

    it('後方互換性のためのlegacyNutritionフィールドが含まれていること', async () => {
        // モックデータ
        const mockIngredients = [{ name: 'りんご', amount: '2個' }];
        const mockLegacyNutrition: NutritionData = {
            calories: 160,
            protein: 0.8,
            iron: 0.4,
            folic_acid: 10,
            calcium: 20,
            vitamin_d: 0,
            confidence_score: 0.95
        };

        const mockStandardizedNutrition: StandardizedMealNutrition = {
            totalCalories: 160,
            totalNutrients: [
                { name: 'エネルギー', value: 160, unit: 'kcal' }
            ],
            foodItems: [
                {
                    id: '3',
                    name: 'りんご',
                    amount: 2,
                    unit: '個',
                    nutrition: {
                        calories: 160,
                        nutrients: [{ name: 'エネルギー', value: 160, unit: 'kcal' }],
                        servingSize: { value: 2, unit: '個' }
                    }
                }
            ],
            pregnancySpecific: {
                folatePercentage: 2,
                ironPercentage: 2,
                calciumPercentage: 2
            }
        };

        // レシピサービスのモック
        const mockRecipeService = {
            parseRecipeUrl: jest.fn().mockResolvedValue({
                ingredients: mockIngredients,
                title: 'アップルパイ',
                servings: 2,
                reliability: { confidence: 0.95 }
            })
        };

        const mockRecipeServiceFactory = {
            createRecipeService: jest.fn().mockReturnValue(mockRecipeService)
        };

        const mockNutritionService = {
            calculateNutritionFromIngredients: jest.fn().mockResolvedValue({
                nutrition: mockLegacyNutrition,
                standardizedNutrition: mockStandardizedNutrition,
                reliability: {
                    confidence: 0.95,
                    balanceScore: 50,
                    completeness: 0.9
                }
            })
        };

        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };

        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue({});
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // リクエストの作成
        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({ url: 'https://recipe-example.com/apple-pie' }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<any> = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(160);
        expect(responseData.data.nutritionResult.legacyNutrition.protein).toBe(0.8);
    });

    it('無効なURLの場合、適切なエラーレスポンスを返すこと', async () => {
        // 無効なURLでリクエスト
        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({
                url: 'invalid-url'
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<null> = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(400);
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        if (responseData.error) {
            expect(responseData.error.code).toBe(ErrorCode.Base.DATA_VALIDATION_ERROR);
            expect(responseData.error.message).toBeDefined();
        }
    });

    it('レシピに材料がない場合、適切なエラーレスポンスを返すこと', async () => {
        // 材料がないレシピのモック
        const mockRecipeService = {
            parseRecipeUrl: jest.fn().mockResolvedValue({
                ingredients: [],
                title: '材料なしレシピ',
                servings: 0,
                reliability: { confidence: 0.5 }
            })
        };

        const mockRecipeServiceFactory = {
            createRecipeService: jest.fn().mockReturnValue(mockRecipeService)
        };

        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue({});
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue({
            createService: jest.fn().mockReturnValue({})
        });

        // リクエストの作成
        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({ url: 'https://recipe-example.com/no-ingredients' }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<null> = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(400);
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        if (responseData.error) {
            expect(responseData.error.code).toBe(ErrorCode.Nutrition.MISSING_NUTRITION_DATA);
            expect(responseData.error.message).toBeDefined();
        }
    });
}); 