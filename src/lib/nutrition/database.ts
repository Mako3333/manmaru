import { FoodAnalysisError, ErrorCode } from '../errors/food-analysis-error';
import {
    NutrientSummary,
    FoodItem,
    DatabaseFoodItem,
    QuantityUnit,
    QuantityUnitType,
    QUANTITY_CONVERSIONS
} from '@/types/nutrition';

/**
 * 栄養データベースの操作を担当するクラス
 */
export class NutritionDatabase {
    private static instance: NutritionDatabase;
    private cache: DatabaseFoodItem[] = [];
    private lastLoadTime: number = 0;
    private readonly CACHE_DURATION = 1000 * 60 * 5; // 5分

    private constructor() { }

    /**
     * シングルトンインスタンスを取得
     */
    static getInstance(): NutritionDatabase {
        if (!NutritionDatabase.instance) {
            NutritionDatabase.instance = new NutritionDatabase();
        }
        return NutritionDatabase.instance;
    }

    /**
     * データベースをロード
     */
    async loadDatabase(force: boolean = false): Promise<void> {
        const now = Date.now();

        // キャッシュが有効な場合はキャッシュを使用
        if (!force && this.cache.length > 0 && (now - this.lastLoadTime) < this.CACHE_DURATION) {
            return;
        }

        try {
            const data = await import('@/data/nutrition_data.json');
            this.cache = data.default;
            this.lastLoadTime = now;
        } catch (error) {
            throw new FoodAnalysisError(
                'データベースの読み込みに失敗しました',
                ErrorCode.DB_READ_ERROR,
                error
            );
        }
    }

    /**
     * 食品名から最適なマッチを検索
     */
    async findBestMatch(foodName: string): Promise<DatabaseFoodItem | null> {
        await this.loadDatabase();

        const normalizedQuery = this.normalizeFoodName(foodName);

        // 1. 完全一致を探す
        const exactMatch = this.cache.find(item =>
            this.normalizeFoodName(item.name) === normalizedQuery
        );
        if (exactMatch) return exactMatch;

        // 2. 部分一致を探す
        const partialMatches = this.cache.filter(item => {
            const normalizedName = this.normalizeFoodName(item.name);
            return normalizedName.includes(normalizedQuery) ||
                normalizedQuery.includes(normalizedName);
        });

        if (partialMatches.length === 0) return null;

        // 3. 最適なマッチを選択
        return this.selectBestMatch(partialMatches, normalizedQuery);
    }

    /**
     * 食品名を正規化
     */
    private normalizeFoodName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * 最適なマッチを選択
     */
    private selectBestMatch(
        candidates: DatabaseFoodItem[],
        query: string
    ): DatabaseFoodItem {
        return candidates.reduce((best, current) => {
            const bestSimilarity = this.calculateSimilarity(
                this.normalizeFoodName(best.name),
                query
            );
            const currentSimilarity = this.calculateSimilarity(
                this.normalizeFoodName(current.name),
                query
            );
            return currentSimilarity > bestSimilarity ? current : best;
        });
    }

    /**
     * レーベンシュタイン距離に基づく類似度を計算
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const matrix: number[][] = [];

        // 行列の初期化
        for (let i = 0; i <= str1.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str2.length; j++) {
            matrix[0][j] = j;
        }

        // レーベンシュタイン距離の計算
        for (let i = 1; i <= str1.length; i++) {
            for (let j = 1; j <= str2.length; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        // 類似度を0-1の範囲で返す
        const maxLength = Math.max(str1.length, str2.length);
        const distance = matrix[str1.length][str2.length];
        return 1 - distance / maxLength;
    }

    /**
     * 複数の食品アイテムの栄養素を計算
     */
    async calculateNutrition(foods: FoodItem[]): Promise<NutrientSummary> {
        await this.loadDatabase();

        const result: NutrientSummary = {
            calories: 0,
            protein: 0,
            iron: 0,
            folic_acid: 0,
            calcium: 0
        };

        let matchedItems = 0;

        for (const food of foods) {
            const match = await this.findBestMatch(food.name);
            if (match) {
                matchedItems++;
                const multiplier = this.estimateQuantityMultiplier(
                    food.quantity || '1人前',
                    match.standard_quantity
                );

                result.calories += match.calories * multiplier;
                result.protein += match.protein * multiplier;
                result.iron += match.iron * multiplier;
                result.folic_acid += match.folic_acid * multiplier;
                result.calcium += match.calcium * multiplier;
            } else {
                // マッチしない場合はデフォルト値を使用
                result.calories += 50;
                result.protein += 2;
                result.iron += 0.2;
                result.folic_acid += 5;
                result.calcium += 10;
            }
        }

        // 値の丸め処理
        this.roundNutritionValues(result);

        return result;
    }

    /**
     * 量の変換係数を推定
     */
    private estimateQuantityMultiplier(input: string, standard: string): number {
        // 単位を抽出
        const inputMatch = input.match(/([0-9.]+)\s*([^0-9]*)/);
        if (!inputMatch) return 1.0;

        const value = parseFloat(inputMatch[1]);
        const unit = inputMatch[2].trim() as QuantityUnitType;

        // 単位に基づいて変換
        if (unit in QUANTITY_CONVERSIONS) {
            const standardMatch = standard.match(/([0-9.]+)\s*([^0-9]*)/);
            if (!standardMatch) return value;

            const standardValue = parseFloat(standardMatch[1]);
            const standardUnit = standardMatch[2].trim() as QuantityUnitType;

            if (unit === standardUnit) {
                return value / standardValue;
            }

            // 異なる単位間の変換
            const inputGrams = value * QUANTITY_CONVERSIONS[unit];
            const standardGrams = standardValue * QUANTITY_CONVERSIONS[standardUnit];
            return inputGrams / standardGrams;
        }

        return value || 1.0;
    }

    /**
     * 栄養値を適切な桁数に丸める
     */
    private roundNutritionValues(data: NutrientSummary): void {
        data.calories = Math.round(data.calories);
        data.protein = Math.round(data.protein * 10) / 10;
        data.iron = Math.round(data.iron * 10) / 10;
        data.folic_acid = Math.round(data.folic_acid);
        data.calcium = Math.round(data.calcium);
    }
}