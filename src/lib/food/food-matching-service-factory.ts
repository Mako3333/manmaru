import { FoodMatchingService } from './food-matching-service';
import { FoodMatchingServiceImpl } from './food-matching-service-impl';
import { FoodRepositoryType } from './food-repository-factory';

/**
 * 食品マッチングサービスのファクトリクラス
 */
export class FoodMatchingServiceFactory {
    private static instance: FoodMatchingService;

    /**
     * 食品マッチングサービスのインスタンスを取得
     */
    static getService(repositoryType: FoodRepositoryType = FoodRepositoryType.BASIC): FoodMatchingService {
        if (!this.instance) {
            this.instance = new FoodMatchingServiceImpl(repositoryType);
        }
        return this.instance;
    }

    /**
     * インスタンスを強制的に再作成
     */
    static recreateService(repositoryType: FoodRepositoryType = FoodRepositoryType.BASIC): FoodMatchingService {
        this.instance = new FoodMatchingServiceImpl(repositoryType);
        return this.instance;
    }
} 