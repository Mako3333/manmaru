import { NutritionServiceImpl } from '@/lib/nutrition/nutrition-service-impl';
import { FoodRepository } from '@/lib/food/food-repository';
import { FoodMatchingService } from '@/lib/food/food-matching-service';
import { QuantityParser } from '@/lib/nutrition/quantity-parser';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';
import { FoodAnalysisResult } from '@/types/ai';
import { Food, FoodMatchResult, FoodQuantity, MealFoodItem } from '@/types/food';
import { NutritionCalculationResult, NutritionData } from '@/types/nutrition';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';

// --- モックの設定 ---

// モック関数を先に定義
const mockParseQuantity = jest.fn();
const mockConvertToGrams = jest.fn();

// FoodMatchingService のモック
const mockMatchFoods = jest.fn();
jest.mock('@/lib/food/food-matching-service', () => ({
    FoodMatchingService: jest.fn().mockImplementation(() => ({
        matchFoods: mockMatchFoods,
    })),
}));

// QuantityParser の静的メソッドのモック
// jest.mock の中で定義済みのモック関数を参照するようにする
jest.mock('@/lib/nutrition/quantity-parser', () => ({
    QuantityParser: {
        parseQuantity: mockParseQuantity, // ここで初期化済みの mockParseQuantity を使用
        convertToGrams: mockConvertToGrams, // ここで初期化済みの mockConvertToGrams を使用
    },
}));

// FoodRepository のモック (コンストラクタで必要)
jest.mock('@/lib/food/food-repository');
const mockFoodRepository = {} as FoodRepository; // 中身は必要に応じて追加

// --- テスト本体 ---
describe('NutritionServiceImpl', () => {
    let nutritionService: NutritionServiceImpl;
    let mockFoodMatchingServiceInstance: FoodMatchingService;

    beforeEach(() => {
        // 各テストの前にモックをリセット
        jest.clearAllMocks();

        // モックインスタンスを取得 (コンストラクタに渡すため)
        // FoodMatchingService のモック実装からインスタンスを取得する方法を見直す必要があるかもしれません
        // jest.mock の実装によっては、直接 FoodMatchingService を new できない
        // ここでは仮のモックオブジェクトを使用
        mockFoodMatchingServiceInstance = {
            matchFoods: mockMatchFoods
        } as unknown as FoodMatchingService; // 型アサーションで一時対応

        nutritionService = new NutritionServiceImpl(
            mockFoodRepository,
            mockFoodMatchingServiceInstance
        );

        // デフォルトのモック動作を設定 (必要に応じて各テストで上書き)
        mockParseQuantity.mockReturnValue({ quantity: { value: 100, unit: 'g' }, confidence: 1.0 });
        mockConvertToGrams.mockReturnValue({ grams: 100, confidence: 1.0 });

        // calculateNutrition は内部メソッドなので spyOn を使うことが多いが、
        // ここでは結果だけモックする例を示す
        jest.spyOn(nutritionService, 'calculateNutrition').mockResolvedValue({
            nutrition: { calories: 500, protein: 20, iron: 5, /* ...他の栄養素 */ } as NutritionData,
            reliability: { confidence: 0.9, balanceScore: 70, completeness: 0.8 },
            matchResults: [], // calculateNutritionのテストではないので省略
        });
    });

    // --- テストケース ---

    it('正常系: 複数の食品が正常に処理されること', async () => {
        // --- Arrange ---
        const parsedFoods: FoodInputParseResult[] = [
            { foodName: 'ごはん', quantityText: '1膳', confidence: 0.9 },
            { foodName: '味噌汁', quantityText: '1杯', confidence: 0.9 },
        ];

        // モック: FoodMatchingService.matchFoods
        const food1: Food = {
            id: 'f1', name: 'ごはん', category: '主食', calories: 168, protein: 2.5, iron: 0.1, confidence: 0.9,
            aliases: ['白米'],
            standard_quantity: "150g",
            folic_acid: 3,
            calcium: 3,
            vitamin_d: 0
        };
        const food2: Food = {
            id: 'f2', name: '味噌汁（豆腐・わかめ）', category: '汁物', calories: 40, protein: 2.0, iron: 0.5, confidence: 0.8,
            aliases: [],
            standard_quantity: "180g",
            folic_acid: 15,
            calcium: 20,
            vitamin_d: 0.1
        };
        const matchMap = new Map<string, FoodMatchResult | null>([
            ['ごはん', { food: food1, similarity: 0.95, originalInput: 'ごはん', matchedFood: food1, confidence: 0.95, inputName: 'ごはん' }],
            ['味噌汁', { food: food2, similarity: 0.85, originalInput: '味噌汁', matchedFood: food2, confidence: 0.85, inputName: '味噌汁' }],
        ]);
        mockMatchFoods.mockResolvedValue(matchMap);

        // モック: QuantityParser (デフォルト動作で良いが、念のため明示的に設定)
        mockParseQuantity
            .mockReturnValueOnce({ quantity: { value: 1, unit: '膳' }, confidence: 0.9 }) // ごはん
            .mockReturnValueOnce({ quantity: { value: 1, unit: '杯' }, confidence: 0.9 }); // 味噌汁
        mockConvertToGrams
            .mockReturnValueOnce({ grams: 150, confidence: 0.95 }) // ごはん
            .mockReturnValueOnce({ grams: 180, confidence: 0.9 }); // 味噌汁

        // モック: calculateNutrition (beforeEach で設定済み)
        const mockNutritionResult: NutritionCalculationResult = {
            nutrition: { calories: 300, protein: 10, iron: 2, folic_acid: 50, calcium: 30, vitamin_d: 1, confidence_score: 0.88 } as NutritionData,
            reliability: { confidence: 0.88, balanceScore: 75, completeness: 0.9 },
            matchResults: [],
        };
        jest.spyOn(nutritionService, 'calculateNutrition').mockResolvedValue(mockNutritionResult);


        // --- Act ---
        const result = await nutritionService.processParsedFoods(parsedFoods);

        // --- Assert ---
        // 1. 依存メソッドが期待通り呼び出されたか
        expect(mockMatchFoods).toHaveBeenCalledWith(['ごはん', '味噌汁']);
        expect(mockParseQuantity).toHaveBeenCalledTimes(2);
        expect(mockParseQuantity).toHaveBeenCalledWith('1膳', 'ごはん', '主食');
        expect(mockParseQuantity).toHaveBeenCalledWith('1杯', '味噌汁（豆腐・わかめ）', '汁物');
        expect(mockConvertToGrams).toHaveBeenCalledTimes(2);
        expect(mockConvertToGrams).toHaveBeenCalledWith({ value: 1, unit: '膳' }, 'ごはん', '主食');
        expect(mockConvertToGrams).toHaveBeenCalledWith({ value: 1, unit: '杯' }, '味噌汁（豆腐・わかめ）', '汁物');
        expect(nutritionService.calculateNutrition).toHaveBeenCalledTimes(1);
        // calculateNutrition に渡された matchedItems の中身も検証するとより丁寧
        const expectedMatchedItems: MealFoodItem[] = [
            expect.objectContaining({ foodId: 'f1', originalInput: 'ごはん', confidence: expect.closeTo(0.9 * 0.95 * 0.95) }), // similarity * parseConf * convertConf
            expect.objectContaining({ foodId: 'f2', originalInput: '味噌汁', confidence: expect.closeTo(0.85 * 0.9 * 0.9) }),
        ];
        expect(nutritionService.calculateNutrition).toHaveBeenCalledWith(expectedMatchedItems);


        // 2. 結果 (FoodAnalysisResult) の内容が期待通りか
        expect(result.foods).toHaveLength(2);
        expect(result.foods[0]).toEqual({ name: 'ごはん', quantity: '1 膳', confidence: expect.closeTo(0.9 * 0.95 * 0.95) });
        expect(result.foods[1]).toEqual({ name: '味噌汁（豆腐・わかめ）', quantity: '1 杯', confidence: expect.closeTo(0.85 * 0.9 * 0.9) });

        expect(result.nutrition.calories).toBe(mockNutritionResult.nutrition.calories);
        expect(result.nutrition.protein).toBe(mockNutritionResult.nutrition.protein);
        expect(result.nutrition.confidence_score).toBe(mockNutritionResult.reliability.confidence); // reliability.confidence が使われる

        // meta が存在することを確認
        expect(result.meta).toBeDefined();

        // Non-null assertion operator (!) を使用して meta プロパティにアクセス
        expect(result.meta!.unmatchedFoods).toEqual([]);
        expect(result.meta!.lowConfidenceMatches).toEqual([]);
        expect(result.meta!.errors).toEqual([]);
        expect(result.meta!.totalItemsFound).toBe(2);
        expect(result.meta!.totalInputItems).toBe(2);
        expect(result.meta!.calculationTime).toBeDefined();
    });

    // --- 他のテストケース (異常系など) をここに追加 ---

    it('異常系: 一部の食品が見つからない場合、結果の meta.unmatchedFoods に含まれること', async () => {
        // --- Arrange ---
        const parsedFoods: FoodInputParseResult[] = [
            { foodName: '納豆', quantityText: '1パック', confidence: 0.9 },
            { foodName: '謎の食べ物X', quantityText: '少々', confidence: 0.8 }, // これはマッチしない想定
        ];

        // モック: FoodMatchingService.matchFoods (謎の食べ物X は null を返す)
        const food1: Food = {
            id: 'f3', name: '納豆', category: '豆類', calories: 100, protein: 8, iron: 1.5, confidence: 0.9,
            aliases: ['ひきわり納豆'], standard_quantity: "50g", folic_acid: 60, calcium: 45, vitamin_d: 0
        };
        const matchMap = new Map<string, FoodMatchResult | null>([
            ['納豆', { food: food1, similarity: 0.98, originalInput: '納豆', matchedFood: food1, confidence: 0.98, inputName: '納豆' }],
            ['謎の食べ物X', null], // マッチしない
        ]);
        mockMatchFoods.mockResolvedValue(matchMap);

        // モック: QuantityParser (納豆のみ設定)
        mockParseQuantity.mockReturnValueOnce({ quantity: { value: 1, unit: 'パック' }, confidence: 0.9 });
        mockConvertToGrams.mockReturnValueOnce({ grams: 45, confidence: 0.9 });

        // モック: calculateNutrition (納豆のみの結果を想定)
        const mockNutritionResult: NutritionCalculationResult = {
            nutrition: { calories: 90, protein: 7.2, iron: 1.35, folic_acid: 54, calcium: 40.5, vitamin_d: 0, confidence_score: 0.85 } as NutritionData,
            reliability: { confidence: 0.85, balanceScore: 60, completeness: 0.7 },
            matchResults: [],
        };
        jest.spyOn(nutritionService, 'calculateNutrition').mockResolvedValue(mockNutritionResult);

        // --- Act ---
        const result = await nutritionService.processParsedFoods(parsedFoods);

        // --- Assert ---
        // 1. 依存メソッド呼び出し確認 (納豆のみ処理される)
        expect(mockMatchFoods).toHaveBeenCalledWith(['納豆', '謎の食べ物X']);
        expect(mockParseQuantity).toHaveBeenCalledTimes(1); // 納豆のみ
        expect(mockParseQuantity).toHaveBeenCalledWith('1パック', '納豆', '豆類');
        expect(mockConvertToGrams).toHaveBeenCalledTimes(1); // 納豆のみ
        expect(mockConvertToGrams).toHaveBeenCalledWith({ value: 1, unit: 'パック' }, '納豆', '豆類');
        expect(nutritionService.calculateNutrition).toHaveBeenCalledTimes(1); // 納豆だけで計算
        const expectedMatchedItems: MealFoodItem[] = [
            expect.objectContaining({ foodId: 'f3', originalInput: '納豆', confidence: expect.closeTo(0.98 * 0.9 * 0.9) }),
        ];
        expect(nutritionService.calculateNutrition).toHaveBeenCalledWith(expectedMatchedItems);


        // 2. 結果確認
        expect(result.foods).toHaveLength(1); // 納豆のみ
        expect(result.foods[0]?.name).toBe('納豆');
        expect(result.nutrition.calories).toBe(mockNutritionResult.nutrition.calories); // 納豆のみの栄養価
        expect(result.meta).toBeDefined();
        expect(result.meta!.unmatchedFoods).toEqual(['謎の食べ物X']); // 未マッチリストに謎の食べ物Xが含まれる
        expect(result.meta!.lowConfidenceMatches).toEqual([]);
        expect(result.meta!.errors).toEqual([]);
        expect(result.meta!.totalItemsFound).toBe(1); // 見つかったのは1つ
        expect(result.meta!.totalInputItems).toBe(2); // 入力は2つ
    });

    // --- さらに他のテストケース ---

    it('異常系: 類似度が低い食品が含まれる場合、結果の meta.lowConfidenceMatches に含まれること', async () => {
        // --- Arrange ---
        const parsedFoods: FoodInputParseResult[] = [
            { foodName: 'リンゴ', quantityText: '1個', confidence: 0.9 },
            { foodName: 'ばななっぽい何か', quantityText: '1本', confidence: 0.8 }, // 低類似度でマッチする想定
        ];

        // モック: FoodMatchingService.matchFoods
        const food1: Food = {
            id: 'f4', name: 'りんご（ふじ）', category: '果物', calories: 54, protein: 0.1, iron: 0.1, confidence: 0.95,
            aliases: ['apple'], standard_quantity: "180g", folic_acid: 2, calcium: 3, vitamin_d: 0
        };
        const food2: Food = { // 低類似度でマッチする食品 (例: バナナ)
            id: 'f5', name: 'バナナ', category: '果物', calories: 86, protein: 1.1, iron: 0.3, confidence: 0.9,
            aliases: ['banana'], standard_quantity: "100g", folic_acid: 26, calcium: 6, vitamin_d: 0
        };
        const matchMap = new Map<string, FoodMatchResult | null>([
            ['リンゴ', { food: food1, similarity: 0.92, originalInput: 'リンゴ', matchedFood: food1, confidence: 0.92, inputName: 'リンゴ' }],
            ['ばななっぽい何か', { food: food2, similarity: 0.65, originalInput: 'ばななっぽい何か', matchedFood: food2, confidence: 0.65, inputName: 'ばななっぽい何か' }], // 類似度が閾値(0.7)未満
        ]);
        mockMatchFoods.mockResolvedValue(matchMap);

        // モック: QuantityParser (両方の食品を設定)
        mockParseQuantity
            .mockReturnValueOnce({ quantity: { value: 1, unit: '個' }, confidence: 0.9 }) // リンゴ
            .mockReturnValueOnce({ quantity: { value: 1, unit: '本' }, confidence: 0.85 }); // ばななっぽい何か
        mockConvertToGrams
            .mockReturnValueOnce({ grams: 180, confidence: 0.9 }) // リンゴ
            .mockReturnValueOnce({ grams: 100, confidence: 0.9 }); // ばななっぽい何か

        // モック: calculateNutrition (両方の食品が含まれる結果を想定)
        const mockNutritionResult: NutritionCalculationResult = {
            nutrition: { calories: 180, protein: 1.5, iron: 0.5, folic_acid: 30, calcium: 10, vitamin_d: 0, confidence_score: 0.75 } as NutritionData,
            reliability: { confidence: 0.75, balanceScore: 65, completeness: 0.8 },
            matchResults: [],
        };
        jest.spyOn(nutritionService, 'calculateNutrition').mockResolvedValue(mockNutritionResult);

        // --- Act ---
        const result = await nutritionService.processParsedFoods(parsedFoods);

        // --- Assert ---
        // 1. 依存メソッド呼び出し確認 (両方処理される)
        expect(mockMatchFoods).toHaveBeenCalledWith(['リンゴ', 'ばななっぽい何か']);
        expect(mockParseQuantity).toHaveBeenCalledTimes(2);
        expect(mockConvertToGrams).toHaveBeenCalledTimes(2);
        expect(nutritionService.calculateNutrition).toHaveBeenCalledTimes(1); // 低類似度でも計算に含まれる
        const expectedMatchedItems: MealFoodItem[] = [
            expect.objectContaining({ foodId: 'f4', originalInput: 'リンゴ', confidence: expect.closeTo(Math.min(0.92, 0.9, 0.9)) }), // Math.min で計算
            expect.objectContaining({ foodId: 'f5', originalInput: 'ばななっぽい何か', confidence: expect.closeTo(Math.min(0.65, 0.85, 0.9)) }),
        ];
        expect(nutritionService.calculateNutrition).toHaveBeenCalledWith(expectedMatchedItems);


        // 2. 結果確認
        expect(result.foods).toHaveLength(2); // 低類似度でも結果に含まれる
        expect(result.foods[0]?.name).toBe('りんご（ふじ）');
        expect(result.foods[1]?.name).toBe('バナナ');
        expect(result.nutrition.calories).toBe(mockNutritionResult.nutrition.calories);
        expect(result.meta).toBeDefined();
        expect(result.meta!.unmatchedFoods).toEqual([]);
        expect(result.meta!.lowConfidenceMatches).toEqual(['ばななっぽい何か']); // 低確信度リストに含まれる
        expect(result.meta!.errors).toEqual([]);
        expect(result.meta!.totalItemsFound).toBe(2); // 見つかったのは2つ
        expect(result.meta!.totalInputItems).toBe(2); // 入力は2つ
    });

    // --- さらに他のテストケース ---

    it('異常系: QuantityParser.parseQuantity がエラーをスローする場合、該当食品はスキップされ meta.errors に記録されること', async () => {
        // --- Arrange ---
        const parsedFoods: FoodInputParseResult[] = [
            { foodName: 'ブロッコリー', quantityText: '1/2株', confidence: 0.9 },
            { foodName: '鶏むね肉', quantityText: '不明な量', confidence: 0.8 }, // これで parseQuantity がエラーを出す想定
        ];

        // モック: FoodMatchingService.matchFoods
        const food1: Food = {
            id: 'f6', name: 'ブロッコリー', category: '野菜', calories: 33, protein: 4.3, iron: 1.0, confidence: 0.95,
            aliases: [], standard_quantity: "100g", folic_acid: 120, calcium: 47, vitamin_d: 0
        };
        const food2: Food = {
            id: 'f7', name: '鶏むね肉（皮なし）', category: '肉類', calories: 108, protein: 23.3, iron: 0.3, confidence: 0.9,
            aliases: ['chicken breast'], standard_quantity: "100g", folic_acid: 3, calcium: 4, vitamin_d: 0.1
        };
        const matchMap = new Map<string, FoodMatchResult | null>([
            ['ブロッコリー', { food: food1, similarity: 0.95, originalInput: 'ブロッコリー', matchedFood: food1, confidence: 0.95, inputName: 'ブロッコリー' }],
            ['鶏むね肉', { food: food2, similarity: 0.90, originalInput: '鶏むね肉', matchedFood: food2, confidence: 0.90, inputName: '鶏むね肉' }],
        ]);
        mockMatchFoods.mockResolvedValue(matchMap);

        // モック: QuantityParser (鶏むね肉でエラーをスロー)
        mockParseQuantity
            .mockReturnValueOnce({ quantity: { value: 0.5, unit: '株' }, confidence: 0.8 }) // ブロッコリー
            .mockImplementationOnce(() => { // 鶏むね肉 (エラー)
                throw new Error('不明な単位です');
            });
        mockConvertToGrams
            .mockReturnValueOnce({ grams: 150, confidence: 0.85 }); // ブロッコリー (convertToGrams は呼ばれる)

        // モック: calculateNutrition (ブロッコリーのみの結果を想定)
        const mockNutritionResult: NutritionCalculationResult = {
            nutrition: { calories: 50, protein: 6.5, iron: 1.5, folic_acid: 180, calcium: 70, vitamin_d: 0, confidence_score: 0.8 } as NutritionData,
            reliability: { confidence: 0.8, balanceScore: 50, completeness: 0.6 },
            matchResults: [],
        };
        jest.spyOn(nutritionService, 'calculateNutrition').mockResolvedValue(mockNutritionResult);

        // --- Act ---
        const result = await nutritionService.processParsedFoods(parsedFoods);

        // --- Assert ---
        // 1. 依存メソッド呼び出し確認
        expect(mockMatchFoods).toHaveBeenCalledWith(['ブロッコリー', '鶏むね肉']);
        expect(mockParseQuantity).toHaveBeenCalledTimes(2); // 両方呼ばれる
        expect(mockParseQuantity).toHaveBeenCalledWith('1/2株', 'ブロッコリー', '野菜');
        expect(mockParseQuantity).toHaveBeenCalledWith('不明な量', '鶏むね肉（皮なし）', '肉類');
        expect(mockConvertToGrams).toHaveBeenCalledTimes(1); // エラー発生前のブロッコリーのみ呼ばれる
        expect(mockConvertToGrams).toHaveBeenCalledWith({ value: 0.5, unit: '株' }, 'ブロッコリー', '野菜');
        expect(nutritionService.calculateNutrition).toHaveBeenCalledTimes(1); // ブロッコリーだけで計算
        const expectedMatchedItems: MealFoodItem[] = [
            expect.objectContaining({ foodId: 'f6', originalInput: 'ブロッコリー', confidence: expect.closeTo(Math.min(0.95, 0.8, 0.85)) }),
        ];
        expect(nutritionService.calculateNutrition).toHaveBeenCalledWith(expectedMatchedItems);


        // 2. 結果確認
        expect(result.foods).toHaveLength(1); // エラーの食品は含まれない
        expect(result.foods[0]?.name).toBe('ブロッコリー');
        expect(result.nutrition.calories).toBe(mockNutritionResult.nutrition.calories);
        expect(result.meta).toBeDefined();
        expect(result.meta!.unmatchedFoods).toEqual([]);
        expect(result.meta!.lowConfidenceMatches).toEqual([]);
        expect(result.meta!.errors).toBeDefined();
        expect(result.meta!.errors).toHaveLength(1); // エラーが記録される
        expect(result.meta!.errors![0]).toContain('鶏むね肉の処理中にエラー: 不明な単位です');
        expect(result.meta!.totalItemsFound).toBe(1); // 見つかったのは1つ
        expect(result.meta!.totalInputItems).toBe(2); // 入力は2つ
    });

    // --- さらに他のテストケース ---

});
