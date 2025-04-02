import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../../../../../../src/app/api/v2/meal/analyze/route';
import { NutritionServiceFactory } from '../../../../../../src/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory } from '../../../../../../src/lib/food/food-repository-factory';
import { ErrorCode } from '../../../../../../src/lib/error/codes/error-codes';
import { StandardizedMealNutrition } from '../../../../../../src/types/nutrition';

// モックの設定
jest.mock('../../../../../../src/lib/nutrition/nutrition-service-factory');
jest.mock('../../../../../../src/lib/food/food-repository-factory');

describe('食事分析API v2のテスト', () => {
    // テスト前の準備
    beforeEach(() => {
        jest.clearAllMocks();

        // NutritionServiceのモック
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: {
                    calories: 320,
                    protein: 18,
                    fat: 8,
                    carbohydrate: 55,
                    dietary_fiber: 4.2,
                    sugar: 6,
                    iron: 2.5,
                    folic_acid: 120,
                    calcium: 180,
                    vitamin_d: 4,
                    confidence_score: 0.85,
                },
                reliability: {
                    confidence: 0.85,
                    balanceScore: 75,
                    completeness: 0.95
                },
                matchResults: [
                    { foodName: 'ごはん', matchedFood: { id: '1', name: 'ごはん（精白米）' } },
                    { foodName: '卵', matchedFood: { id: '3', name: '鶏卵' } },
                    { foodName: 'ほうれん草', matchedFood: { id: '4', name: 'ほうれん草' } }
                ]
            })
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // FoodRepositoryのモック
        const mockFoodRepo = {};
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepo);
    });

    it('正しいリクエストの場合、StandardizedMealNutritionフォーマットでレスポンスを返すこと', async () => {
        // リクエストの準備
        const mockRequest = new NextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                foods: [
                    { name: 'ごはん', quantity: '150g' },
                    { name: '卵', quantity: '1個' },
                    { name: 'ほうれん草', quantity: '50g' }
                ]
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        expect(responseData.data.nutritionResult).toBeDefined();

        // 標準化されたフォーマットの検証
        const nutrition = responseData.data.nutritionResult.nutrition;
        expect(nutrition).toBeDefined();
        expect(nutrition.totalCalories).toBe(320);
        expect(nutrition.totalNutrients).toBeDefined();
        expect(nutrition.totalNutrients.length).toBeGreaterThan(0);
        expect(nutrition.foodItems).toBeDefined();

        // totalNutrientsの各項目が正しいフォーマットであることを確認
        nutrition.totalNutrients.forEach((nutrient: any) => {
            expect(nutrient.name).toBeDefined();
            expect(typeof nutrient.value).toBe('number');
            expect(nutrient.unit).toBeDefined();
        });

        // 妊娠関連の栄養素が含まれているか確認
        const pregnancyNutrients = ['folic_acid', 'calcium', 'iron', 'vitamin_d'];
        const nutrientNames = nutrition.totalNutrients.map((n: any) => n.name);
        pregnancyNutrients.forEach(nutrient => {
            expect(nutrientNames).toContain(nutrient);
        });
    });

    it('後方互換性のためのlegacyNutritionフィールドが含まれていること', async () => {
        // リクエストの準備
        const mockRequest = new NextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                foods: [
                    { name: 'ごはん', quantity: '150g' },
                    { name: '卵', quantity: '1個' },
                    { name: 'ほうれん草', quantity: '50g' }
                ]
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // legacyNutritionフィールドの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(320);
        expect(responseData.data.nutritionResult.legacyNutrition.protein).toBe(18);
        expect(responseData.data.nutritionResult.legacyNutrition.iron).toBe(2.5);
        expect(responseData.data.nutritionResult.legacyNutrition.folic_acid).toBe(120);
        expect(responseData.data.nutritionResult.legacyNutrition.fat).toBe(8);
        expect(responseData.data.nutritionResult.legacyNutrition.carbohydrate).toBe(55);
        expect(responseData.data.nutritionResult.legacyNutrition.dietary_fiber).toBe(4.2);
        expect(responseData.data.nutritionResult.legacyNutrition.sugar).toBe(6);
    });

    it('空の食品リストの場合、適切なエラーレスポンスを返すこと', async () => {
        // リクエストの準備（空のリスト）
        const mockRequest = new NextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                foods: []
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(400);
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        expect(responseData.error.code).toBe(ErrorCode.Base.DATA_VALIDATION_ERROR);
    });

    it('無効なリクエスト形式の場合、適切なエラーレスポンスを返すこと', async () => {
        // リクエストの準備（無効な形式）
        const mockRequest = new NextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                // foodsフィールドがない
                invalidField: 'test'
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(400);
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        expect(responseData.error.code).toBe(ErrorCode.Base.DATA_VALIDATION_ERROR);
    });

    it('NutritionServiceでエラーが発生した場合、適切なエラーレスポンスを返すこと', async () => {
        // NutritionServiceのモックをエラーを返すように設定
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockRejectedValue(
                new Error('栄養計算エラー')
            )
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // リクエストの準備
        const mockRequest = new NextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                foods: [
                    { name: 'ごはん', quantity: '150g' },
                    { name: '卵', quantity: '1個' }
                ]
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(500);
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        expect(responseData.error.code).toBe(ErrorCode.Base.UNKNOWN_ERROR);
    });
}); 