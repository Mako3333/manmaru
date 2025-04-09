import { Food, FoodMatchResult } from '@/types/food';
import { FoodRepository } from './food-repository';
import { normalizeText, calculateSimilarity } from '@/lib/utils/string-utils';

/**
 * 基本食品リストを使用したリポジトリ実装
 */
export class BasicFoodRepository implements FoodRepository {
    private static instance: BasicFoodRepository;
    private foods: Map<string, Food> = new Map(); // IDをキーにした食品マップ
    private foodsByName: Map<string, Food> = new Map(); // 正規化名をキーにした食品マップ
    private aliasMap: Map<string, string> = new Map(); // エイリアス→食品IDのマップ
    private cacheLoaded = false;
    private isInitialized = false;

    private constructor() { }

    /**
     * シングルトンインスタンスの取得
     */
    public static getInstance(): BasicFoodRepository {
        if (!BasicFoodRepository.instance) {
            BasicFoodRepository.instance = new BasicFoodRepository();
        }
        return BasicFoodRepository.instance;
    }

    /**
     * キャッシュ読み込み確認
     */
    private async ensureCacheLoaded(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // 環境に応じたデータ読み込み方法
            let url: string;
            if (typeof window === 'undefined') {
                // サーバーサイド: Node.jsのfsモジュールを使用
                const fs = require('fs');
                const path = require('path');
                const filePath = path.join(process.cwd(), 'public/data/food_nutrition_database.json');
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                // データを直接ロード
                this.initializeCache(data);
                this.isInitialized = true;
                return;
            } else {
                // ブラウザサイド: fetch APIを使用
                url = '/data/food_nutrition_database.json';
                const response = await fetch(url);
                const data = await response.json();
                this.initializeCache(data);
            }

            this.isInitialized = true;
        } catch (error) {
            console.error('BasicFoodRepository: キャッシュ読み込みエラー', error);
            throw error;
        }
    }

    private initializeCache(data: unknown): void {
        // データの構造を確認
        if (typeof data !== 'object' || data === null) {
            console.error('BasicFoodRepository: 無効なキャッシュデータ形式です（オブジェクトではありません）');
            return;
        }
        // console.log(`BasicFoodRepository: データ構造: ${Object.keys(data).join(', ')}`);

        // 食品データの位置確認
        let foodsData: Record<string, unknown> = {}; // any から Record<string, unknown> へ変更

        // 'foods' プロパティが存在し、それがオブジェクトであるかチェック
        if ('foods' in data && typeof (data as { foods: unknown }).foods === 'object' && (data as { foods: unknown }).foods !== null) {
            // 正常なケース：data.foods にオブジェクトがある
            foodsData = (data as { foods: Record<string, unknown> }).foods;
            console.log(`BasicFoodRepository: 通常構造のデータ（data.foods）が見つかりました`);
        } else {
            // 異常なケース：data自体が食品リストの可能性
            // オブジェクトであり、null でなく、'name' と 'id' を持つものを食品データと見なす
            const foodEntries = Object.entries(data).filter(([key, value]) =>
                typeof value === 'object' && value !== null && 'name' in value && 'id' in value
            );

            if (foodEntries.length > 0) {
                console.log(`BasicFoodRepository: 異常構造のデータが見つかりました。トップレベルに${foodEntries.length}件の食品データがあります`);
                // foodEntries から foodsData を再構築
                foodsData = Object.fromEntries(foodEntries);
            } else {
                console.error('BasicFoodRepository: 有効な食品データが見つかりませんでした');
                // foodsData は空のまま
            }
        }

        // 食品データのキャッシュ構築
        const numberOfFoods = Object.keys(foodsData).length;
        console.log(`BasicFoodRepository: キャッシュ構築開始 (${numberOfFoods}件の食品データ)`);

        if (numberOfFoods === 0) {
            console.warn('BasicFoodRepository: キャッシュする食品データがありません。');
            this.cacheLoaded = true; // データがなくてもロード完了扱いにする
            return;
        }

        for (const [key, food] of Object.entries(foodsData)) {
            // food が Food 型の構造を持っているか検証 (より厳密に)
            if (typeof food !== 'object' || food === null || !('id' in food) || typeof food.id !== 'string' || !('name' in food) || typeof food.name !== 'string') {
                console.warn(`BasicFoodRepository: 不正な食品データをスキップします: Key=${key}, Data=${JSON.stringify(food).substring(0, 100)}...`);
                continue;
            }

            const foodItem = food as Food; // 検証後に Food 型としてアサーション

            // IDによるマップ
            this.foods.set(foodItem.id, foodItem);

            // 正規化名によるマップ
            const normalizedName = normalizeText(foodItem.name);
            this.foodsByName.set(normalizedName, foodItem);

            // エイリアスマップの構築
            if (foodItem.aliases && Array.isArray(foodItem.aliases)) { // Array であることを確認
                for (const alias of foodItem.aliases) {
                    if (typeof alias === 'string') { // alias が string であることを確認
                        const normalizedAlias = normalizeText(alias);
                        this.aliasMap.set(normalizedAlias, foodItem.id);
                    }
                }
            }
        }

        this.cacheLoaded = true;
        // データの詳細情報を出力
        console.log(`BasicFoodRepository: キャッシュ読み込み完了 (${this.foods.size}件の食品)`);
        console.log(`BasicFoodRepository: データ内の有効な食品全件数: ${this.foods.size}件`);
    }

    // インターフェース実装メソッド

    async getFoodById(id: string): Promise<Food | null> {
        await this.ensureCacheLoaded();
        return this.foods.get(id) || null;
    }

    async getFoodByExactName(name: string): Promise<Food | null> {
        await this.ensureCacheLoaded();

        const normalizedName = normalizeText(name);

        // 1. 名前の完全一致
        if (this.foodsByName.has(normalizedName)) {
            return this.foodsByName.get(normalizedName) || null;
        }

        // 2. エイリアスの完全一致
        if (this.aliasMap.has(normalizedName)) {
            const foodId = this.aliasMap.get(normalizedName);
            return foodId ? this.foods.get(foodId) || null : null;
        }

        return null;
    }

    async searchFoodsByPartialName(name: string, limit: number = 10): Promise<Food[]> {
        await this.ensureCacheLoaded();

        const normalizedQuery = normalizeText(name);
        if (!normalizedQuery) return [];

        const results: Food[] = [];

        // 食品名の部分一致検索
        for (const [key, food] of this.foodsByName.entries()) {
            if (key.includes(normalizedQuery)) {
                results.push(food);
                if (results.length >= limit) break;
            }
        }

        // エイリアスの部分一致検索
        if (results.length < limit) {
            for (const [alias, foodId] of this.aliasMap.entries()) {
                if (alias.includes(normalizedQuery)) {
                    const food = this.foods.get(foodId);
                    if (food && !results.includes(food)) {
                        results.push(food);
                        if (results.length >= limit) break;
                    }
                }
            }
        }

        return results;
    }

    async searchFoodsByFuzzyMatch(name: string, limit: number = 5): Promise<FoodMatchResult[]> {
        await this.ensureCacheLoaded();

        const normalizedQuery = normalizeText(name);
        if (!normalizedQuery) return [];

        // まず完全一致と部分一致を試みる
        const exactMatch = await this.getFoodByExactName(name);
        if (exactMatch) {
            return [{
                food: exactMatch,
                matchedFood: exactMatch,
                similarity: 1.0,
                confidence: 1.0,
                originalInput: name,
                inputName: name
            }];
        }

        // 類似度によるマッチング結果を格納
        const results: Array<{ food: Food, similarity: number }> = [];

        // 1. 食品名の類似度計算
        for (const [key, food] of this.foodsByName.entries()) {
            const similarity = calculateSimilarity(normalizedQuery, key);
            if (similarity > 0.35) { // 最低類似度閾値
                results.push({ food, similarity });
            }
        }

        // 2. エイリアスの類似度計算
        for (const [alias, foodId] of this.aliasMap.entries()) {
            const similarity = calculateSimilarity(normalizedQuery, alias);
            if (similarity > 0.35) { // 最低類似度閾値
                const food = this.foods.get(foodId);
                if (food) {
                    // すでに同じ食品が結果にある場合は、より高い類似度の方を採用
                    const existingIndex = results.findIndex(r => r.food.id === foodId);
                    if (existingIndex >= 0) {
                        if (results[existingIndex] && results[existingIndex].similarity < similarity) {
                            results[existingIndex].similarity = similarity;
                        }
                    } else {
                        results.push({ food, similarity });
                    }
                }
            }
        }

        // 類似度でソートして上位を返す
        results.sort((a, b) => b.similarity - a.similarity);

        return results.slice(0, limit).map(item => ({
            food: item.food,
            matchedFood: item.food,
            similarity: item.similarity,
            confidence: item.similarity,
            originalInput: name,
            inputName: name
        }));
    }

    async searchFoodsByCategory(category: string, limit: number = 20): Promise<Food[]> {
        await this.ensureCacheLoaded();

        const results: Food[] = [];

        for (const food of this.foods.values()) {
            if (food.category === category) {
                results.push(food);
                if (results.length >= limit) break;
            }
        }

        return results;
    }

    async getFoodsByIds(ids: string[]): Promise<Map<string, Food>> {
        await this.ensureCacheLoaded();

        const resultMap = new Map<string, Food>();

        for (const id of ids) {
            const food = this.foods.get(id);
            if (food) {
                resultMap.set(id, food);
            }
        }

        return resultMap;
    }

    async refreshCache(): Promise<void> {
        this.foods.clear();
        this.foodsByName.clear();
        this.aliasMap.clear();
        this.cacheLoaded = false;
        await this.ensureCacheLoaded();
    }
} 