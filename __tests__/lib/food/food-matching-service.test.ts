import { FoodMatchingServiceImpl } from '@/lib/food/food-matching-service-impl';
import { FoodRepository } from '@/lib/food/food-repository';
import { Food, FoodMatchResult, ConfidenceLevel } from '@/types/food';
import { FoodRepositoryFactory } from '@/lib/food/food-repository-factory';
import { CONFIDENCE_THRESHOLDS } from '@/lib/food/food-matching-service';

// FoodRepositoryFactory と FoodRepository をモック
jest.mock('@/lib/food/food-repository-factory');
const mockSearchFoodsByFuzzyMatch = jest.fn();
const MockFoodRepository = jest.fn<FoodRepository, []>(() => ({
    searchFoodsByFuzzyMatch: mockSearchFoodsByFuzzyMatch,
    // 不足しているメソッドのモックを追加
    getFoodById: jest.fn(),
    getFoodByExactName: jest.fn(),
    searchFoodsByPartialName: jest.fn(),
    searchFoodsByCategory: jest.fn(),
    getFoodsByIds: jest.fn(),
    refreshCache: jest.fn(),
}));

describe('FoodMatchingServiceImpl', () => {
    let foodMatchingService: FoodMatchingServiceImpl;
    let mockFoodRepositoryInstance: FoodRepository;

    // テスト用 Food データ
    const foodApple: Food = { id: 'f-apple', name: 'りんご', category: '果物', aliases: [], standard_quantity: '1個(200g)', calories: 100, protein: 0.2, iron: 0.1, calcium: 3, folic_acid: 2, vitamin_d: 0, confidence: 1 };
    const foodBanana: Food = { id: 'f-banana', name: 'バナナ', category: '果物', aliases: [], standard_quantity: '1本(100g)', calories: 90, protein: 1, iron: 0.3, calcium: 5, folic_acid: 20, vitamin_d: 0, confidence: 1 };

    beforeEach(() => {
        jest.clearAllMocks();

        // モックされたリポジトリインスタンスを作成
        mockFoodRepositoryInstance = new MockFoodRepository();

        // FoodRepositoryFactory.getRepository がモックインスタンスを返すように設定
        (FoodRepositoryFactory.getRepository as jest.Mock).mockReturnValue(mockFoodRepositoryInstance);

        // FoodMatchingService のインスタンスを作成 (デフォルト閾値 0.5)
        foodMatchingService = new FoodMatchingServiceImpl();
    });

    describe('matchFood', () => {
        test('正常にマッチングし、閾値以上の信頼度の場合、FoodMatchResultを返す', async () => {
            // Arrange
            const inputName = 'リンゴ';
            const similarity = 0.9;
            mockSearchFoodsByFuzzyMatch.mockResolvedValue([{ food: foodApple, similarity }]);

            // Act
            const result = await foodMatchingService.matchFood(inputName);

            // Assert
            expect(result).not.toBeNull();
            expect(result?.food).toEqual(foodApple);
            expect(result?.similarity).toBe(similarity);
            expect(result?.originalInput).toBe(inputName);
            // 互換性プロパティも確認
            expect(result?.matchedFood).toEqual(foodApple);
            expect(result?.confidence).toBe(similarity);
            expect(result?.inputName).toBe(inputName);
            expect(mockSearchFoodsByFuzzyMatch).toHaveBeenCalledWith(inputName, 1); // デフォルト limit = 1
        });

        test('マッチングするが信頼度が閾値未満 (VERY_LOW以上) の場合、結果を返す (警告ログが出る)', async () => {
            // Arrange
            const inputName = 'バナ ナ'; // スペース入り
            const similarity = CONFIDENCE_THRESHOLDS.LOW; // 0.4 (デフォルト閾値0.5未満、VERY_LOW 0.2以上)
            mockSearchFoodsByFuzzyMatch.mockResolvedValue([{ food: foodBanana, similarity }]);
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Act
            const result = await foodMatchingService.matchFood(inputName);

            // Assert
            expect(result).not.toBeNull();
            expect(result?.food).toEqual(foodBanana);
            expect(result?.similarity).toBe(similarity);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining(`低確信度マッチング: "${inputName}" -> "${foodBanana.name}"`),
                expect.stringContaining(`${Math.round(similarity * 100)}%`) // 括弧が表示されるか確認
            );
            consoleWarnSpy.mockRestore();
        });

        test('信頼度がVERY_LOW未満の場合、nullを返す', async () => {
            // Arrange
            const inputName = '謎の果物';
            const similarity = CONFIDENCE_THRESHOLDS.VERY_LOW - 0.01; // 0.2 未満
            mockSearchFoodsByFuzzyMatch.mockResolvedValue([{ food: foodApple, similarity }]);
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(); // 警告は出るはず

            // Act
            const result = await foodMatchingService.matchFood(inputName);

            // Assert
            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalled(); // 警告ログは出る
            consoleWarnSpy.mockRestore();
        });

        test('リポジトリが空の結果を返した場合、nullを返す', async () => {
            // Arrange
            const inputName = '存在しない食品';
            mockSearchFoodsByFuzzyMatch.mockResolvedValue([]);

            // Act
            const result = await foodMatchingService.matchFood(inputName);

            // Assert
            expect(result).toBeNull();
        });

        test('リポジトリがnullやfoodを含まない結果を返した場合、nullを返す', async () => {
            // Arrange
            const inputName = 'データ不備';
            mockSearchFoodsByFuzzyMatch.mockResolvedValue([{ food: null, similarity: 0.9 } as unknown as { food: Food; similarity: number }[]]); // Replaced any

            // Act
            let result = await foodMatchingService.matchFood(inputName);
            // Assert
            expect(result).toBeNull();

            // Arrange 2
            mockSearchFoodsByFuzzyMatch.mockResolvedValue([null] as unknown as { food: Food; similarity: number }[]); // Replaced any
            // Act 2
            result = await foodMatchingService.matchFood(inputName);
            // Assert 2
            expect(result).toBeNull();
        });


        test('リポジトリでエラーが発生した場合、nullを返し、エラーログを出力する', async () => {
            // Arrange
            const inputName = 'エラーテスト';
            const errorMessage = 'DB接続エラー';
            mockSearchFoodsByFuzzyMatch.mockRejectedValue(new Error(errorMessage));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // Act
            const result = await foodMatchingService.matchFood(inputName);

            // Assert
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`食品マッチング中にエラーが発生しました (${inputName})`),
                expect.any(Error)
            );
            consoleErrorSpy.mockRestore();
        });

        test('オプションでminSimilarityを指定した場合、それが閾値として使われる', async () => {
            // Arrange
            const inputName = 'リンゴ';
            const similarity = 0.6;
            const options = { minSimilarity: 0.7 }; // デフォルト(0.5)より厳しい閾値
            mockSearchFoodsByFuzzyMatch.mockResolvedValue([{ food: foodApple, similarity }]);
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Act
            const result = await foodMatchingService.matchFood(inputName, options);

            // Assert
            expect(result).toBeNull(); // 閾値0.7未満なのでnullになる
            expect(consoleWarnSpy).toHaveBeenCalled(); // 警告は出る
            consoleWarnSpy.mockRestore();
        });

        test('オプションでlimitを指定した場合、リポジトリに渡される', async () => {
            // Arrange
            const inputName = 'バナナ';
            const options = { limit: 5 };
            mockSearchFoodsByFuzzyMatch.mockResolvedValue([{ food: foodBanana, similarity: 0.9 }]);

            // Act
            await foodMatchingService.matchFood(inputName, options);

            // Assert
            expect(mockSearchFoodsByFuzzyMatch).toHaveBeenCalledWith(inputName, options.limit);
        });
    });

    describe('matchFoods', () => {
        test('複数の食品名を一括で処理し、結果をMapで返す', async () => {
            // Arrange
            const inputNames = ['リンゴ', 'バナナ', '存在しない'];
            const matchResultApple: FoodMatchResult = { food: foodApple, similarity: 0.9, originalInput: 'リンゴ', matchedFood: foodApple, confidence: 0.9, inputName: 'リンゴ' };
            const matchResultBanana: FoodMatchResult = { food: foodBanana, similarity: 0.8, originalInput: 'バナナ', matchedFood: foodBanana, confidence: 0.8, inputName: 'バナナ' };

            // matchFood が呼ばれることを想定し、spyOn でモック化
            const matchFoodSpy = jest.spyOn(foodMatchingService, 'matchFood');
            matchFoodSpy
                .mockResolvedValueOnce(matchResultApple)
                .mockResolvedValueOnce(matchResultBanana)
                .mockResolvedValueOnce(null); // 存在しない食品

            // Act
            const resultMap = await foodMatchingService.matchFoods(inputNames);

            // Assert
            expect(matchFoodSpy).toHaveBeenCalledTimes(inputNames.length);
            expect(matchFoodSpy).toHaveBeenCalledWith('リンゴ', undefined); // options なし
            expect(matchFoodSpy).toHaveBeenCalledWith('バナナ', undefined);
            expect(matchFoodSpy).toHaveBeenCalledWith('存在しない', undefined);

            expect(resultMap.size).toBe(inputNames.length);
            expect(resultMap.get('リンゴ')).toEqual(matchResultApple);
            expect(resultMap.get('バナナ')).toEqual(matchResultBanana);
            expect(resultMap.get('存在しない')).toBeNull();

            matchFoodSpy.mockRestore(); // スパイをリストア
        });

        test('空の配列が入力された場合、空のMapを返す', async () => {
            // Arrange
            const inputNames: string[] = [];
            const matchFoodSpy = jest.spyOn(foodMatchingService, 'matchFood');

            // Act
            const resultMap = await foodMatchingService.matchFoods(inputNames);

            // Assert
            expect(matchFoodSpy).not.toHaveBeenCalled();
            expect(resultMap.size).toBe(0);

            matchFoodSpy.mockRestore();
        });

        test('オプションが渡された場合、matchFoodに引き継がれる', async () => {
            // Arrange
            const inputNames = ['リンゴ'];
            const options = { minSimilarity: 0.8, limit: 3 };
            const matchResultApple: FoodMatchResult = { food: foodApple, similarity: 0.9, originalInput: 'リンゴ', matchedFood: foodApple, confidence: 0.9, inputName: 'リンゴ' };
            const matchFoodSpy = jest.spyOn(foodMatchingService, 'matchFood').mockResolvedValueOnce(matchResultApple);

            // Act
            await foodMatchingService.matchFoods(inputNames, options);

            // Assert
            expect(matchFoodSpy).toHaveBeenCalledWith(inputNames[0], options);
            matchFoodSpy.mockRestore();
        });
    });

    describe('matchNameQuantityPairs', () => {
        test('名前と量のペアの配列を処理し、マッチ結果と未発見リストを返す', async () => {
            // Arrange
            const inputPairs = [
                { name: 'リンゴ', quantity: '1個' },
                { name: 'バナナ' }, // 量がundefinedの場合
                { name: '存在しない' },
            ];
            const matchResultApple: FoodMatchResult = { food: foodApple, similarity: 0.9, originalInput: 'リンゴ', matchedFood: foodApple, confidence: 0.9, inputName: 'リンゴ' };
            const matchResultBanana: FoodMatchResult = { food: foodBanana, similarity: 0.8, originalInput: 'バナナ', matchedFood: foodBanana, confidence: 0.8, inputName: 'バナナ' };

            // matchFoods が呼ばれることを想定し、spyOn でモック化
            const matchFoodsSpy = jest.spyOn(foodMatchingService, 'matchFoods');
            const mockResultMap = new Map<string, FoodMatchResult | null>([
                ['リンゴ', matchResultApple],
                ['バナナ', matchResultBanana],
                ['存在しない', null],
            ]);
            matchFoodsSpy.mockResolvedValue(mockResultMap);

            // Act
            const { matchResults, notFoundFoods } = await foodMatchingService.matchNameQuantityPairs(inputPairs);

            // Assert
            expect(matchFoodsSpy).toHaveBeenCalledTimes(1);
            // matchFoods には名前の配列が渡されることを確認
            expect(matchFoodsSpy).toHaveBeenCalledWith(['リンゴ', 'バナナ', '存在しない']);

            expect(matchResults).toHaveLength(2);
            expect(matchResults).toContainEqual(matchResultApple);
            expect(matchResults).toContainEqual(matchResultBanana);

            expect(notFoundFoods).toHaveLength(1);
            expect(notFoundFoods).toContain('存在しない');

            matchFoodsSpy.mockRestore();
        });

        test('空の配列が入力された場合、空の結果を返す', async () => {
            // Arrange
            const inputPairs: Array<{ name: string; quantity?: string }> = [];
            const matchFoodsSpy = jest.spyOn(foodMatchingService, 'matchFoods');

            // Act
            const { matchResults, notFoundFoods } = await foodMatchingService.matchNameQuantityPairs(inputPairs);

            // Assert
            expect(matchFoodsSpy).toHaveBeenCalledWith([]); // 空配列で呼ばれる
            expect(matchResults).toHaveLength(0);
            expect(notFoundFoods).toHaveLength(0);

            matchFoodsSpy.mockRestore();
        });
    });

    describe('getConfidenceLevel', () => {
        test.each([
            // 閾値ピッタリのケース
            { confidence: CONFIDENCE_THRESHOLDS.HIGH, expectedLevel: ConfidenceLevel.HIGH },       // >= 0.8
            { confidence: CONFIDENCE_THRESHOLDS.MEDIUM, expectedLevel: ConfidenceLevel.MEDIUM },     // >= 0.6
            { confidence: CONFIDENCE_THRESHOLDS.LOW, expectedLevel: ConfidenceLevel.LOW },        // >= 0.4
            { confidence: CONFIDENCE_THRESHOLDS.VERY_LOW, expectedLevel: ConfidenceLevel.VERY_LOW }, // >= 0.2
            // 閾値間のケース
            { confidence: 0.95, expectedLevel: ConfidenceLevel.HIGH },
            { confidence: 0.7, expectedLevel: ConfidenceLevel.MEDIUM },
            { confidence: 0.5, expectedLevel: ConfidenceLevel.LOW },
            { confidence: 0.3, expectedLevel: ConfidenceLevel.VERY_LOW },
            // 閾値未満のケース
            { confidence: CONFIDENCE_THRESHOLDS.VERY_LOW - 0.01, expectedLevel: null }, // < 0.2
            { confidence: 0, expectedLevel: null },
            { confidence: -0.5, expectedLevel: null }, // マイナス値
        ])('$confidence -> $expectedLevel', ({ confidence, expectedLevel }) => {
            const level = foodMatchingService.getConfidenceLevel(confidence);
            expect(level).toBe(expectedLevel);
        });
    });

    describe('getConfidenceDisplay', () => {
        test.each([
            // 各レベルに対応する表示情報
            {
                confidence: 0.9, // HIGH
                expected: { level: ConfidenceLevel.HIGH, colorClass: 'text-green-600', icon: 'check-circle', message: '高確信度マッチング' }
            },
            {
                confidence: 0.65, // MEDIUM
                expected: { level: ConfidenceLevel.MEDIUM, colorClass: 'text-blue-500', icon: 'info-circle', message: '中確信度マッチング' }
            },
            {
                confidence: 0.42, // LOW
                expected: { level: ConfidenceLevel.LOW, colorClass: 'text-yellow-500', icon: 'exclamation-circle', message: '低確信度マッチング' }
            },
            {
                confidence: 0.25, // VERY_LOW
                expected: { level: ConfidenceLevel.VERY_LOW, colorClass: 'text-red-500', icon: 'times-circle', message: '非常に低い確信度' }
            },
            // 閾値未満 (null)
            {
                confidence: 0.1,
                expected: { level: null, colorClass: 'text-gray-400', icon: 'question-circle', message: '確信度なし' }
            },
            {
                confidence: -1,
                expected: { level: null, colorClass: 'text-gray-400', icon: 'question-circle', message: '確信度なし' }
            },
        ])('$confidence -> $expected.message', ({ confidence, expected }) => {
            const displayInfo = foodMatchingService.getConfidenceDisplay(confidence);
            expect(displayInfo).toEqual(expected);
        });
    });

    describe('determineConfidenceLevel', () => {
        test('閾値未満の場合、VERY_LOWを返す', async () => {
            // Arrange
            const inputName = 'データ不備';
            mockSearchFoodsByFuzzyMatch.mockResolvedValue([{ food: null, similarity: 0.9 } as unknown as { food: Food; similarity: number }[]]); // Replaced any

            // Act
            let result = await foodMatchingService.matchFood(inputName);

            // Assert
            expect(result).toBeNull();
            expect((foodMatchingService as unknown as { determineConfidenceLevel: (sim: number) => ConfidenceLevel }).determineConfidenceLevel(0.15)).toBe(ConfidenceLevel.VERY_LOW);
            expect((foodMatchingService as unknown as { determineConfidenceLevel: (sim: number) => ConfidenceLevel }).determineConfidenceLevel(0.0)).toBe(ConfidenceLevel.VERY_LOW);
            expect((foodMatchingService as unknown as { determineConfidenceLevel: (sim: number) => ConfidenceLevel }).determineConfidenceLevel(-0.1)).toBe(ConfidenceLevel.VERY_LOW);
        });
    });
}); 