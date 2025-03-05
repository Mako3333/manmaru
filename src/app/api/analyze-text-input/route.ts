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
    }))
});

// テキスト入力解析のAPIエンドポイント
export const POST = withErrorHandling(async (request: Request) => {
    console.log('テキスト解析リクエスト受信');
    const body = await request.json();
    console.log('リクエストボディ:', body);

    // リクエストデータの検証
    const { foods } = RequestSchema.parse(body);

    // 食品データがない場合はエラー
    if (!foods || foods.length === 0) {
        throw new AIError(
            '食品データが必要です',
            ErrorCode.VALIDATION_ERROR,
            null,
            ['少なくとも1つの食品を入力してください']
        );
    }

    // AIサービスのインスタンスを取得
    const aiService = AIService.getInstance();

    // テキスト入力を解析
    const result = await aiService.analyzeTextInput(foods as FoodInput[]);

    console.log('テキスト解析API: 解析成功', JSON.stringify(result).substring(0, 100) + '...');

    return NextResponse.json(result);
});