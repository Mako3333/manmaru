import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v2/image/analyze/route';
import { FoodRepositoryFactory } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { NutritionData, StandardizedMealNutrition } from '@/types/nutrition';
import { StandardApiResponse } from '@/types/api-interfaces';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('@/lib/food/food-repository-factory');
jest.mock('@/lib/nutrition/nutrition-service-factory');

// テスト用の画像を読み込む関数
function loadTestImage(): string {
    const imagePath = path.resolve(process.cwd(), 'public/test_image.jpg');
    const imageBuffer = fs.readFileSync(imagePath);
    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
}

describe('画像分析API v2のテスト', () => {
    let TEST_IMAGE: string;

    beforeAll(() => {
        // テスト画像を一度だけ読み込む
        try {
            TEST_IMAGE = loadTestImage();
        } catch (error) {
            console.error('テスト画像の読み込みに失敗しました:', error);
            TEST_IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//gA7Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2NjIpLCBxdWFsaXR5ID0gOTAK/9sAQwADAgIDAgIDAwMDBAMDBAUIBQUEBAUKBwcGCAwKDAwLCgsLDQ4SEA0OEQ4LCxAWEBETFBUVFQwPFxgWFBgSFBUU/9sAQwEDAwMFBQUFBAQGDAQEDg0PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8P/8AAEQgAEgASAwERAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A+4KACgAoAKACgAoAKACgAoAKACgAoAKACgD/2Q=='; // フォールバック小さなダミー画像
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('有効な画像データで正常なレスポンスを返すこと', async () => {
        // 認識される食べ物のモックデータ
        const mockFoods = [
            { name: 'サラダ', confidence: 0.95 },
            { name: 'パスタ', confidence: 0.85 }
        ];

        // 栄養計算の結果のモックデータ
        const mockLegacyNutrition: NutritionData = {
            calories: 320,
            protein: 15,
            iron: 2.5,
            folic_acid: 100,
            calcium: 50,
            vitamin_d: 3,
            confidence_score: 0.9
        };

        const mockStandardizedNutrition: StandardizedMealNutrition = {
            totalCalories: 320,
            totalNutrients: [
                { name: 'エネルギー', value: 320, unit: 'kcal' },
                { name: 'たんぱく質', value: 15, unit: 'g' },
                { name: '鉄', value: 2.5, unit: 'mg' },
                { name: '葉酸', value: 100, unit: 'mcg' }
            ],
            foodItems: [
                {
                    id: '1',
                    name: 'サラダ',
                    amount: 100,
                    unit: 'g',
                    nutrition: {
                        calories: 120,
                        nutrients: [{ name: 'エネルギー', value: 120, unit: 'kcal' }],
                        servingSize: { value: 100, unit: 'g' }
                    }
                },
                {
                    id: '2',
                    name: 'パスタ',
                    amount: 200,
                    unit: 'g',
                    nutrition: {
                        calories: 200,
                        nutrients: [{ name: 'エネルギー', value: 200, unit: 'kcal' }],
                        servingSize: { value: 200, unit: 'g' }
                    }
                }
            ],
            pregnancySpecific: {
                folatePercentage: 25,
                ironPercentage: 15,
                calciumPercentage: 5
            }
        };

        // AIサービスとFoodRepositoryのモック
        const mockVisionService = {
            recognizeFoodsInImage: jest.fn().mockResolvedValue({
                foods: mockFoods,
                reliability: { confidence: 0.9 }
            })
        };

        const mockAiServiceFactory = {
            createVisionService: jest.fn().mockReturnValue(mockVisionService)
        };

        const mockNutritionService = {
            calculateNutritionFromFoods: jest.fn().mockResolvedValue({
                nutrition: mockLegacyNutrition,
                standardizedNutrition: mockStandardizedNutrition,
                reliability: {
                    confidence: 0.9,
                    balanceScore: 75,
                    completeness: 0.95
                }
            })
        };

        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };

        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue({});
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // リクエストの作成
        const mockRequest = new NextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: TEST_IMAGE,
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
        expect(responseData.data.foods).toBeDefined();
        expect(responseData.data.foods).toHaveLength(2);
        expect(responseData.data.foods[0].name).toBe('サラダ');

        // 栄養データの検証
        expect(responseData.data.nutritionResult).toBeDefined();
        expect(responseData.data.nutritionResult.nutrition).toBeDefined();
        expect(responseData.data.nutritionResult.nutrition.totalCalories).toBe(320);

        // レガシーフォーマットの栄養データも含まれていることを確認
        expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(320);
    });

    it('後方互換性のためのlegacyNutritionフィールドが含まれていること', async () => {
        // モックデータ
        const mockFoods = [{ name: 'りんご', confidence: 0.99 }];
        const mockLegacyNutrition: NutritionData = {
            calories: 80,
            protein: 0.4,
            iron: 0.2,
            folic_acid: 5,
            calcium: 10,
            vitamin_d: 0,
            confidence_score: 0.95
        };

        const mockStandardizedNutrition: StandardizedMealNutrition = {
            totalCalories: 80,
            totalNutrients: [
                { name: 'エネルギー', value: 80, unit: 'kcal' }
            ],
            foodItems: [
                {
                    id: '3',
                    name: 'りんご',
                    amount: 1,
                    unit: '個',
                    nutrition: {
                        calories: 80,
                        nutrients: [{ name: 'エネルギー', value: 80, unit: 'kcal' }],
                        servingSize: { value: 1, unit: '個' }
                    }
                }
            ],
            pregnancySpecific: {
                folatePercentage: 1,
                ironPercentage: 1,
                calciumPercentage: 1
            }
        };

        // AIサービスとFoodRepositoryのモック
        const mockVisionService = {
            recognizeFoodsInImage: jest.fn().mockResolvedValue({
                foods: mockFoods,
                reliability: { confidence: 0.99 }
            })
        };

        const mockAiServiceFactory = {
            createVisionService: jest.fn().mockReturnValue(mockVisionService)
        };

        const mockNutritionService = {
            calculateNutritionFromFoods: jest.fn().mockResolvedValue({
                nutrition: mockLegacyNutrition,
                standardizedNutrition: mockStandardizedNutrition,
                reliability: {
                    confidence: 0.95,
                    balanceScore: 60,
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
        const mockRequest = new NextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: TEST_IMAGE
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<any> = await response.json();

        // レスポンスの検証
        expect(response.status).toBe(200);
        expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(80);
        expect(responseData.data.nutritionResult.legacyNutrition.protein).toBe(0.4);
    });

    it('無効な画像データの場合、適切なエラーレスポンスを返すこと', async () => {
        // 無効な画像データでリクエスト
        const mockRequest = new NextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'invalid-base64-data'
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
            expect(responseData.error.code).toBe(ErrorCode.File.INVALID_IMAGE);
            expect(responseData.error.message).toBeDefined();
        }
    });

    it('AIサービスでエラーが発生した場合、適切なエラーレスポンスを返すこと', async () => {
        // エラーをスローするAIサービスモック
        const mockVisionService = {
            recognizeFoodsInImage: jest.fn().mockRejectedValue({
                code: ErrorCode.AI.IMAGE_PROCESSING_ERROR,
                message: '画像認識時にエラーが発生しました'
            })
        };

        const mockAiServiceFactory = {
            createVisionService: jest.fn().mockReturnValue(mockVisionService)
        };

        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue({});
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue({
            createService: jest.fn().mockReturnValue({})
        });

        // リクエストの作成
        const mockRequest = new NextRequest('http://localhost/api/v2/image/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: TEST_IMAGE
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        // APIの実行
        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<null> = await response.json();

        // エラーレスポンスの検証
        expect(response.status).toBe(500);
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
        if (responseData.error) {
            expect(responseData.error.message).toBeDefined();
        }
    });
}); 