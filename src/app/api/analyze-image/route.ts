//src\app\api\analyze-image\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { FoodInputParser } from '@/lib/food/food-input-parser';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';

export async function POST(request: NextRequest) {
    try {
        // フォームデータからファイルを取得
        const formData = await request.formData();
        const file = formData.get('image') as File;

        if (!file) {
            return NextResponse.json(
                { error: '画像ファイルが提供されていません' },
                { status: 400 }
            );
        }

        // ファイルをバッファに変換
        const buffer = Buffer.from(await file.arrayBuffer());

        // AIサービスの取得と画像解析
        const aiService = AIServiceFactory.getService();
        const aiResult = await aiService.analyzeMealImage(buffer);

        if (aiResult.error) {
            return NextResponse.json(
                { error: aiResult.error },
                { status: 500 }
            );
        }

        // 食品入力解析結果から名前と量のペアを生成
        const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(
            aiResult.parseResult.foods
        );

        // 栄養計算サービスの取得と栄養計算
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
        console.error('画像解析API エラー:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: '画像解析中にエラーが発生しました: ' + errorMessage },
            { status: 500 }
        );
    }
} 