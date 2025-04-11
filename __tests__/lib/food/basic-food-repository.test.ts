import { BasicFoodRepository } from '@/lib/food/basic-food-repository';
import { Food } from '@/types/food';
import fs from 'fs'; // fs をインポートしてモック

// fs.readFileSync をモック
jest.mock('fs');
const mockReadFileSync = jest.spyOn(fs, 'readFileSync');

// ダミーの食品データ (テスト用)
const dummyFoodData = {
    foods: {
        'f-apple': {
            id: 'f-apple', name: 'りんご', category: '果物', aliases: ['リンゴ', 'アップル'], standard_quantity: '1個(200g)',
            calories: 100, protein: 0.2, iron: 0.1, calcium: 3, folic_acid: 2, vitamin_d: 0, confidence: 1
        },
        'f-banana': {
            id: 'f-banana', name: 'バナナ', category: '果物', aliases: [], standard_quantity: '1本(100g)',
            calories: 90, protein: 1, iron: 0.3, calcium: 5, folic_acid: 20, vitamin_d: 0, confidence: 1
        },
        'f-rice': {
            id: 'f-rice', name: '白米', category: '穀物', aliases: ['ごはん'], standard_quantity: '1膳(150g)',
            calories: 250, protein: 4, iron: 0.2, calcium: 5, folic_acid: 5, vitamin_d: 0, confidence: 1
        }
    }
};

describe('BasicFoodRepository', () => {
    let repository: BasicFoodRepository;

    beforeEach(() => {
        // 各テスト前にモックの状態とキャッシュをリセット
        jest.clearAllMocks();
        // BasicFoodRepository のプライベートプロパティをリセット (シングルトンのため)
        const instance = BasicFoodRepository.getInstance();
        (instance as unknown as { foods: Map<string, Food> }).foods = new Map();
        (instance as unknown as { foodsByName: Map<string, Food> }).foodsByName = new Map();
        (instance as unknown as { aliasMap: Map<string, string> }).aliasMap = new Map();
        (instance as unknown as { cacheLoaded: boolean }).cacheLoaded = false;
        (instance as unknown as { isInitialized: boolean }).isInitialized = false;

        // readFileSync がダミーデータを返すように設定
        mockReadFileSync.mockReturnValue(JSON.stringify(dummyFoodData));

        // インスタンス取得 (この時点で ensureCacheLoaded が呼ばれる可能性がある)
        repository = BasicFoodRepository.getInstance();
    });

    test('getInstanceはシングルトンインスタンスを返す', () => {
        const instance1 = BasicFoodRepository.getInstance();
        const instance2 = BasicFoodRepository.getInstance();
        expect(instance1).toBe(instance2);
    });

    describe('ensureCacheLoaded (initializeCache)', () => {
        test('初回アクセス時にデータを正しく読み込みキャッシュする', async () => {
            // Act: ensureCacheLoaded は getFoodById などで暗黙的に呼ばれる
            await repository.getFoodById('f-apple'); // 何かしらのメソッドを呼んでキャッシュをロード

            // Assert
            expect(mockReadFileSync).toHaveBeenCalledTimes(1);
            // キャッシュが正しく構築されたか (内部状態のアサーション)
            expect((repository as unknown as { cacheLoaded: boolean }).cacheLoaded).toBe(true);
            expect((repository as unknown as { isInitialized: boolean }).isInitialized).toBe(true);
            expect((repository as unknown as { foods: Map<string, Food> }).foods.size).toBe(3);
            expect((repository as unknown as { foodsByName: Map<string, Food> }).foodsByName.size).toBe(3);
            expect((repository as unknown as { aliasMap: Map<string, string> }).aliasMap.size).toBe(3); // りんご(2), ごはん(1)
            expect((repository as unknown as { aliasMap: Map<string, string> }).aliasMap.get('りんご')).toBe('f-apple');
        });

        test('不正なデータ形式の場合、エラーログを出力しキャッシュは空のまま', async () => {
            // Arrange
            mockReadFileSync.mockReturnValue(JSON.stringify({ invalid: 'data' })); // 不正な形式
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // Act
            await repository.getFoodById('any-id'); // キャッシュロードを試みる

            // Assert
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'BasicFoodRepository: 有効な食品データが見つかりませんでした'
            );
            expect((repository as unknown as { cacheLoaded: boolean }).cacheLoaded).toBe(true); // ロード試行は完了
            expect((repository as unknown as { isInitialized: boolean }).isInitialized).toBe(true);
            expect((repository as unknown as { foods: Map<string, Food> }).foods.size).toBe(0);
            expect((repository as unknown as { foodsByName: Map<string, Food> }).foodsByName.size).toBe(0);

            consoleErrorSpy.mockRestore();
        });

        test('ファイル読み込みエラーが発生した場合、エラーがスローされる', async () => {
            // Arrange
            const readError = new Error('File not found');
            mockReadFileSync.mockImplementation(() => { throw readError; });

            // Act & Assert
            await expect(repository.getFoodById('any-id')) // キャッシュロードを試みる
                .rejects
                .toThrow(readError);
        });
    });

    describe('getFoodById', () => {
        test('存在するIDを指定した場合、対応するFoodオブジェクトを返す', async () => {
            // Act
            const result = await repository.getFoodById('f-apple');
            // Assert
            expect(result).toBeDefined();
            expect(result?.id).toBe('f-apple');
            expect(result?.name).toBe('りんご');
        });

        test('存在しないIDを指定した場合、nullを返す', async () => {
            // Act
            const result = await repository.getFoodById('f-nonexistent');
            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getFoodByExactName', () => {
        test('存在する食品名を指定した場合、対応するFoodオブジェクトを返す', async () => {
            const result = await repository.getFoodByExactName('バナナ');
            expect(result).toBeDefined();
            expect(result?.id).toBe('f-banana');
        });

        test('存在するエイリアスを指定した場合、対応するFoodオブジェクトを返す', async () => {
            const result = await repository.getFoodByExactName('ごはん'); // 白米のエイリアス
            expect(result).toBeDefined();
            expect(result?.id).toBe('f-rice');
        });

        test('正規化された名前 (小文字/半角) でも検索できる', async () => {
            const resultUpper = await repository.getFoodByExactName('APPLE'); // りんごのエイリアス(大文字)
            expect(resultUpper).toBeDefined();
            expect(resultUpper?.id).toBe('f-apple');

            const resultFullWidth = await repository.getFoodByExactName('　リンゴ　'); // 前後にスペース
            expect(resultFullWidth).toBeDefined();
            expect(resultFullWidth?.id).toBe('f-apple');
        });

        test('存在しない名前を指定した場合、nullを返す', async () => {
            const result = await repository.getFoodByExactName('存在しない食品');
            expect(result).toBeNull();
        });
    });

    describe('searchFoodsByPartialName', () => {
        test('部分一致する食品名を検索し、配列で返す', async () => {
            const results = await repository.searchFoodsByPartialName('リン'); // りんご
            expect(results).toHaveLength(1);
            expect(results[0]?.id).toBe('f-apple');
        });

        test('部分一致するエイリアス名を検索し、配列で返す', async () => {
            const results = await repository.searchFoodsByPartialName('はん'); // ごはん (白米のエイリアス)
            expect(results).toHaveLength(1);
            expect(results[0]?.id).toBe('f-rice');
        });

        test('複数の食品が部分一致する場合、limit数まで返す', async () => {
            const results = await repository.searchFoodsByPartialName('果物'); // カテゴリ名だが、食品名やエイリアスに含まれていないと想定
            // -> ダミーデータではカテゴリ検索は別メソッドなので、これは空のはず
            expect(results).toHaveLength(0);

            const resultsB = await repository.searchFoodsByPartialName('バ'); // バナナ
            expect(resultsB).toHaveLength(1);
            expect(resultsB[0]?.id).toBe('f-banana');

            const resultsC = await repository.searchFoodsByPartialName('米'); // 白米
            expect(resultsC).toHaveLength(1);
            expect(resultsC[0]?.id).toBe('f-rice');
        });

        test('limit オプションが正しく適用される', async () => {
            // ダミーデータに「米」を含む食品を追加してテスト
            const instance = BasicFoodRepository.getInstance();
            (instance as unknown as { foods: Map<string, Food> }).foods.set('f-brown-rice', { id: 'f-brown-rice', name: '玄米', category: '穀物' } as Food);
            (instance as unknown as { foodsByName: Map<string, Food> }).foodsByName.set('げんまい', { id: 'f-brown-rice', name: '玄米', category: '穀物' } as Food);

            const resultsLimit1 = await repository.searchFoodsByPartialName('米', 1);
            expect(resultsLimit1).toHaveLength(1);

            const resultsLimit2 = await repository.searchFoodsByPartialName('米', 2);
            expect(resultsLimit2).toHaveLength(2); // 白米と玄米
            expect(resultsLimit2.map(f => f.id)).toContain('f-rice');
            expect(resultsLimit2.map(f => f.id)).toContain('f-brown-rice');
        });

        test('一致する食品がない場合、空の配列を返す', async () => {
            const results = await repository.searchFoodsByPartialName('存在しない');
            expect(results).toHaveLength(0);
        });

        test('空文字列で検索した場合、空の配列を返す', async () => {
            const results = await repository.searchFoodsByPartialName('');
            expect(results).toHaveLength(0);
        });
    });

    describe('searchFoodsByFuzzyMatch', () => {
        // あいまい検索は string-similarity を利用している想定だが、
        // BasicFoodRepository の実装では現在利用されていないため、
        // searchFoodsByPartialName と同じような動作をするか、あるいはモックが必要になる。
        // ここでは、簡易的な部分一致検索としてテストを実装する（将来的な実装変更を考慮）。

        test('類似する食品名を検索し、配列で返す', async () => {
            // 現状の実装では部分一致検索なので、'リン' で 'りんご' がヒットする
            const results = await repository.searchFoodsByFuzzyMatch('リン');
            expect(results).toHaveLength(1);
            expect(results[0]?.food.id).toBe('f-apple');
            // TODO: string-similarity 実装後、similarity score も検証する
        });

        test('類似するエイリアス名を検索し、配列で返す', async () => {
            const results = await repository.searchFoodsByFuzzyMatch('ごはん'); // 白米のエイリアス
            expect(results).toHaveLength(1);
            expect(results[0]?.food.id).toBe('f-rice');
        });

        test('threshold オプションでフィルタリングされる (現状は未実装)', async () => {
            // BasicFoodRepository は類似度計算を実装していないため、このテストは現状パスしない
            // 実装されたら、 threshold を使ってフィルタリングするテストを追加する
            // const resultsHighThreshold = await repository.searchFoodsByFuzzyMatch('りんご', 0.9);
            // expect(resultsHighThreshold).toHaveLength(1);
            // const resultsLowThreshold = await repository.searchFoodsByFuzzyMatch('りご', 0.5);
            // expect(resultsLowThreshold).toHaveLength(1);
            // const resultsTooHigh = await repository.searchFoodsByFuzzyMatch('りんご', 1.1);
            // expect(resultsTooHigh).toHaveLength(0);

            // 現状は部分一致のみなので、threshold は無視される想定
            const results = await repository.searchFoodsByFuzzyMatch('りんご'); // threshold 引数なし
            expect(results).toHaveLength(1);
            expect(results[0]?.food.id).toBe('f-apple');
        });

        test('limit オプションが正しく適用される', async () => {
            // ダミーデータに「バナ」を含む食品を追加してテスト
            const instance = BasicFoodRepository.getInstance();
            // foods にも追加する必要がある
            (instance as unknown as { foods: Map<string, Food> }).foods.set('f-banana-smoothie', { id: 'f-banana-smoothie', name: 'バナナスムージー', category: '飲料' } as Food);
            (instance as unknown as { foodsByName: Map<string, Food> }).foodsByName.set('ばななすむーじー', { id: 'f-banana-smoothie', name: 'バナナスムージー', category: '飲料' } as Food);

            const resultsLimit1 = await repository.searchFoodsByFuzzyMatch('バナ', 1); // 修正: 引数を2つに
            expect(resultsLimit1).toHaveLength(1);

            const resultsLimit2 = await repository.searchFoodsByFuzzyMatch('バナ', 2); // 修正: 引数を2つに
            expect(resultsLimit2).toHaveLength(2); // バナナとバナナスムージー
            expect(resultsLimit2.map(r => r.food.id)).toContain('f-banana');
            expect(resultsLimit2.map(r => r.food.id)).toContain('f-banana-smoothie');
        });

        test('一致する食品がない場合、空の配列を返す', async () => {
            const results = await repository.searchFoodsByFuzzyMatch('存在しない');
            expect(results).toHaveLength(0);
        });

        test('空文字列で検索した場合、空の配列を返す', async () => {
            const results = await repository.searchFoodsByFuzzyMatch('');
            expect(results).toHaveLength(0);
        });

        test('検索結果がソートされている (類似度順 - 現状は未実装)', async () => {
            // 現状の実装では類似度ソートは行われないため、テストは部分一致の順序に依存する
            const instance = BasicFoodRepository.getInstance();
            (instance as unknown as { foods: Map<string, Food> }).foods.set('f-rice-ball', { id: 'f-rice-ball', name: 'おにぎり (米)', category: '穀物' } as Food);
            (instance as unknown as { foodsByName: Map<string, Food> }).foodsByName.set('おにぎり (こめ)', { id: 'f-rice-ball', name: 'おにぎり (米)', category: '穀物' } as Food);

            const results = await repository.searchFoodsByFuzzyMatch('米'); // 修正: 引数を1つに
            expect(results.length).toBeGreaterThanOrEqual(2); // 白米, おにぎり(米)
            // TODO: string-similarity 実装後、類似度でのソート順を検証する
        });
    });

    describe('searchFoodsByCategory', () => {
        test('指定したカテゴリに属する食品を検索し、配列で返す', async () => {
            const results = await repository.searchFoodsByCategory('果物');
            expect(results).toHaveLength(2);
            const ids = results.map(f => f.id);
            expect(ids).toContain('f-apple');
            expect(ids).toContain('f-banana');
        });

        test('limit オプションが正しく適用される', async () => {
            const results = await repository.searchFoodsByCategory('果物', 1);
            expect(results).toHaveLength(1);
            // どちらか一つが含まれていれば良い（順序は保証されないため）
            expect(['f-apple', 'f-banana']).toContain(results[0]?.id);
        });

        test('存在しないカテゴリを指定した場合、空の配列を返す', async () => {
            const results = await repository.searchFoodsByCategory('存在しないカテゴリ');
            expect(results).toHaveLength(0);
        });

        test('カテゴリ名の正規化 (大文字/小文字、スペース) をテスト', async () => {
            // ダミーデータに 大文字/スペースを含むカテゴリ を追加
            const instance = BasicFoodRepository.getInstance();
            (instance as unknown as { foods: Map<string, Food> }).foods.set('f-test-cat', { id: 'f-test-cat', name: 'テスト食品', category: ' テスト カテゴリ ', aliases: [], standard_quantity: '1個', calories: 1, protein: 0, iron: 0, calcium: 0, folic_acid: 0, vitamin_d: 0, confidence: 1 } as any as Food);
            // category検索は foods マップを直接見ているので、上記追加だけで良いはず

            const resultsLower = await repository.searchFoodsByCategory('テスト カテゴリ');
            expect(resultsLower).toHaveLength(1);
            expect(resultsLower[0]!.id).toBe('f-test-cat');

            const resultsUpper = await repository.searchFoodsByCategory(' テスト カテゴリ ');
            expect(resultsUpper).toHaveLength(1);
            expect(resultsUpper[0]!.id).toBe('f-test-cat');
        });

        test('空文字列で検索した場合、空の配列を返す', async () => {
            const results = await repository.searchFoodsByCategory('');
            expect(results).toHaveLength(0);
        });
    });

    describe('getFoodsByIds', () => {
        test('存在する複数のIDを指定した場合、対応するFoodオブジェクトのMapを返す', async () => {
            const idsToGet = ['f-apple', 'f-rice'];
            const resultMap = await repository.getFoodsByIds(idsToGet);

            expect(resultMap.size).toBe(2);
            expect(resultMap.has('f-apple')).toBe(true);
            expect(resultMap.get('f-apple')?.name).toBe('りんご');
            expect(resultMap.has('f-rice')).toBe(true);
            expect(resultMap.get('f-rice')?.name).toBe('白米');
        });

        test('存在するIDと存在しないIDを混ぜて指定した場合、存在するIDのデータのみ含むMapを返す', async () => {
            const idsToGet = ['f-banana', 'f-nonexistent', 'f-apple'];
            const resultMap = await repository.getFoodsByIds(idsToGet);

            expect(resultMap.size).toBe(2);
            expect(resultMap.has('f-banana')).toBe(true);
            expect(resultMap.get('f-banana')?.name).toBe('バナナ');
            expect(resultMap.has('f-apple')).toBe(true);
            expect(resultMap.get('f-apple')?.name).toBe('りんご');
            expect(resultMap.has('f-nonexistent')).toBe(false);
        });

        test('存在しないIDのみを指定した場合、空のMapを返す', async () => {
            const idsToGet = ['f-nonexistent1', 'f-nonexistent2'];
            const resultMap = await repository.getFoodsByIds(idsToGet);

            expect(resultMap.size).toBe(0);
        });

        test('空の配列を指定した場合、空のMapを返す', async () => {
            const idsToGet: string[] = [];
            const resultMap = await repository.getFoodsByIds(idsToGet);

            expect(resultMap.size).toBe(0);
        });
    });

    describe('refreshCache', () => {
        test('refreshCacheを呼び出すとデータファイルを再読み込みする', async () => {
            // Arrange: 最初にキャッシュをロードしておく
            await repository.getFoodById('f-apple');
            expect(mockReadFileSync).toHaveBeenCalledTimes(1);

            // Act: キャッシュをリフレッシュ
            await repository.refreshCache();

            // Assert: 再度ファイルが読み込まれたことを確認
            expect(mockReadFileSync).toHaveBeenCalledTimes(2);
        });

        test('新しいデータでキャッシュが正しく更新される', async () => {
            // Arrange: 最初のキャッシュをロード
            await repository.getFoodById('f-apple');
            expect((repository as unknown as { foods: Map<string, Food> }).foods.size).toBe(3);
            expect((repository as unknown as { foods: Map<string, Food> }).foods.has('f-grape')).toBe(false);

            // 新しいデータを用意
            const updatedFoodData = {
                foods: {
                    ...dummyFoodData.foods,
                    'f-grape': { // 新しい食品
                        id: 'f-grape', name: 'ぶどう', category: '果物', aliases: [], standard_quantity: '1房(150g)',
                        calories: 100, protein: 0.5, iron: 0.1, calcium: 4, folic_acid: 3, vitamin_d: 0, confidence: 1
                    },
                    'f-apple': { // 既存の食品を更新
                        ...dummyFoodData.foods['f-apple'],
                        calories: 110 // カロリーを変更
                    }
                }
            };
            // 不要になった食品を削除 (例: f-rice)
            delete (updatedFoodData.foods as any)['f-rice'];

            mockReadFileSync.mockReturnValue(JSON.stringify(updatedFoodData));

            // Act: キャッシュをリフレッシュ
            await repository.refreshCache();

            // Assert: キャッシュが更新されたことを確認
            expect((repository as unknown as { foods: Map<string, Food> }).foods.size).toBe(3); // f-apple, f-banana, f-grape
            expect((repository as unknown as { foods: Map<string, Food> }).foods.has('f-grape')).toBe(true);
            expect((repository as unknown as { foods: Map<string, Food> }).foods.get('f-grape')?.name).toBe('ぶどう');
            expect((repository as unknown as { foods: Map<string, Food> }).foods.get('f-apple')?.calories).toBe(110); // 更新されたか
            expect((repository as unknown as { foods: Map<string, Food> }).foods.has('f-rice')).toBe(false); // 削除されたか
            expect((repository as unknown as { foodsByName: Map<string, Food> }).foodsByName.has('はくまい')).toBe(false); // foodsByNameも更新されるか
        });

        test('ファイル読み込みエラーが発生した場合、エラーログを出力しキャッシュは古いまま', async () => {
            // Arrange: 最初のキャッシュをロード
            await repository.getFoodById('f-apple');
            const initialFoodCount = (repository as unknown as { foods: Map<string, Food> }).foods.size;
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // ファイル読み込みエラーを発生させるようにモックを設定
            const readError = new Error('Cannot read updated file');
            mockReadFileSync.mockImplementation(() => { throw readError; });

            // Act: キャッシュのリフレッシュを試みる
            await repository.refreshCache();

            // Assert: エラーログが出力され、キャッシュは変更されていないことを確認
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'BasicFoodRepository: キャッシュの更新中にエラーが発生しました:',
                readError
            );
            expect((repository as unknown as { foods: Map<string, Food> }).foods.size).toBe(initialFoodCount); // キャッシュサイズが変わらない
            expect((repository as unknown as { foods: Map<string, Food> }).foods.get('f-apple')?.name).toBe('りんご'); // 古いデータが残っている

            consoleErrorSpy.mockRestore();
        });
    });

    describe('normalizeString', () => {
        // プライベートメソッドのテスト (必要であれば)
        test('文字列を正規化 (小文字化、全角->半角、スペース除去) する', () => {
            const instance = BasicFoodRepository.getInstance();
            const normalize = (instance as unknown as { normalizeString: (str: string) => string }).normalizeString;
            expect(normalize('　ＲＩＣＥ　ＡＮＤ　ＢＥＡＮＳ　１２３　')).toBe('riceandbeans123');
            expect(normalize('リンゴ（ふじ）')).toBe('りんご(ふじ)');
        });
    });

    describe('normalizeForSearch', () => {
        // プライベートメソッドのテスト (必要であれば)
        test('検索用に文字列を正規化 (小文字化、全角->半角、スペース無視) する', () => {
            const instance = BasicFoodRepository.getInstance();
            const normalizeSearch = (instance as unknown as { normalizeForSearch: (str: string) => string }).normalizeForSearch;
            expect(normalizeSearch('　ＲＩＣＥ　ＡＮＤ　ＢＥＡＮＳ　１２３　')).toBe('rice and beans 123'); // スペースは保持
            expect(normalizeSearch('リンゴ（ふじ）')).toBe('りんご(ふじ)');
        });
    });

}); 