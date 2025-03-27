import { Food, FoodMatchResult } from '@/types/food';

/**
 * 食品データリポジトリのインターフェース
 */
export interface FoodRepository {
    /**
     * IDによる食品の取得
     */
    getFoodById(id: string): Promise<Food | null>;

    /**
     * 食品名による完全一致検索
     */
    getFoodByExactName(name: string): Promise<Food | null>;

    /**
     * 食品名による部分一致検索
     */
    searchFoodsByPartialName(name: string, limit?: number): Promise<Food[]>;

    /**
     * 食品名によるファジー検索
     */
    searchFoodsByFuzzyMatch(name: string, limit?: number): Promise<FoodMatchResult[]>;

    /**
     * カテゴリによる食品検索
     */
    searchFoodsByCategory(category: string, limit?: number): Promise<Food[]>;

    /**
     * 複数の食品IDによる一括取得
     */
    getFoodsByIds(ids: string[]): Promise<Map<string, Food>>;

    /**
     * キャッシュの更新
     */
    refreshCache(): Promise<void>;
} 