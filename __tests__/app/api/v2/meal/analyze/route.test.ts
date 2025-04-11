import { NextRequest/*, NextResponse*/ } from 'next/server'; // Comment out unused NextResponse
import { POST } from '@/app/api/v2/meal/analyze/route';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory } from '@/lib/food/food-repository-factory';
import { AIServiceFactory } from '@/lib/ai/ai-service-factory';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { NutritionData, StandardizedMealNutrition, Nutrient } from '@/types/nutrition';
import { StandardApiResponse } from '@/types/api-interfaces';
import * as fs from 'fs';
import * as path from 'path';
// import { convertToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils'; // Comment out unused import

// モジュールモック
jest.mock('@/lib/ai/ai-service-factory');
jest.mock('@/lib/nutrition/nutrition-service-factory');
jest.mock('@/lib/food/food-repository-factory');

// Define types needed for the response data
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

interface AnalyzedFoodItem {
    foodName: string;
    quantityText: string;
    confidence?: number; // Based on AI mock
}

interface AnalyzeMealResponseData {
    foods: AnalyzedFoodItem[];
    nutritionResult: NutritionAnalysisResult;
}

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
    // Test image data (Base64)
    const fixturePath = path.join(process.cwd(), '__tests__/fixtures/test-image.png');
    if (fs.existsSync(fixturePath)) {
        const imageBuffer = fs.readFileSync(fixturePath);
        return imageBuffer.toString('base64');
    }
    // ファイルが存在しない場合は小さなプレースホルダー画像を使用
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

describe('食事分析API v2のテスト', () => {
    let TEST_IMAGE: string;

    // Common mock data for nutrition results
    const mockLegacyNutrition: NutritionData = {
        calories: 320, protein: 15, fat: 10, carbohydrate: 45, iron: 2.5,
        folic_acid: 100, calcium: 50, vitamin_d: 3, dietaryFiber: 5, salt: 1.2,
        confidence_score: 0.9
    };

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

    beforeAll(() => {
        TEST_IMAGE = loadTestImage();
    });

    // モックの設定
    beforeEach(() => {
        jest.clearAllMocks();

        // AIServiceFactory.getServiceをモック関数に置き換え
        const mockGetService = jest.fn();
        AIServiceFactory.getService = mockGetService;

        // NutritionServiceFactory.getInstanceをモック関数に置き換え
        const mockGetInstance = jest.fn();
        NutritionServiceFactory.getInstance = mockGetInstance;

        // FoodRepositoryFactory.getRepositoryをモック関数に置き換え
        const mockGetRepository = jest.fn();
        FoodRepositoryFactory.getRepository = mockGetRepository;
    });

    it('有効な食事テキスト入力でAPI呼び出しが成功すること', async () => {
        // モックの設定
        const mockAIService = {
            analyzeMealText: jest.fn().mockResolvedValue({
                foods: [{ foodName: '鶏肉', quantityText: '100g' }],
                confidence: 0.9,
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: mockStandardNutrition,
                reliability: { confidence: 0.9, balanceScore: 75, completeness: 0.95 },
                matchResults: [{ foodName: '鶏肉', matchedFood: { id: 'db-1', name: '鶏むね肉' } }]
            })
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        const mockFoodRepo = {};
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepo);

        // リクエストの作成
        const mockRequest = createMockNextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                text: '鶏肉 100g'
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<AnalyzeMealResponseData> = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        expect(responseData.data?.foods?.[0]?.foodName).toBe('鶏肉');
        expect(responseData.data?.nutritionResult?.nutrition?.totalCalories).toBe(320);
    });

    it('有効な食事画像入力でAPI呼び出しが成功すること', async () => {
        // モックの設定
        const mockAIService = {
            analyzeMealImage: jest.fn().mockResolvedValue({
                foods: [{ foodName: '鶏肉', quantityText: '100g' }],
                confidence: 0.9,
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: mockStandardNutrition,
                reliability: { confidence: 0.9, balanceScore: 75, completeness: 0.95 },
                matchResults: [{ foodName: '鶏肉', matchedFood: { id: 'db-1', name: '鶏むね肉' } }]
            })
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        const mockFoodRepo = {};
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepo);

        // リクエストの作成
        const mockRequest = createMockNextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                image: TEST_IMAGE
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<AnalyzeMealResponseData> = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        expect(responseData.data?.foods?.[0]?.foodName).toBe('鶏肉');
        expect(responseData.data?.nutritionResult?.nutrition?.totalCalories).toBe(320);
    });

    it('後方互換性のためのlegacyNutritionフィールドが含まれていること', async () => {
        // レガシーデータ
        const mockAIService = {
            analyzeMealText: jest.fn().mockResolvedValue({
                foods: [{ foodName: '鶏むね肉', quantityText: '100g' }],
                confidence: 0.9,
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: mockStandardNutrition,
                reliability: { confidence: 0.9 },
                matchResults: [{ foodName: '鶏むね肉', matchedFood: { id: 'db-1', name: '鶏むね肉' } }]
            })
        };
        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        const mockRequest = createMockNextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                image: TEST_IMAGE
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<AnalyzeMealResponseData> = await response.json();

        // legacyNutritionフィールドの検証
        expect(response.status).toBe(200);
        if (responseData.data) {
            expect(responseData.data.nutritionResult).toBeDefined();
            expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
            expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(320);
            expect(responseData.data.nutritionResult.legacyNutrition.protein).toBe(15);
            expect(responseData.data.nutritionResult.legacyNutrition.iron).toBe(2);
        }
    });

    it('空の食品リストの場合、適切なレスポンスを返すこと', async () => {
        // 空の結果を返すモック
        const emptyStandardNutrition: StandardizedMealNutrition = {
            totalCalories: 0,
            totalNutrients: [],
            foodItems: [],
            reliability: { confidence: 0.5, balanceScore: 0, completeness: 0 }
        };

        // モックサービスの設定
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: emptyStandardNutrition,
                reliability: { confidence: 0.5 },
                matchResults: []
            })
        };

        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        const mockRequest = createMockNextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                image: TEST_IMAGE
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<AnalyzeMealResponseData> = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        if (responseData.data) {
            expect(responseData.data.foods).toHaveLength(0);
            expect(responseData.data.nutritionResult.nutrition.totalCalories).toBe(0);
            expect(responseData.data.nutritionResult.nutrition.totalNutrients).toHaveLength(0);
        }
    });

    it('無効なデータが送信された場合、適切なエラーレスポンスを返すこと', async () => {
        // text も image も含まないリクエスト
        const mockRequest = createMockNextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({ mealType: 'lunch' }), // text と image を含まない
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<null> = await response.json();

        expect(response.status).toBe(400); // 400 Bad Request
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        // 検証エラーのコードを確認
        if (responseData.error) {
            expect(responseData.error.code).toBe(ErrorCode.Base.DATA_VALIDATION_ERROR);
        }
    });

    it('NutritionServiceでエラーが発生した場合、適切なエラーレスポンスを返すこと', async () => {
        // AI サービスは正常なレスポンスを返す
        const mockAIService = {
            analyzeMealText: jest.fn().mockResolvedValue({
                foods: [{ foodName: '鶏むね肉', quantityText: '100g' }],
                confidence: 0.9,
                error: null
            })
        };
        (AIServiceFactory.getService as jest.Mock).mockReturnValue(mockAIService);

        // NutritionServiceがエラーをスローするようにモック
        const errorMessage = '計算中に内部エラー発生';
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockRejectedValue({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: errorMessage,
                details: { detail: 'DB connection failed' }
            })
        };

        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        const mockRequest = createMockNextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({ image: TEST_IMAGE }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} });
        const responseData: StandardApiResponse<null> = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(500); // 内部エラーなので500
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();

        // responseData.errorの存在確認後にプロパティにアクセスする
        if (responseData.error) {
            expect(responseData.error.message).toBeDefined();
        }
    });
}); 