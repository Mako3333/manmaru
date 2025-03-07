import { NextResponse } from "next/server";
import { z } from "zod";
import { AIService, FoodInput } from '@/lib/ai/ai-service';
import { AIError, ErrorCode } from '@/lib/errors/ai-error';
import { withErrorHandling } from '@/lib/errors/error-utils';

// リクエスト用のZodスキーマ
const RequestSchema = z.object({
    foods: z.array(z.object({
        name: z.string(),
        quantity: z.string().optional()
    })),
    mealType: z.string().optional()
});

// テキスト入力解析のAPIエンドポイント
export const POST = withErrorHandling(async (request: Request) => {
    console.log('テキスト解析API: リクエスト受信');

    try {
        const body = await request.json();
        console.log('テキスト解析API: リクエストボディ:', body);

        // リクエストデータの検証
        const validatedData = RequestSchema.parse(body);
        const { foods, mealType = 'その他' } = validatedData;

        // 食品データがない場合はエラー
        if (!foods || foods.length === 0) {
            console.log('テキスト解析API: 食品データなしエラー');
            throw new AIError(
                '食品データが必要です',
                ErrorCode.VALIDATION_ERROR,
                null,
                ['少なくとも1つの食品を入力してください']
            );
        }

        // 空の食品名をフィルタリング
        const validFoods = foods.filter(food => food.name && food.name.trim() !== '');

        if (validFoods.length === 0) {
            console.log('テキスト解析API: 有効な食品データなしエラー');
            throw new AIError(
                '有効な食品データが必要です',
                ErrorCode.VALIDATION_ERROR,
                null,
                ['少なくとも1つの有効な食品名を入力してください']
            );
        }

        // AIサービスのインスタンスを取得
        const aiService = AIService.getInstance();

        // テキスト入力を解析
        console.log('テキスト解析API: 解析開始', { foodsCount: validFoods.length, mealType });
        const result = await aiService.analyzeTextInput(validFoods as FoodInput[], mealType);

        console.log('テキスト解析API: 解析成功', {
            foodsCount: result.foods.length,
            calories: result.nutrition.calories,
            protein: result.nutrition.protein
        });

        return NextResponse.json({
            success: true,
            enhancedFoods: result.foods,
            ...result
        });
    } catch (error) {
        console.error('テキスト解析API: エラー発生', error);

        if (error instanceof AIError) {
            return NextResponse.json({
                success: false,
                error: error.message,
                code: error.code,
                details: error.details
            }, { status: 400 });
        }

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                success: false,
                error: '入力データが不正です',
                code: ErrorCode.VALIDATION_ERROR,
                details: error.errors.map(e => e.message)
            }, { status: 400 });
        }

        return NextResponse.json({
            success: false,
            error: 'テキスト解析中にエラーが発生しました',
            code: ErrorCode.UNKNOWN_ERROR
        }, { status: 500 });
    }
});