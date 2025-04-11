import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v2/meal/analyze/route';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory'; // Import FoodRepositoryFactory and Type
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { NutritionData, StandardizedMealNutrition, Nutrient } from '@/types/nutrition'; // Import necessary types
import { StandardApiResponse } from '@/types/api-interfaces';
import * as fs from 'fs';
import * as path from 'path';

// Define types needed for the response data
interface AnalyzedFoodItem {
    foodName: string;
    quantityText: string;
    confidence?: number; // Based on AI mock
}

interface NutritionAnalysisResult {
    nutrition: StandardizedMealNutrition;
    legacyNutrition: NutritionData; // Based on assertions
    reliability: { // Based on mocks and assertions
        confidence: number;
        balanceScore?: number; // Optional based on different mocks
        completeness?: number; // Optional based on different mocks
    };
    matchResults?: { // Based on mock, might be optional
        foodName: string;
        matchedFood: { id: string; name: string };
    }[];
}

interface AnalyzeImageResponseData {
    foods: AnalyzedFoodItem[];
    nutritionResult: NutritionAnalysisResult;
}

// モジュールモック
jest.mock('@/lib/ai/ai-service-factory');
jest.mock('@/lib/nutrition/nutrition-service-factory');
jest.mock('@/lib/food/food-repository-factory');

// NextRequestのモックヘルパー関数
function createMockNextRequest(url: string, options: RequestInit) {
    // ネイティブのRequestオブジェクトを作成し、NextRequestにラップする
    const request = new Request(url, options);
    // NextRequestのprototypeを使用して新しいオブジェクトを作成
    const mockNextRequest = Object.create(NextRequest.prototype);
    // 元のRequestの必要なプロパティを移行
    Object.defineProperties(mockNextRequest, {
        url: {
            get() { return request.url; }
        },
        method: {
            get() { return request.method; }
        },
        headers: {
            get() { return request.headers; }
        },
        body: {
            get() { return request.body; }
        },
        bodyUsed: {
            get() { return request.bodyUsed; }
        },
        json: {
            value: () => request.json()
        },
        text: {
            value: () => request.text()
        }
    });
    return mockNextRequest;
}

function loadTestImage(): string {
    // テスト用画像データ (Base64)
    const fixturePath = path.join(process.cwd(), '__tests__/fixtures/test-image.png');
    if (fs.existsSync(fixturePath)) {
        const imageBuffer = fs.readFileSync(fixturePath);
        return imageBuffer.toString('base64');
    }
    // ファイルがない場合は小さなプレースホルダー
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

// テスト用MockデータとMethods
describe('画像分析API v2のテスト', () => {
    let TEST_IMAGE: string;

    beforeAll(() => {
        TEST_IMAGE = loadTestImage();
    });

    // モックの設定
    beforeEach(() => {
        jest.clearAllMocks();

        // AIServiceFactoryのモック設定を修正
        AIServiceFactory.getService = jest.fn();

        // NutritionServiceFactoryのモック設定を修正
        NutritionServiceFactory.getInstance = jest.fn();

        // FoodRepositoryFactoryのモック設定を修正
        FoodRepositoryFactory.getRepository = jest.fn();
    });

    // テスト用の標準化された栄養データ
    const mockStandardNutrition: StandardizedMealNutrition = {
        totalCalories: 320,
        totalNutrients: [
            { name: 'タンパク質', value: 15, unit: 'g' },
            { name: '鉄分', value: 2, unit: 'mg' }
        ],
        foodItems: [
            { id: 'chicken', name: '鶏肉', amount: 100, unit: 'g', nutrition: { calories: 100, nutrients: [], servingSize: { value: 100, unit: 'g' } } }
        ],
        reliability: { confidence: 0.85, balanceScore: 70, completeness: 0.9 }
    };

    it('有効な画像データで正常なレスポンスを返すこと', async () => {
        // AIサービスのモック設定
        const mockAIService = {
            analyzeMealImage: jest.fn().mockResolvedValue({
                foods: [
                    { foodName: '解析された食品1', quantityText: '100g' },
                    { foodName: '解析された食品2', quantityText: '1枚' }
                ],
                confidence: 0.85,
                estimatedNutrition: null,
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // NutritionServiceのモック
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: mockStandardNutrition,
                reliability: { confidence: 0.85, balanceScore: 70, completeness: 0.9 },
                matchResults: [
                    { foodName: '解析された食品1', matchedFood: { id: 'db-1', name: '食品DBの食品1' } },
                    { foodName: '解析された食品2', matchedFood: { id: 'db-2', name: '食品DBの食品2' } }
                ]
            })
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // FoodRepositoryのモック (NutritionServiceFactory.createService needs it)
        const mockFoodRepo = {};
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepo);

        // リクエストの作成
        const mockRequest = createMockNextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                image: TEST_IMAGE, // Use 'image' key as defined in route schema
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<AnalyzeImageResponseData> = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        if (responseData.data) {
            expect(responseData.data.foods).toBeDefined(); // Check parsed foods from AI
            expect(responseData.data.foods).toHaveLength(2);
            if (responseData.data.foods && responseData.data.foods.length > 0) {
                expect(responseData.data?.foods[0]?.foodName).toBe('解析された食品1'); // Use Optional Chaining
            }

            // 栄養データの検証
            expect(responseData.data.nutritionResult).toBeDefined();
            expect(responseData.data.nutritionResult.nutrition).toBeDefined(); // Standardized nutrition
            expect(responseData.data.nutritionResult.nutrition.totalCalories).toBe(320);
            expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined(); // Legacy nutrition
            expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(320);
            expect(responseData.data.nutritionResult.reliability).toBeDefined();
        }
    });

    it('後方互換性のためのlegacyNutritionフィールドが含まれていること', async () => {
        // AIサービスが食品リストを返すようにモック (ルートハンドラが期待する形式に修正)
        const mockAIService = {
            analyzeMealImage: jest.fn().mockResolvedValue({
                foods: [{ foodName: '解析された食品1', quantityText: '100g' }], // parseResult のネストを解除
                confidence: 0.85,
                estimatedNutrition: null,
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // NutritionServiceのモックを設定 (StandardizedMealNutrition を返すように修正)
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: mockStandardNutrition, // ★ StandardizedMealNutrition を返す
                reliability: { confidence: 0.85, balanceScore: 70, completeness: 0.9 },
                matchResults: [{ foodName: '解析された食品1', matchedFood: { id: 'db-1', name: '食品DBの食品1' } }],
            })
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // FoodRepositoryのモック
        const mockFoodRepo = {};
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepo);

        const mockRequest = createMockNextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                image: TEST_IMAGE // Use 'image' key
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<AnalyzeImageResponseData> = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        if (responseData.data) {
            expect(responseData.data.nutritionResult).toBeDefined();
            expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
            expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(320);
            expect(responseData.data.nutritionResult.legacyNutrition.protein).toBe(15);
        }
    });

    it('無効な画像データの場合、適切なエラーレスポンスを返すこと', async () => {
        // リクエストボディのキーをルートのスキーマに合わせる ('image')
        const invalidImageData = 'not-a-base64-string';
        const mockRequest = createMockNextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                image: invalidImageData // Use 'image' key
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<null> = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(400);
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        if (responseData.error) {
            // The route throws INVALID_IMAGE error *before* Zod validation if it's not base64
            expect(responseData.error.code).toBe(ErrorCode.File.INVALID_IMAGE);
            expect(responseData.error.message).toBe('画像が無効です。別の画像をお試しください。');
        }
    });

    it('リクエストボディの形式が不正な場合 (imageがない)、適切なエラーレスポンスを返すこと', async () => {
        // image フィールドを含まないリクエスト
        const mockRequest = createMockNextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                mealType: 'lunch' // Missing 'image' field
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<null> = await response.json();

        // エラーレスポンスの検証 (Zod Validation Error)
        expect(response.status).toBe(400); // Expect Bad Request for validation error
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        if (responseData.error) {
            expect(responseData.error.code).toBe(ErrorCode.Base.DATA_VALIDATION_ERROR);
            expect(responseData.error.message).toContain('入力データが無効です');
            // Check if the reason includes mention of the 'image' field
            if (responseData.error.details && typeof responseData.error.details === 'object' && 'reason' in responseData.error.details && typeof responseData.error.details.reason === 'string') {
                expect(responseData.error.details.reason).toMatch(/image/i); // Check if 'image' is mentioned
            }
        }
    });


    it('AIサービスでエラーが発生した場合、適切なエラーレスポンスを返すこと', async () => {
        // AIサービスがエラーを返すようにモック
        const mockAIService = {
            analyzeMealImage: jest.fn().mockResolvedValue({
                parseResult: null,
                error: 'AI analysis failed deliberately for test' // Simulate AI error
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // NutritionServiceのモックは呼ばれないはずだが念のため定義
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn() // Should not be called
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // FoodRepositoryのモック
        const mockFoodRepo = {};
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepo);


        const mockRequest = createMockNextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({ image: TEST_IMAGE }), // Use 'image' key
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<null> = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(500); // Expect Internal Server Error
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        if (responseData.error) {
            // The route throws IMAGE_PROCESSING_ERROR when aiService returns an error
            expect(responseData.error.code).toBe(ErrorCode.AI.IMAGE_PROCESSING_ERROR);
            expect(responseData.error.message).toBe('画像処理中にエラーが発生しました。');
        }
    });
});