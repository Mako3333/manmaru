import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../../../../../../src/app/api/v2/image/analyze/route';
import { AIServiceFactory } from '../../../../../../src/lib/ai/ai-service-factory';
import { FoodInputParser } from '../../../../../../src/lib/food/food-input-parser';
import { NutritionServiceFactory } from '../../../../../../src/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory } from '../../../../../../src/lib/food/food-repository-factory';
import { AppError } from '../../../../../../src/lib/error/types/base-error';
import { ErrorCode } from '../../../../../../src/lib/error/codes/error-codes';
import { StandardizedMealNutrition } from '../../../../../../src/types/nutrition';

// モックの設定
jest.mock('../../../../../../src/lib/ai/ai-service-factory');
jest.mock('../../../../../../src/lib/food/food-input-parser');
jest.mock('../../../../../../src/lib/nutrition/nutrition-service-factory');
jest.mock('../../../../../../src/lib/food/food-repository-factory');

describe('画像解析API v2のテスト', () => {
    // テスト前の準備
    beforeEach(() => {
        jest.clearAllMocks();

        // AIServiceのモック
        const mockAIService = {
            analyzeMealImage: jest.fn().mockResolvedValue({
                parseResult: {
                    foods: [
                        { foodName: 'ごはん', quantityText: '150g', confidence: 0.9 },
                        { foodName: '納豆', quantityText: '1パック', confidence: 0.85 }
                    ],
                    confidence: 0.9,
                    rawResponse: "ごはん 150g, 納豆 1パック"
                },
                processingTimeMs: 1500,
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // FoodInputParserのモック
        (FoodInputParser.generateNameQuantityPairs as jest.Mock).mockResolvedValue([
            { name: 'ごはん', quantity: '150g' },
            { name: '納豆', quantity: '1パック' }
        ]);

        // NutritionServiceのモック
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: {
                    calories: 300,
                    protein: 15,
                    fat: 5,
                    carbohydrate: 50,
                    iron: 2,
                    folic_acid: 100,
                    calcium: 150,
                    vitamin_d: 3,
                    confidence_score: 0.8,
                },
                reliability: {
                    confidence: 0.8,
                    balanceScore: 70,
                    completeness: 0.9
                },
                matchResults: [
                    { foodName: 'ごはん', matchedFood: { id: '1', name: 'ごはん（精白米）' } },
                    { foodName: '納豆', matchedFood: { id: '2', name: '納豆' } }
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
        const mockRequest = new NextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'data:image/jpeg;base64,ABC123'
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        expect(responseData.data.foods).toHaveLength(2);
        expect(responseData.data.nutritionResult).toBeDefined();

        // 標準化されたフォーマットの検証
        const nutrition = responseData.data.nutritionResult.nutrition;
        expect(nutrition).toBeDefined();
        expect(nutrition.totalCalories).toBe(300);
        expect(nutrition.totalNutrients).toBeDefined();
        expect(nutrition.totalNutrients.length).toBeGreaterThan(0);
        expect(nutrition.foodItems).toBeDefined();

        // totalNutrientsの各項目が正しいフォーマットであることを確認
        nutrition.totalNutrients.forEach((nutrient: any) => {
            expect(nutrient.name).toBeDefined();
            expect(typeof nutrient.value).toBe('number');
            expect(nutrient.unit).toBeDefined();
        });
    });

    it('後方互換性のためのlegacyNutritionフィールドが含まれていること', async () => {
        // リクエストの準備
        const mockRequest = new NextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'data:image/jpeg;base64,ABC123'
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // legacyNutritionフィールドの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(300);
        expect(responseData.data.nutritionResult.legacyNutrition.protein).toBe(15);
        expect(responseData.data.nutritionResult.legacyNutrition.iron).toBe(2);
        expect(responseData.data.nutritionResult.legacyNutrition.folic_acid).toBe(100);
        expect(responseData.data.nutritionResult.legacyNutrition.fat).toBe(5);
        expect(responseData.data.nutritionResult.legacyNutrition.carbohydrate).toBe(50);
    });

    it('無効な画像データの場合、適切なエラーレスポンスを返すこと', async () => {
        // リクエストの準備（無効なデータ）
        const mockRequest = new NextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'invalid-data'
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

    it('AIサービスがエラーを返した場合、適切なエラーレスポンスを返すこと', async () => {
        // AIサービスのモックをエラーを返すように設定
        const mockAIService = {
            analyzeMealImage: jest.fn().mockResolvedValue({
                parseResult: {},
                processingTimeMs: 500,
                error: 'AI解析エラー'
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // リクエストの準備
        const mockRequest = new NextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'data:image/jpeg;base64,ABC123'
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(500);
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        expect(responseData.error.code).toBe(ErrorCode.AI.IMAGE_PROCESSING_ERROR);
    });
}); 