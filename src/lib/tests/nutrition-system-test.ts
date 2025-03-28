/**
 * 栄養素計算システム移行テスト
 */
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodInputParser, FoodInputParseResult } from '@/lib/food/food-input-parser';
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';

/**
 * テスト用の食品データ
 */
const TEST_FOODS: FoodInputParseResult[] = [
    { foodName: 'ご飯', quantityText: 'お茶碗1杯', confidence: 0.9 },
    { foodName: 'みそ汁', quantityText: '1杯', confidence: 0.9 },
    { foodName: '焼き鮭', quantityText: '1切れ', confidence: 0.9 },
    { foodName: 'ほうれん草のおひたし', quantityText: '小鉢1杯', confidence: 0.9 },
    { foodName: '納豆', quantityText: '1パック', confidence: 0.9 }
];

/**
 * テスト用のテキスト入力
 */
const TEST_TEXT_INPUT = 'ご飯1杯、みそ汁、焼鮭1切れ、ほうれん草のおひたし、納豆';

/**
 * 簡易テスト実行関数
 */
async function runTest() {
    console.log('=== 栄養計算システム移行テスト ===');

    // 1. 食品リポジトリのテスト
    try {
        console.log('\n--- 食品リポジトリテスト ---');
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const foodNames = ['ご飯', '豚肉', 'りんご', 'にんじん', '牛乳'];

        console.log('基本食品の検索:');
        for (const name of foodNames) {
            const result = await foodRepo.getFoodByExactName(name);
            console.log(`- "${name}": ${result ? '見つかりました' : '見つかりませんでした'}`);
            if (result) {
                console.log(`  カテゴリ: ${result.category}, ID: ${result.id}`);
            }
        }
    } catch (error) {
        console.error('食品リポジトリテスト失敗:', error);
    }

    // 2. 栄養計算サービスのテスト
    try {
        console.log('\n--- 栄養計算サービステスト ---');
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);

        // 食品と量のペアを生成
        const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(TEST_FOODS);
        console.log('入力食品:', nameQuantityPairs);

        // 栄養計算を実行
        const result = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);
        console.log('栄養計算結果:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('栄養計算サービステスト失敗:', error);
    }

    // 3. 食品マッチングサービスのテスト
    try {
        console.log('\n--- 食品マッチングサービステスト ---');
        const matchingService = FoodMatchingServiceFactory.getService(FoodRepositoryType.BASIC);

        const testFoods = ['ご飯', '豚肉', 'りんご', 'キャベツ', '牛乳', 'うどん', '竹輪'];
        for (const food of testFoods) {
            const result = await matchingService.matchFood(food);
            console.log(`"${food}" の最適マッチ:`, result ?
                `"${result.food.name}" (類似度: ${result.similarity.toFixed(2)})` :
                '見つかりませんでした');
        }
    } catch (error) {
        console.error('食品マッチングサービステスト失敗:', error);
    }

    // 4. AIサービスのテスト
    try {
        console.log('\n--- AIサービステスト ---');
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

        // テキスト入力のテスト
        console.log('テキスト入力解析:');
        const textResult = await aiService.analyzeMealText(TEST_TEXT_INPUT);

        console.log('解析結果:');
        console.log('- 食品数:', textResult.parseResult.foods.length);
        console.log('- 確信度:', textResult.parseResult.confidence);
        console.log('- 処理時間:', textResult.processingTimeMs, 'ms');
        console.log('- 食品リスト:');
        textResult.parseResult.foods.forEach(f => {
            console.log(`  - ${f.foodName} ${f.quantityText || '(量なし)'}`);
        });

        if (textResult.error) {
            console.error('AIサービスエラー:', textResult.error);
        }
    } catch (error) {
        console.error('AIサービステスト失敗:', error);
    }

    console.log('\n=== テスト完了 ===');
}

// テスト実行
export const runNutritionSystemTest = async () => {
    console.log('栄養計算システム移行テストを開始します...');
    await runTest();
    return 'テスト完了';
};

export default runNutritionSystemTest; 