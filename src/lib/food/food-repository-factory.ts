import { FoodRepository } from './food-repository';
import { BasicFoodRepository } from './basic-food-repository';
import { AppError, ErrorCode } from '@/lib/error';

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
                throw new AppError({
                    code: ErrorCode.Base.NOT_IMPLEMENTED,
                    message: 'Supabase food repository is not implemented yet.',
                    userMessage: '現在この機能は利用できません。'
                });
            default:
                return BasicFoodRepository.getInstance();
        }
    }
} 