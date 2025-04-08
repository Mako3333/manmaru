import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/v2/meal/analyze/route';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory } from '@/lib/food/food-repository-factory';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { NutritionData, StandardizedMealNutrition, Nutrient } from '@/types/nutrition';
import { StandardApiResponse } from '@/types/api-interfaces';
import * as fs from 'fs';
import * as path from 'path';
import { convertToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';

// モックの設定
jest.mock('@/lib/nutrition/nutrition-service-factory');
jest.mock('@/lib/food/food-repository-factory');

// テスト用の画像を読み込む関数
function loadTestImage(): string {
    const imagePath = path.resolve(process.cwd(), 'public/test_image.jpg');
    const imageBuffer = fs.readFileSync(imagePath);
    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
}

describe('食事分析API v2のテスト', () => {
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

    it('正しいリクエストの場合、StandardizedMealNutritionフォーマットでレスポンスを返すこと', async () => {
        // レガシーデータ（NutritionData形式）の準備
        const mockLegacyNutrition: NutritionData = {
            calories: 320,
            protein: 15,
            fat: 10,
            carbohydrate: 45,
            iron: 2.5,
            folic_acid: 100,
            calcium: 50,
            vitamin_d: 3,
            dietaryFiber: 5,
            salt: 1.2,
            confidence_score: 0.9
        };

        // エネルギーや鉄分などの栄養素データをNutrient配列に変換
        const nutrientsList: Nutrient[] = [
            { name: 'エネルギー', value: 320, unit: 'kcal' },
            { name: 'たんぱく質', value: 15, unit: 'g' },
            { name: '脂質', value: 10, unit: 'g' },
            { name: '炭水化物', value: 45, unit: 'g' },
            { name: '鉄', value: 2.5, unit: 'mg' },
            { name: '葉酸', value: 100, unit: 'mcg' },
            { name: 'カルシウム', value: 50, unit: 'mg' },
            { name: 'ビタミンD', value: 3, unit: 'mcg' },
            { name: '食物繊維', value: 5, unit: 'g' },
            { name: '食塩相当量', value: 1.2, unit: 'g' },
        ];

        // StandardizedMealNutrition型に合わせたテストデータ
        const mockStandardNutrition: StandardizedMealNutrition = {
            totalCalories: 320,
            totalNutrients: [
                { name: 'エネルギー', value: 320, unit: 'kcal' },
                { name: 'タンパク質', value: 15, unit: 'g' },
                { name: '鉄分', value: 2, unit: 'mg' }
            ],
            foodItems: [
                {
                    id: '1',
                    name: 'ごはん',
                    amount: 150,
                    unit: 'g',
                    nutrition: {
                        calories: 240,
                        nutrients: [{ name: 'エネルギー', value: 240, unit: 'kcal' }],
                        servingSize: { value: 150, unit: 'g' }
                    }
                },
                {
                    id: '2',
                    name: '味噌汁',
                    amount: 1,
                    unit: '杯',
                    nutrition: {
                        calories: 80,
                        nutrients: [{ name: 'エネルギー', value: 80, unit: 'kcal' }],
                        servingSize: { value: 1, unit: '杯' }
                    }
                }
            ],
            pregnancySpecific: {
                folatePercentage: 25,  // 葉酸充足率
                ironPercentage: 15,    // 鉄分充足率
                calciumPercentage: 5   // カルシウム充足率
            },
            reliability: {
                confidence: 0.9,
                balanceScore: 75,
                completeness: 0.95
            }
        };

        // NutritionServiceのモック
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: mockStandardNutrition,
                reliability: {
                    confidence: 0.9,
                    balanceScore: 75,
                    completeness: 0.95
                },
                matchResults: [
                    { foodName: 'ごはん', matchedFood: { id: '1', name: 'ごはん（精白米）' } },
                    { foodName: '味噌汁', matchedFood: { id: '2', name: '味噌汁' } }
                ],
            })
        };

        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        // FoodRepositoryのモック
        const mockFoodRepo = {};
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepo);

        // リクエストの作成
        const mockRequest = new NextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                image: TEST_IMAGE,
                mealType: 'lunch'
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
        expect(responseData.data.nutritionResult).toBeDefined();

        // 標準化されたフォーマットの検証
        expect(responseData.data.nutritionResult.nutrition).toBeDefined();
        expect(responseData.data.nutritionResult.nutrition.totalCalories).toBeDefined();
        expect(responseData.data.nutritionResult.nutrition.totalNutrients).toBeDefined();
        expect(responseData.data.nutritionResult.nutrition.foodItems).toBeDefined();

        // nutrientがArrayInstanceかをチェック
        expect(Array.isArray(responseData.data.nutritionResult.nutrition.totalNutrients)).toBe(true);

        // 特定の栄養素が含まれているかチェック
        const nutrients = responseData.data.nutritionResult.nutrition.totalNutrients;
        expect(nutrients.some((n: Nutrient) => n.name === 'エネルギー')).toBe(true);
        expect(nutrients.some((n: Nutrient) => n.name === '鉄分')).toBe(true);

        // 妊婦向け情報が含まれているか
        expect(responseData.data.nutritionResult.nutrition.pregnancySpecific).toBeDefined();
    });

    it('後方互換性のためのlegacyNutritionフィールドが含まれていること', async () => {
        // レガシーデータ
        const mockLegacyNutrition: NutritionData = {
            calories: 320,
            protein: 15,
            iron: 2,
            folic_acid: 100,
            calcium: 50,
            vitamin_d: 3,
            confidence_score: 0.9
        };

        // StandardizedMealNutrition型のデータ
        const mockStandardNutrition: StandardizedMealNutrition = {
            totalCalories: 320,
            totalNutrients: [
                { name: 'エネルギー', value: 320, unit: 'kcal' },
                { name: 'タンパク質', value: 15, unit: 'g' },
                { name: '鉄分', value: 2, unit: 'mg' }
            ],
            foodItems: [],
            pregnancySpecific: {
                folatePercentage: 25,
                ironPercentage: 15,
                calciumPercentage: 5
            },
            reliability: {
                confidence: 0.9,
                balanceScore: 75,
                completeness: 0.9
            }
        };

        // モックサービスの設定
        const mockNutritionService = {
            calculateNutritionFromNameQuantities: jest.fn().mockResolvedValue({
                nutrition: mockStandardNutrition,
                reliability: {
                    confidence: 0.9,
                    balanceScore: 75,
                    completeness: 0.9
                }
            })
        };

        const mockNutritionServiceFactory = {
            createService: jest.fn().mockReturnValue(mockNutritionService)
        };
        (NutritionServiceFactory.getInstance as jest.Mock).mockReturnValue(mockNutritionServiceFactory);

        const mockRequest = new NextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                image: TEST_IMAGE
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<any> = await response.json();

        // legacyNutritionフィールドの検証
        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        expect(responseData.data.nutritionResult).toBeDefined();
        expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(320);
        expect(responseData.data.nutritionResult.legacyNutrition.protein).toBe(15);
        expect(responseData.data.nutritionResult.legacyNutrition.iron).toBe(2);
    });

    it('空の食品リストの場合、適切なレスポンスを返すこと', async () => {
        // 空の結果を返すモック
        const emptyStandardNutrition: StandardizedMealNutrition = {
            totalCalories: 0,
            totalNutrients: [],
            foodItems: [],
            reliability: { confidence: 0.5 }
        };

        const emptyLegacyNutrition: NutritionData = {
            calories: 0,
            protein: 0,
            iron: 0,
            folic_acid: 0,
            calcium: 0,
            vitamin_d: 0,
            confidence_score: 0.5
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

        const mockRequest = new NextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                image: TEST_IMAGE
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<any> = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.data).toBeDefined();
        expect(responseData.data.nutritionResult).toBeDefined();
        expect(responseData.data.nutritionResult.nutrition).toBeDefined();
        expect(responseData.data.nutritionResult.nutrition.foodItems).toHaveLength(0);
        expect(responseData.data.nutritionResult.legacyNutrition).toBeDefined();
        expect(responseData.data.nutritionResult.legacyNutrition.calories).toBe(0);
    });

    it('無効なリクエスト形式の場合、適切なエラーレスポンスを返すこと', async () => {
        // リクエストボディから必須の 'image' を削除
        const mockRequest = new NextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({
                mealType: 'dinner',
                // image: TEST_IMAGE // image がない
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} } as any);
        const responseData: StandardApiResponse<null> = await response.json();

        // 実際のレスポンスをログ出力
        console.log('無効なリクエスト形式の場合のレスポンス:', JSON.stringify(responseData, null, 2));

        // 元の期待値（ステータスコード400、正しいエラーコード）に戻す
        expect(response.status).toBe(400);
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();

        // responseData.errorの存在確認後にプロパティにアクセスする
        if (responseData.error) {
            expect(responseData.error.code).toBe(ErrorCode.Base.DATA_VALIDATION_ERROR);
            expect(responseData.error.message).toContain('入力データが無効です');
            if (responseData.error.details && typeof responseData.error.details === 'object') {
                // details.reason が存在し、文字列であることを確認してから toContain を使用
                if ('reason' in responseData.error.details && typeof responseData.error.details.reason === 'string') {
                    expect(responseData.error.details.reason).toContain('image');
                }
            }
        }
    });

    it('NutritionServiceでエラーが発生した場合、適切なエラーレスポンスを返すこと', async () => {
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

        const mockRequest = new NextRequest('http://localhost/api/v2/meal/analyze', {
            method: 'POST',
            body: JSON.stringify({ image: TEST_IMAGE }),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockRequest, { params: {} } as any);
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