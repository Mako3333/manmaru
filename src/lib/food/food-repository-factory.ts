import { FoodRepository } from './food-repository';
import { BasicFoodRepository } from './basic-food-repository';

/**
 * 食品リポジトリの種類
 */
export enum FoodRepositoryType {
    BASIC = 'basic',      // 基本食品リスト
    SUPABASE = 'supabase' // Supabaseデータベース
}

/**
 * 食品リポジトリのファクトリクラス
 */
export class FoodRepositoryFactory {
    /**
     * 指定されたタイプのリポジトリを取得
     */
    static getRepository(type: FoodRepositoryType = FoodRepositoryType.BASIC): FoodRepository {
        switch (type) {
            case FoodRepositoryType.BASIC:
                return BasicFoodRepository.getInstance();
            case FoodRepositoryType.SUPABASE:
                // TODO: Supabaseリポジトリの実装
                throw new Error('Supabaseリポジトリは未実装です');
            default:
                return BasicFoodRepository.getInstance();
        }
    }
} 