import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../../../../../../src/app/api/v2/recipe/parse/route';
import { AIServiceFactory } from '../../../../../../src/lib/ai/ai-service-factory';
import { NutritionServiceFactory } from '../../../../../../src/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory } from '../../../../../../src/lib/food/food-repository-factory';
import { ErrorCode } from '../../../../../../src/lib/error/codes/error-codes';
import { StandardizedMealNutrition } from '../../../../../../src/types/nutrition';

// モックの設定
jest.mock('../../../../../../src/lib/ai/ai-service-factory');
jest.mock('../../../../../../src/lib/nutrition/nutrition-service-factory');
jest.mock('../../../../../../src/lib/food/food-repository-factory');

describe('レシピ解析API v2のテスト', () => {
    // テスト前の準備
    beforeEach(() => {
        jest.clearAllMocks();

        // AIServiceのモック
        const mockAIService = {
            analyzeRecipeText: jest.fn().mockResolvedValue({
                parseResult: {
                    foods: [
                        { foodName: 'ほうれん草', quantityText: '1束' },
                        { foodName: '卵', quantityText: '2個' },
                        { foodName: 'しょうゆ', quantityText: '大さじ1' },
                        { foodName: 'サラダ油', quantityText: '小さじ2' }
                    ],
                    confidence: 0.9,
                    rawResponse: "ほうれん草のおひたし\n材料：ほうれん草1束、卵2個、しょうゆ大さじ1、サラダ油小さじ2"
                },
                processingTimeMs: 1500,
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // NutritionServiceのモック
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: {
                    calories: 250,
                    protein: 12,
                    fat: 6, // extended_nutrientsから移動
                    carbohydrate: 30, // extended_nutrientsから移動
                    dietary_fiber: 3.5, // extended_nutrientsから移動
                    sugar: 2, // extended_nutrientsから移動
                    iron: 2.5,
                    folic_acid: 100,
                    calcium: 120,
                    vitamin_d: 2,
                    confidence_score: 0.85,
                    // extended_nutrients は削除
                },
                reliability: {
                    confidence: 0.85,
                    balanceScore: 75,
                    completeness: 0.9
                },
                matchResults: [
                    { foodName: 'ほうれん草', matchedFood: { id: '4', name: 'ほうれん草' } },
                    { foodName: '卵', matchedFood: { id: '3', name: '鶏卵' } },
                    { foodName: 'しょうゆ', matchedFood: { id: '5', name: '醤油' } },
                    { foodName: 'サラダ油', matchedFood: { id: '6', name: 'サラダ油' } }
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

    it('正しいレシピURLの場合、標準化された栄養フォーマットでレスポンスを返すこと', async () => {
        // リクエストの準備
        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({
                url: 'https://example.com/recipe/12345'
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200); // ステータスコードを確認
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        expect(responseData.data.nutritionResult).toBeDefined();

        // レシピ情報の検証
        expect(responseData.data.recipe).toBeDefined();
        expect(responseData.data.recipe.ingredients).toHaveLength(4);

        // 標準化された栄養フォーマットの検証
        const nutrition = responseData.data.nutritionResult.perServing;
        expect(nutrition).toBeDefined();
        expect(nutrition.totalCalories).toBe(250); // 具体的な値を確認
        expect(nutrition.totalNutrients).toBeDefined();
        expect(nutrition.totalNutrients.length).toBeGreaterThan(0);
        expect(nutrition.foodItems).toBeDefined();

        // 1人前あたりの栄養価が計算されていることを確認
        expect(nutrition.totalCalories).toBe(250); // デフォルトservingsは1

        // totalNutrientsの各項目が正しいフォーマットであることを確認
        nutrition.totalNutrients.forEach((nutrient: any) => {
            expect(nutrient.name).toBeDefined();
            expect(typeof nutrient.value).toBe('number');
            expect(nutrient.unit).toBeDefined();
        });
    });

    it('後方互換性のためのlegacyNutritionフィールドが含まれていること', async () => {
        // リクエストの準備
        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({
                url: 'https://example.com/recipe/12345'
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // legacyNutritionフィールドの検証
        expect(response.status).toBe(200); // ステータスコードを確認
        expect(responseData.success).toBe(true);
        expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(250);
        expect(responseData.data.nutritionResult.legacyNutrition.protein).toBe(12);
        expect(responseData.data.nutritionResult.legacyNutrition.iron).toBe(2.5);
        expect(responseData.data.nutritionResult.legacyNutrition.folic_acid).toBe(100);
        expect(responseData.data.nutritionResult.legacyNutrition.fat).toBe(6);
        expect(responseData.data.nutritionResult.legacyNutrition.carbohydrate).toBe(30);

        // legacyPerServingフィールドの検証（1人前データ）
        expect(responseData.data.nutritionResult.legacyPerServing).toBeDefined();
        expect(responseData.data.nutritionResult.legacyPerServing.calories).toBe(250);
        expect(responseData.data.nutritionResult.legacyPerServing.protein).toBe(12);
        expect(responseData.data.nutritionResult.legacyPerServing.iron).toBe(2.5);
        expect(responseData.data.nutritionResult.legacyPerServing.fat).toBe(6);
        expect(responseData.data.nutritionResult.legacyPerServing.carbohydrate).toBe(30);
    });

    it('1人前あたりで正しく栄養計算されていること', async () => {
        // リクエストの準備
        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({
                url: 'https://example.com/recipe/12345'
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // 全体の栄養素と1人前の栄養素を確認
        expect(response.status).toBe(200); // ステータスコードを確認
        const standardizedNutrition = responseData.data.nutritionResult.nutrition;
        const perServingNutrition = responseData.data.nutritionResult.perServing;

        // 1人前と全体の栄養価が同じであることを確認（デフォルトservingsは1）
        expect(perServingNutrition.totalCalories).toBe(standardizedNutrition.totalCalories);

        // 栄養素が同じであることを確認
        const ironNutrientTotal = standardizedNutrition.totalNutrients.find((n: any) => n.name === 'iron');
        const ironNutrientPerServing = perServingNutrition.totalNutrients.find((n: any) => n.name === 'iron');
        expect(ironNutrientPerServing?.value).toBeCloseTo(ironNutrientTotal?.value || 0);

        const folicAcidNutrientTotal = standardizedNutrition.totalNutrients.find((n: any) => n.name === 'folic_acid');
        const folicAcidNutrientPerServing = perServingNutrition.totalNutrients.find((n: any) => n.name === 'folic_acid');
        expect(folicAcidNutrientPerServing?.value).toBeCloseTo(folicAcidNutrientTotal?.value || 0);
    });

    it('無効なURLの場合、適切なエラーレスポンスを返すこと', async () => {
        // AIServiceのモックをエラーを返すように設定
        const mockAIService = {
            analyzeRecipeText: jest.fn().mockResolvedValue({
                parseResult: {},
                processingTimeMs: 500, // エラー時も時間は返す想定
                error: 'URLが無効です'
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // リクエストの準備
        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({
                url: 'invalid-url'
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(500); // 内部エラーなので500
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        expect(responseData.error.code).toBe(ErrorCode.AI.ANALYSIS_ERROR);
    });

    it('食品が見つからない場合、適切なエラーレスポンスを返すこと', async () => {
        // AIServiceのモックを空の食品リストを返すように設定
        const mockAIService = {
            analyzeRecipeText: jest.fn().mockResolvedValue({
                parseResult: {
                    foods: [],
                    confidence: 0.5,
                    rawResponse: "レシピ情報がありません"
                },
                processingTimeMs: 1000,
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // リクエストの準備
        const mockRequest = new NextRequest('http://localhost/api/v2/recipe/parse', {
            method: 'POST',
            body: JSON.stringify({
                url: 'https://example.com/recipe/no-ingredients'
            })
        });

        // APIの呼び出し
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(400); // バリデーションエラーは400
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        expect(responseData.error.code).toBe(ErrorCode.Nutrition.FOOD_NOT_FOUND);
    });
}); 