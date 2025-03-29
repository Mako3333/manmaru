import { FoodRepository } from '@/lib/food/food-repository';
import { NutritionService } from './nutrition-service';
import { NutritionServiceImpl } from './nutrition-service-impl';
import { FoodMatchingService } from '@/lib/food/food-matching-service';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';

/**
 * 栄養計算サービスファクトリ
 * 適切な栄養計算サービスインスタンスを生成する
 */
export class NutritionServiceFactory {
    // シングルトンインスタンス
    private static instance: NutritionServiceFactory;

    // 現在のサービスインスタンス
    private currentService: NutritionService | null = null;

    /**
     * プライベートコンストラクタ（シングルトン）
     */
    private constructor() { }

    /**
     * ファクトリインスタンスの取得
     */
    public static getInstance(): NutritionServiceFactory {
        if (!NutritionServiceFactory.instance) {
            NutritionServiceFactory.instance = new NutritionServiceFactory();
        }
        return NutritionServiceFactory.instance;
    }

    /**
     * 栄養計算サービスの作成
     * @param foodRepository 食品リポジトリ
     */
    public createService(foodRepository: FoodRepository): NutritionService {
        // サービスがまだ作成されていない場合のみ作成
        if (!this.currentService) {
            // FoodMatchingService を取得
            const foodMatchingService = FoodMatchingServiceFactory.getService();
            // NutritionServiceImpl に FoodMatchingService も渡す
            this.currentService = new NutritionServiceImpl(foodRepository, foodMatchingService);
        }
        return this.currentService;
    }

    /**
     * サービスのリセット（テスト用）
     */
    public resetService(): void {
        this.currentService = null;
    }
} 