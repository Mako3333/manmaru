//src\app\api\analyze-text-input\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AIServiceFactory } from '@/lib/ai/ai-service-factory';
import { FoodInputParser } from '@/lib/food/food-input-parser';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';

export async function POST(request: NextRequest) {
    try {
        // リクエストボディからテキストを取得
        const body = await request.json();
        const text = body.text;

        if (!text) {
            return NextResponse.json(
                { error: 'テキストが提供されていません' },
                { status: 400 }
            );
        }

        // AIサービスのテキスト解析を実行
        const aiService = AIServiceFactory.getService();

        // 単純なテキスト入力の場合、まずFoodInputParserで解析を試みる
        if (text.length < 100 && !text.includes('\n')) {
            const directParseResults = FoodInputParser.parseBulkInput(text);

            if (directParseResults.length > 0) {
                // 直接解析に成功した場合
                const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(
                    directParseResults
                );

                // 栄養計算サービスで栄養計算
                const foodRepository = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
                const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepository);
                const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(
                    nameQuantityPairs
                );

                return NextResponse.json({
                    foods: directParseResults,
                    nutrition: nutritionResult,
                    processingTimeMs: 0,
                    directParsed: true
                });
            }
        }

        // 直接解析できない場合はAIに依頼
        const aiResult = await aiService.analyzeMealText(text);

        if (aiResult.error) {
            return NextResponse.json(
                { error: aiResult.error },
                { status: 500 }
            );
        }

        // AIによる解析結果から栄養計算
        const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(
            aiResult.parseResult.foods
        );

        const foodRepository = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepository);
        const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(
            nameQuantityPairs
        );

        // レスポンスの作成
        return NextResponse.json({
            foods: aiResult.parseResult.foods,
            nutrition: nutritionResult,
            processingTimeMs: aiResult.processingTimeMs,
            rawResponse: process.env.NODE_ENV === 'development' ? aiResult.rawResponse : undefined
        });
    } catch (error: unknown) {
        console.error('テキスト解析API エラー:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: 'テキスト解析中にエラーが発生しました: ' + errorMessage },
            { status: 500 }
        );
    }
}