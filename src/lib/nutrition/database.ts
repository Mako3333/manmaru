import { FoodItem, NutritionData, DatabaseFoodItem, FoodCategory, FOOD_ID_CATEGORY_MAP } from "@/types/nutrition";
import { FoodAnalysisError, ErrorCode } from "@/lib/errors/food-analysis-error";

// 仮の食品データベース（実際の実装ではSupabaseなどから取得）
const FOOD_DATABASE: Record<string, DatabaseFoodItem> = {
    "ご飯": {
        name: "ご飯",
        calories: 168,
        protein: 2.5,
        iron: 0.1,
        folic_acid: 3,
        calcium: 3,
        vitamin_d: 0,
        standard_quantity: "100g",
        aliases: ["白米", "ライス"]
    },
    "サラダ": {
        name: "サラダ",
        calories: 25,
        protein: 1.2,
        iron: 0.5,
        folic_acid: 45,
        calcium: 20,
        vitamin_d: 0,
        standard_quantity: "100g",
        aliases: ["野菜サラダ", "グリーンサラダ"]
    },
    "りんご": {
        name: "りんご",
        calories: 52,
        protein: 0.2,
        iron: 0.1,
        folic_acid: 3,
        calcium: 4,
        vitamin_d: 0,
        standard_quantity: "100g",
        aliases: ["アップル"]
    },
    "牛乳": {
        name: "牛乳",
        calories: 61,
        protein: 3.3,
        iron: 0.04,
        folic_acid: 5,
        calcium: 110,
        vitamin_d: 0.3,
        standard_quantity: "100ml",
        aliases: ["ミルク"]
    },
    "鶏肉": {
        name: "鶏肉",
        calories: 191,
        protein: 20,
        iron: 0.5,
        folic_acid: 7,
        calcium: 5,
        vitamin_d: 0,
        standard_quantity: "100g",
        aliases: ["チキン"]
    },
    "ほうれん草": {
        name: "ほうれん草",
        calories: 20,
        protein: 2.2,
        iron: 2.0,
        folic_acid: 110,
        calcium: 49,
        vitamin_d: 0,
        standard_quantity: "100g",
        aliases: ["スピナッチ"]
    },
    "豆腐": {
        name: "豆腐",
        calories: 72,
        protein: 6.6,
        iron: 1.1,
        folic_acid: 15,
        calcium: 120,
        vitamin_d: 0,
        standard_quantity: "100g",
        aliases: ["とうふ"]
    }
};

/**
 * LLM向け栄養データベースAPI
 * LLMが簡単に食品の栄養情報にアクセスするためのインターフェイス
 */
export interface NutritionDatabaseLLMAPI {
    /**
     * 食品名から栄養情報を取得（完全一致）
     */
    getFoodByExactName(name: string): DatabaseFoodItem | null;

    /**
     * 食品名から栄養情報を取得（部分一致）
     */
    getFoodsByPartialName(name: string, limit?: number): DatabaseFoodItem[];

    /**
     * カテゴリから食品リストを取得
     */
    getFoodsByCategory(category: string, limit?: number): DatabaseFoodItem[];

    /**
     * 栄養素の含有量から食品リストを取得
     */
    getFoodsByNutrientContent(nutrient: string, minValue: number, limit?: number): DatabaseFoodItem[];

    /**
     * トライメスター別の推奨食品を取得
     */
    getRecommendedFoodsForPregnancyStage(trimester: number): Record<string, DatabaseFoodItem[]>;

    /**
     * データベースの状態情報を取得
     */
    getDatabaseStatus(): {
        isReady: boolean;
        itemCount: number;
        lastUpdated: Date | null;
        error: Error | null;
    };

    /**
     * 食品リストから栄養データを計算
     */
    calculateNutrition(foods: FoodItem[]): Promise<NutritionData>;

    /**
     * 外部データベースを読み込む
     */
    loadExternalDatabase(forceReload?: boolean): Promise<void>;

    /**
     * データベースが完全に読み込まれているか確認
     */
    isFullyLoaded(): boolean;
}

/**
 * 栄養データベースクラス
 * 食品データの検索と栄養計算を行う
 */
export class NutritionDatabase implements NutritionDatabaseLLMAPI {
    private static instance: NutritionDatabase;
    private foodDatabase: Record<string, DatabaseFoodItem>;
    private isFullDatabaseLoaded: boolean = false; // 拡張データベースが読み込まれたかを追跡
    private categoryIndex: Record<string, string[]> = {}; // カテゴリ別インデックス
    private nutrientIndex: Record<string, Record<string, string[]>> = {}; // 栄養素ベースのインデックス

    // データのキャッシュとロード状態の追跡
    private loadPromise: Promise<void> | null = null;
    private lastLoadTime: number = 0;
    private loadingError: Error | null = null;

    // キャッシュ有効期限（30分 = 1800000ms）
    private static CACHE_VALIDITY_TIME = 1800000;

    // 検索クエリキャッシュ
    private queryCache: Map<string, {
        timestamp: number,
        result: any
    }> = new Map();

    private constructor() {
        try {
            console.log('NutritionDatabase: コンストラクタ実行');
            this.foodDatabase = FOOD_DATABASE;
            this.initIndices();
            this.buildIndices();
            console.log(`NutritionDatabase: 初期化完了 (${Object.keys(this.foodDatabase).length}件のデータ)`);
        } catch (error) {
            console.error('NutritionDatabase: 初期化エラー:', error);
            // 初期化エラーでもデフォルトデータベースは設定
            this.foodDatabase = FOOD_DATABASE;
            throw new FoodAnalysisError(
                'データベースの初期化に失敗しました',
                ErrorCode.DB_INIT_ERROR,
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    /**
     * シングルトンインスタンスを取得
     */
    static getInstance(): NutritionDatabase {
        if (!NutritionDatabase.instance) {
            try {
                console.log('NutritionDatabase: インスタンス作成');
                NutritionDatabase.instance = new NutritionDatabase();
            } catch (error) {
                console.error('NutritionDatabase: インスタンス作成エラー:', error);
                throw new FoodAnalysisError(
                    'データベースインスタンスの作成に失敗しました',
                    ErrorCode.DB_INIT_ERROR,
                    error instanceof Error ? error : new Error(String(error))
                );
            }
        }
        return NutritionDatabase.instance;
    }

    /**
     * 外部の食品データベースJSONを読み込む
     * スロットリングとキャッシュ機構を追加
     */
    public async loadExternalDatabase(forceReload = false): Promise<void> {
        try {
            // 既に読み込み中なら待機
            if (this.loadPromise) {
                await this.loadPromise;
                return;
            }

            // キャッシュが有効ならスキップ
            if (!forceReload && this.isFullDatabaseLoaded && (Date.now() - this.lastLoadTime) < NutritionDatabase.CACHE_VALIDITY_TIME) {
                console.log('NutritionDatabase: キャッシュが有効なのでスキップします');
                return;
            }

            console.log('食品データベースを読み込み中...');

            // この処理を Promise として保存
            this.loadPromise = (async () => {
                try {
                    // 絶対URLの生成
                    let baseUrl: string;

                    if (typeof window !== 'undefined') {
                        // クライアントサイド
                        baseUrl = window.location.origin;
                    } else {
                        // サーバーサイド - 環境変数またはデフォルト値を使用
                        baseUrl = 'http://localhost:3000';
                    }

                    const dbUrl = `${baseUrl}/data/food_nutrition_database.json`;
                    console.info(`データベースの読み込みを開始: ${dbUrl}`);

                    const response = await fetch(dbUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to load database: ${response.statusText}`);
                    }
                    const data = await response.json();
                    this.foodDatabase = data.foods || data;

                    this.isFullDatabaseLoaded = true;
                    this.lastLoadTime = Date.now();
                    this.buildIndices();

                    console.log(`データベースの読み込み完了: ${Object.keys(this.foodDatabase).length}件`);
                } catch (error) {
                    this.loadingError = error instanceof Error ? error : new Error(String(error));
                    console.error('食品データベースの読み込みに失敗しました:', this.loadingError);
                } finally {
                    this.loadPromise = null;
                }
            })();

            await this.loadPromise;
        } catch (error) {
            console.error('データベース読み込み中に重大なエラーが発生:', error);
            this.loadingError = error instanceof Error ? error : new Error(String(error));
        }
    }

    /**
     * データベースの読み込み状態を取得
     */
    public getLoadingStatus(): {
        isLoaded: boolean;
        isLoading: boolean;
        error: Error | null;
        itemCount: number;
        lastLoadTime: Date | null;
    } {
        return {
            isLoaded: this.isFullDatabaseLoaded,
            isLoading: this.loadPromise !== null,
            error: this.loadingError,
            itemCount: Object.keys(this.foodDatabase).length,
            lastLoadTime: this.lastLoadTime ? new Date(this.lastLoadTime) : null
        };
    }

    /**
     * 検索のパフォーマンスを向上させるためのデータ圧縮機能
     * 頻繁に使わないデータを削減して、メモリ使用量を最適化
     */
    public optimizeMemoryUsage(): void {
        // 非頻出項目を削除または圧縮
        for (const [key, food] of Object.entries(this.foodDatabase)) {
            // 頻繁に使わないプロパティを最適化
            if (food.aliases && food.aliases.length === 0) {
                delete food.aliases;
            }

            // 超過精度の数値を丸める
            food.calories = Math.round(food.calories * 10) / 10;
            food.protein = Math.round(food.protein * 10) / 10;
            food.iron = Math.round(food.iron * 10) / 10;
            food.calcium = Math.round(food.calcium * 10) / 10;
            food.folic_acid = Math.round(food.folic_acid * 10) / 10;
            food.vitamin_d = Math.round(food.vitamin_d * 10) / 10;
        }

        console.log('メモリ使用量の最適化が完了しました');
    }

    /**
     * 食品データにカテゴリを自動割り当て
     * @param foods 食品データ
     * @returns カテゴリが割り当てられた食品データ
     */
    private processAndAssignCategories(foods: Record<string, DatabaseFoodItem>): Record<string, DatabaseFoodItem> {
        const processedFoods: Record<string, DatabaseFoodItem> = {};

        for (const [key, food] of Object.entries(foods)) {
            const processedFood = { ...food };

            // カテゴリがまだ割り当てられていない場合
            if (!processedFood.category && processedFood.id) {
                // IDの先頭2文字でカテゴリを判定
                const categoryPrefix = processedFood.id.substring(0, 2);
                if (FOOD_ID_CATEGORY_MAP[categoryPrefix]) {
                    processedFood.category = FOOD_ID_CATEGORY_MAP[categoryPrefix];
                    console.log(`カテゴリ自動割り当て: ${food.name} → ${processedFood.category}`);
                } else {
                    // デフォルトはその他
                    processedFood.category = FoodCategory.OTHER;
                }
            }

            // 栄養価に基づくタグ付け（将来の拡張用）
            const tags: string[] = processedFood.notes?.split(',') || [];

            // 鉄分が豊富な食品
            if (processedFood.iron >= 2.0) {
                tags.push('high_iron');
            }

            // カルシウムが豊富な食品
            if (processedFood.calcium >= 100.0) {
                tags.push('high_calcium');
            }

            // 葉酸が豊富な食品
            if (processedFood.folic_acid >= 80.0) {
                tags.push('high_folic_acid');
            }

            // タンパク質が豊富な食品
            if (processedFood.protein >= 15.0) {
                tags.push('high_protein');
            }

            // タグが追加されていれば更新
            if (tags.length > 0) {
                processedFood.notes = tags.join(',');
            }

            processedFoods[key] = processedFood;
        }

        return processedFoods;
    }

    /**
     * インデックスを初期化
     */
    private initIndices(): void {
        // カテゴリ別インデックス
        this.categoryIndex = {};
        // 栄養素含有量別インデックス
        this.nutrientIndex = {
            iron: { high: [], medium: [], low: [] },
            calcium: { high: [], medium: [], low: [] },
            protein: { high: [], medium: [], low: [] },
            folic_acid: { high: [], medium: [], low: [] },
            vitamin_d: { high: [], medium: [], low: [] }
        };
    }

    /**
     * 検索インデックスを構築
     */
    private buildIndices(): void {
        // インデックスをリセット
        this.initIndices();

        // インデックス構築ロジック
        for (const [key, food] of Object.entries(this.foodDatabase)) {
            // カテゴリインデックス
            if (food.category) {
                if (!this.categoryIndex[food.category]) {
                    this.categoryIndex[food.category] = [];
                }
                this.categoryIndex[food.category].push(key);
            }

            // 栄養素インデックス
            // 鉄分
            this.addToNutrientIndex('iron', key, food.iron, 2.0, 1.0);
            // カルシウム
            this.addToNutrientIndex('calcium', key, food.calcium, 100.0, 50.0);
            // タンパク質
            this.addToNutrientIndex('protein', key, food.protein, 15.0, 5.0);
            // 葉酸
            this.addToNutrientIndex('folic_acid', key, food.folic_acid, 80.0, 30.0);
            // ビタミンD
            this.addToNutrientIndex('vitamin_d', key, food.vitamin_d, 2.0, 0.5);
        }

        console.log('検索インデックスを構築しました');
    }

    /**
     * 栄養素インデックスに追加
     */
    private addToNutrientIndex(nutrient: string, key: string, value: number, highThreshold: number, mediumThreshold: number): void {
        if (value >= highThreshold) {
            this.nutrientIndex[nutrient].high.push(key);
        } else if (value >= mediumThreshold) {
            this.nutrientIndex[nutrient].medium.push(key);
        } else {
            this.nutrientIndex[nutrient].low.push(key);
        }
    }

    /**
     * 特定の栄養素が豊富な食品を検索
     * @param nutrient 栄養素名
     * @param minValue 最小値
     * @param limit 最大結果件数
     */
    public findFoodsByNutrient(nutrient: string, minValue: number, limit: number = 10): DatabaseFoodItem[] {
        const results: DatabaseFoodItem[] = [];

        // まずインデックスを使って効率的に検索
        if (this.nutrientIndex[nutrient]) {
            // 基準値に応じて適切なリストを選択
            let foodKeys: string[] = [];

            if (nutrient === 'iron' && minValue >= 2.0) {
                foodKeys = this.nutrientIndex.iron.high;
            } else if (nutrient === 'iron' && minValue >= 1.0) {
                foodKeys = [...this.nutrientIndex.iron.high, ...this.nutrientIndex.iron.medium];
            } else if (nutrient === 'calcium' && minValue >= 100.0) {
                foodKeys = this.nutrientIndex.calcium.high;
            } else if (nutrient === 'calcium' && minValue >= 50.0) {
                foodKeys = [...this.nutrientIndex.calcium.high, ...this.nutrientIndex.calcium.medium];
            } else {
                // インデックスがない場合は線形検索
                for (const [key, food] of Object.entries(this.foodDatabase)) {
                    if (food[nutrient as keyof DatabaseFoodItem] as number >= minValue) {
                        foodKeys.push(key);
                    }
                }
            }

            // 結果を集約
            for (const key of foodKeys) {
                if (results.length >= limit) break;
                results.push(this.foodDatabase[key]);
            }
        } else {
            console.warn(`未知の栄養素: ${nutrient}`);
        }

        return results;
    }

    /**
     * カテゴリ別に食品を検索
     */
    public findFoodsByCategory(category: string, limit: number = 20): DatabaseFoodItem[] {
        const results: DatabaseFoodItem[] = [];

        if (this.categoryIndex[category]) {
            for (const key of this.categoryIndex[category]) {
                if (results.length >= limit) break;
                results.push(this.foodDatabase[key]);
            }
        } else {
            console.warn(`未知のカテゴリ: ${category}`);
        }

        return results;
    }

    /**
     * データベースがフル読み込み済みかどうか
     */
    public isFullyLoaded(): boolean {
        return this.isFullDatabaseLoaded;
    }

    /**
     * 利用可能な食品の総数を返す
     */
    public getFoodCount(): number {
        return Object.keys(this.foodDatabase).length;
    }

    /**
     * 量の文字列を数値に変換する
     * @param quantity 量の文字列
     * @param standardQuantity 標準量
     * @returns 係数
     */
    private parseQuantity(quantity: string, standardQuantity: string = '100g'): number {
        if (!quantity) return 1;

        // 数値のみの場合は係数として扱う
        const numericMatch = quantity.match(/^(\d+\.?\d*)$/);
        if (numericMatch) {
            return parseFloat(numericMatch[1]);
        }

        // 標準的な単位の変換
        const standardUnitMatch = quantity.match(/^(\d+\.?\d*)\s*(g|ml|mg|μg)$/i);
        if (standardUnitMatch) {
            const value = parseFloat(standardUnitMatch[1]);
            const unit = standardUnitMatch[2].toLowerCase();

            // 標準量から基準値を取得
            const standardValue = parseFloat(standardQuantity.match(/\d+/)?.[0] || '100');

            switch (unit) {
                case 'g':
                case 'ml':
                    return value / standardValue;
                case 'mg':
                    return (value / 1000) / standardValue;
                case 'μg':
                    return (value / 1000000) / standardValue;
                default:
                    return 1;
            }
        }

        // 日本語の量表現の解析
        const japaneseQuantityMap: { [key: string]: number } = {
            '大さじ': 15,
            '小さじ': 5,
            'カップ': 200,
            '本': 40,
            '個': 50,
            '株': 50,
            '束': 100,
            '缶': 100,
            '切れ': 80,
            '枚': 60,
        };

        // 数値と単位を分離
        const japaneseMatch = quantity.match(/^(大|小|)(\d+\.?\d*)(株|本|個|束|缶|さじ|カップ|切れ|枚)$/);
        if (japaneseMatch) {
            const prefix = japaneseMatch[1];
            const value = parseFloat(japaneseMatch[2]);
            const unit = japaneseMatch[3];

            let baseGrams = japaneseQuantityMap[unit] || 0;
            if (prefix === '大' && unit === 'さじ') {
                baseGrams = japaneseQuantityMap['大さじ'];
            } else if (prefix === '小' && unit === 'さじ') {
                baseGrams = japaneseQuantityMap['小さじ'];
            }

            return (value * baseGrams) / 100; // 100gを基準とする
        }

        // デフォルトは1（標準量として扱う）
        return 1;
    }

    /**
     * 食品名から最適なデータベースエントリを検索
     * @param foodName 食品名
     * @returns 食品データ
     */
    private findFoodItem(foodName: string): DatabaseFoodItem | null {
        // 正規化
        const normalizedName = this.normalizeFoodName(foodName);

        // 完全一致検索
        const exactMatch = this.foodDatabase[normalizedName];
        if (exactMatch) {
            return exactMatch;
        }

        // 同義語検索
        for (const [dbName, data] of Object.entries(this.foodDatabase)) {
            if (data.aliases?.some(alias =>
                this.normalizeFoodName(alias) === normalizedName
            )) {
                return data;
            }
        }

        // 部分一致検索（最も長い一致を優先）
        let bestMatch: DatabaseFoodItem | null = null;
        let bestMatchLength = 0;

        for (const [dbName, data] of Object.entries(this.foodDatabase)) {
            const normalizedDbName = this.normalizeFoodName(dbName);
            if (normalizedDbName.includes(normalizedName) ||
                normalizedName.includes(normalizedDbName)) {
                const matchLength = Math.min(normalizedDbName.length, normalizedName.length);
                if (matchLength > bestMatchLength) {
                    bestMatch = data;
                    bestMatchLength = matchLength;
                }
            }
        }

        return bestMatch;
    }

    /**
     * 食品名を正規化
     * @param name 食品名
     * @returns 正規化された食品名
     */
    private normalizeFoodName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[\s　]/g, '') // 全角・半角スペースを削除
            .replace(/[、。，．]/g, '') // 句読点を削除
            .replace(/[［【「」】］]/g, '') // 括弧類を削除
            .replace(/[ぁ-ん]/g, m => { // ひらがなをカタカナに変換
                return String.fromCharCode(m.charCodeAt(0) + 0x60);
            });
    }

    /**
     * 食品リストから栄養データを計算
     * @param foods 食品リスト
     * @returns 計算された栄養データ
     */
    async calculateNutrition(foods: FoodItem[]): Promise<NutritionData> {
        try {
            console.log('栄養計算開始:', foods);

            // 入力検証
            if (!foods || !Array.isArray(foods)) {
                throw new FoodAnalysisError(
                    '無効な食品データ形式です',
                    ErrorCode.VALIDATION_ERROR
                );
            }

            if (foods.length === 0) {
                throw new FoodAnalysisError(
                    '食品データが入力されていません',
                    ErrorCode.VALIDATION_ERROR
                );
            }

            // 初期値
            const nutritionData: NutritionData = {
                calories: 0,
                protein: 0,
                iron: 0,
                folic_acid: 0,
                calcium: 0,
                vitamin_d: 0,
                confidence_score: 0,
                overall_score: 0,
                deficient_nutrients: [],
                sufficient_nutrients: [],
                daily_records: [],
                notFoundFoods: []
            };

            let totalConfidence = 0;
            let foundFoodsCount = 0;
            let notFoundFoods: string[] = [];

            // 各食品の栄養素を計算して合計
            for (const food of foods) {
                // 食品名の正規化
                const foodName = food.name.trim();

                console.log('食品検索:', foodName);
                const foodData = this.findFoodItem(foodName);

                if (!foodData) {
                    console.warn('食品データが見つかりません:', foodName);
                    notFoundFoods.push(foodName);
                    continue;
                }

                foundFoodsCount++;

                // 量の係数を計算
                const quantity = food.quantity || '1人前';
                const quantityFactor = this.parseQuantity(quantity, foodData.standard_quantity || '100g');

                // 食品の各栄養素を追加
                nutritionData.calories += foodData.calories * quantityFactor;
                nutritionData.protein += foodData.protein * quantityFactor;
                nutritionData.iron += foodData.iron * quantityFactor;
                nutritionData.folic_acid += foodData.folic_acid * quantityFactor;
                nutritionData.calcium += foodData.calcium * quantityFactor;

                if (foodData.vitamin_d) {
                    nutritionData.vitamin_d += foodData.vitamin_d * quantityFactor;
                }

                // 信頼度を追加
                totalConfidence += food.confidence || 0.5;
            }

            // データが見つからなかった場合のフォールバック
            if (foundFoodsCount === 0) {
                console.warn('有効な食品データが見つかりませんでした。デフォルト値を使用します。');
                nutritionData.calories = 100;  // 最低限のカロリー値
            }

            // 見つからなかった食品の情報を追加
            nutritionData.notFoundFoods = notFoundFoods;

            // 信頼度スコアを計算
            nutritionData.confidence_score = foundFoodsCount > 0 ? totalConfidence / foundFoodsCount : 0;

            console.log('データベースに見つからなかった食品:', notFoundFoods);

            // 栄養素の値を小数点以下2桁に丸める
            nutritionData.calories = Math.round(nutritionData.calories * 100) / 100;
            nutritionData.protein = Math.round(nutritionData.protein * 100) / 100;
            nutritionData.iron = Math.round(nutritionData.iron * 100) / 100;
            nutritionData.folic_acid = Math.round(nutritionData.folic_acid * 100) / 100;
            nutritionData.calcium = Math.round(nutritionData.calcium * 100) / 100;
            nutritionData.vitamin_d = Math.round(nutritionData.vitamin_d * 100) / 100;

            // 不足している栄養素と十分な栄養素を計算
            this.calculateNutrientStatus(nutritionData);

            // 総合スコアを計算
            this.calculateOverallScore(nutritionData);

            console.log('栄養計算結果:', nutritionData);

            return nutritionData;
        } catch (error) {
            console.error('栄養計算エラー:', error);
            throw new FoodAnalysisError(
                '栄養計算中にエラーが発生しました',
                ErrorCode.DB_ERROR,
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    /**
     * 栄養素の状態（不足/十分）を計算
     * @param nutritionData 栄養データ
     */
    private calculateNutrientStatus(nutritionData: NutritionData): void {
        // 仮の基準値（実際のアプリケーションでは設定から取得するべき）
        const thresholds = {
            calories: 2000,
            protein: 60,
            iron: 27,
            folic_acid: 400,
            calcium: 1000,
            vitamin_d: 10
        };

        // 不足している栄養素と十分な栄養素を分類
        const deficient = [];
        const sufficient = [];

        if (nutritionData.calories < thresholds.calories * 0.7) deficient.push('calories');
        else sufficient.push('calories');

        if (nutritionData.protein < thresholds.protein * 0.7) deficient.push('protein');
        else sufficient.push('protein');

        if (nutritionData.iron < thresholds.iron * 0.7) deficient.push('iron');
        else sufficient.push('iron');

        if (nutritionData.folic_acid < thresholds.folic_acid * 0.7) deficient.push('folic_acid');
        else sufficient.push('folic_acid');

        if (nutritionData.calcium < thresholds.calcium * 0.7) deficient.push('calcium');
        else sufficient.push('calcium');

        if (nutritionData.vitamin_d < thresholds.vitamin_d * 0.7) deficient.push('vitamin_d');
        else sufficient.push('vitamin_d');

        nutritionData.deficient_nutrients = deficient;
        nutritionData.sufficient_nutrients = sufficient;
    }

    /**
     * 総合スコアを計算
     * @param nutritionData 栄養データ
     */
    private calculateOverallScore(nutritionData: NutritionData): void {
        // 仮の基準値
        const thresholds = {
            calories: 2000,
            protein: 60,
            iron: 27,
            folic_acid: 400,
            calcium: 1000,
            vitamin_d: 10
        };

        // 総合スコアの計算（簡易版）
        const totalScore = (
            (nutritionData.calories / thresholds.calories) * 100 +
            (nutritionData.protein / thresholds.protein) * 100 +
            (nutritionData.iron / thresholds.iron) * 100 +
            (nutritionData.folic_acid / thresholds.folic_acid) * 100 +
            (nutritionData.calcium / thresholds.calcium) * 100 +
            (nutritionData.vitamin_d / thresholds.vitamin_d) * 100
        ) / 6;

        nutritionData.overall_score = Math.min(100, Math.round(totalScore));
    }

    /**
     * 特定のカテゴリの栄養素が豊富な食品を取得
     * @param category 食品カテゴリ
     * @param nutrient 栄養素名
     * @param count 取得件数
     */
    public getRecommendedFoodsByCategory(category: FoodCategory, nutrient: string, count: number = 5): DatabaseFoodItem[] {
        const foodsInCategory = this.findFoodsByCategory(category);

        // 栄養素値でソート
        return foodsInCategory.sort((a, b) => {
            const valueA = a[nutrient as keyof DatabaseFoodItem] as number;
            const valueB = b[nutrient as keyof DatabaseFoodItem] as number;
            return valueB - valueA; // 降順
        }).slice(0, count);
    }

    /**
     * トライメスター別の推奨食品を取得
     * @param trimester トライメスター（1, 2, 3）
     * @param count 取得件数
     */
    public getRecommendedFoodsForTrimester(trimester: number, count: number = 10): Record<string, DatabaseFoodItem[]> {
        // トライメスター別の重要栄養素
        const nutrientPriorities: Record<number, Record<string, string>> = {
            1: { primary: 'folic_acid', secondary: 'iron' },      // 第1期：葉酸、鉄分
            2: { primary: 'calcium', secondary: 'protein' },      // 第2期：カルシウム、タンパク質
            3: { primary: 'iron', secondary: 'protein' }          // 第3期：鉄分、タンパク質
        };

        const priorities = nutrientPriorities[trimester] || nutrientPriorities[1];

        // カテゴリ別に推奨食品を取得
        return {
            [FoodCategory.GRAINS]: this.getRecommendedFoodsByCategory(FoodCategory.GRAINS, priorities.primary, count / 2),
            [FoodCategory.VEGETABLES]: this.getRecommendedFoodsByCategory(FoodCategory.VEGETABLES, priorities.primary, count),
            [FoodCategory.FRUITS]: this.getRecommendedFoodsByCategory(FoodCategory.FRUITS, priorities.secondary, count / 2),
            [FoodCategory.PROTEIN]: this.getRecommendedFoodsByCategory(FoodCategory.PROTEIN, priorities.primary, count),
            [FoodCategory.DAIRY]: this.getRecommendedFoodsByCategory(FoodCategory.DAIRY, 'calcium', count / 2)
        };
    }

    /**
     * 部分一致による食品名検索
     * @param partialName 検索する食品名（部分一致）
     * @param limit 結果の最大数（オプション）
     * @returns 条件に一致する食品のリスト
     */
    public findFoodsByPartialName(partialName: string, limit?: number): DatabaseFoodItem[] {
        if (!partialName || partialName.trim().length === 0) {
            return [];
        }

        const normalizedSearchTerm = partialName.toLowerCase().trim();
        const results: DatabaseFoodItem[] = [];

        // 名前の部分一致を検索
        for (const [id, food] of Object.entries(this.foodDatabase)) {
            const normalizedName = food.name.toLowerCase();

            if (normalizedName.includes(normalizedSearchTerm)) {
                results.push(food);
            } else if (food.aliases) {
                // 別名も検索
                const aliasMatch = food.aliases.some(alias =>
                    alias.toLowerCase().includes(normalizedSearchTerm)
                );

                if (aliasMatch) {
                    results.push(food);
                }
            }

            // 結果数が上限に達したら終了
            if (limit && results.length >= limit) {
                break;
            }
        }

        return results;
    }

    /**
     * データベース状態情報を取得
     */
    public getDatabaseStatus(): {
        isReady: boolean;
        itemCount: number;
        lastUpdated: Date | null;
        error: Error | null;
    } {
        return {
            isReady: this.isFullDatabaseLoaded,
            itemCount: Object.keys(this.foodDatabase).length,
            lastUpdated: this.lastLoadTime ? new Date(this.lastLoadTime) : null,
            error: this.loadingError
        };
    }

    /**
     * 食品名から栄養情報を取得（完全一致）- LLM API
     */
    public getFoodByExactName(name: string): DatabaseFoodItem | null {
        // キャッシュキー生成
        const cacheKey = `exact:${name}`;

        // キャッシュチェック
        const cached = this.getFromCache<DatabaseFoodItem | null>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        const result = this.findFoodItem(name);

        // キャッシュに格納
        this.addToCache(cacheKey, result);

        return result;
    }

    /**
     * 食品名から栄養情報を取得（部分一致）- LLM API
     */
    public getFoodsByPartialName(name: string, limit?: number): DatabaseFoodItem[] {
        // キャッシュキー生成
        const cacheKey = `partial:${name}:${limit || 'all'}`;

        // キャッシュチェック
        const cached = this.getFromCache<DatabaseFoodItem[]>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        const result = this.findFoodsByPartialName(name, limit);

        // キャッシュに格納
        this.addToCache(cacheKey, result);

        return result;
    }

    /**
     * カテゴリから食品リストを取得 - LLM API
     */
    public getFoodsByCategory(category: string, limit?: number): DatabaseFoodItem[] {
        // キャッシュキー生成
        const cacheKey = `category:${category}:${limit || 'all'}`;

        // キャッシュチェック
        const cached = this.getFromCache<DatabaseFoodItem[]>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        const result = this.findFoodsByCategory(category, limit);

        // キャッシュに格納
        this.addToCache(cacheKey, result);

        return result;
    }

    /**
     * 栄養素の含有量から食品リストを取得 - LLM API
     */
    public getFoodsByNutrientContent(nutrient: string, minValue: number, limit?: number): DatabaseFoodItem[] {
        // キャッシュキー生成
        const cacheKey = `nutrient:${nutrient}:${minValue}:${limit || 'all'}`;

        // キャッシュチェック
        const cached = this.getFromCache<DatabaseFoodItem[]>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        const result = this.findFoodsByNutrient(nutrient, minValue, limit);

        // キャッシュに格納
        this.addToCache(cacheKey, result);

        return result;
    }

    /**
     * トライメスター別の推奨食品を取得 - LLM API
     */
    public getRecommendedFoodsForPregnancyStage(trimester: number): Record<string, DatabaseFoodItem[]> {
        // キャッシュキー生成
        const cacheKey = `trimester:${trimester}`;

        // キャッシュチェック
        const cached = this.getFromCache<Record<string, DatabaseFoodItem[]>>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        const result = this.getRecommendedFoodsForTrimester(trimester);

        // キャッシュに格納
        this.addToCache(cacheKey, result);

        return result;
    }

    /**
     * キャッシュからデータを取得
     * @private
     */
    private getFromCache<T>(key: string): T | null {
        const cached = this.queryCache.get(key);

        if (cached) {
            const currentTime = Date.now();
            // キャッシュが有効期限内なら結果を返す
            if (currentTime - cached.timestamp < NutritionDatabase.CACHE_VALIDITY_TIME) {
                return cached.result as T;
            } else {
                // 期限切れならキャッシュから削除
                this.queryCache.delete(key);
            }
        }

        return null;
    }

    /**
     * キャッシュにデータを追加
     * @private
     */
    private addToCache<T>(key: string, data: T): void {
        // nullやundefinedは保存しない
        if (data === null || data === undefined) {
            return;
        }

        // キャッシュサイズ制限（100エントリーまで）
        if (this.queryCache.size >= 100) {
            // 最も古いエントリーを削除
            const oldestKey = this.getOldestCacheKey();
            if (oldestKey) {
                this.queryCache.delete(oldestKey);
            }
        }

        this.queryCache.set(key, {
            timestamp: Date.now(),
            result: data
        });
    }

    /**
     * 最も古いキャッシュキーを取得
     * @private
     */
    private getOldestCacheKey(): string | null {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, data] of this.queryCache.entries()) {
            if (data.timestamp < oldestTime) {
                oldestTime = data.timestamp;
                oldestKey = key;
            }
        }

        return oldestKey;
    }
} 