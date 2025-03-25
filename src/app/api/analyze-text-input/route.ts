import { NextResponse } from "next/server";
import { z } from "zod";
import { AIService, FoodInput } from '@/lib/ai/ai-service';
import { AIError, ErrorCode, createErrorResponse } from '@/lib/errors/ai-error';
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
                ['少なくとも1つの食品を入力してください', '例: ごはん、鶏肉、ほうれん草など']
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
                ['少なくとも1つの有効な食品名を入力してください', '例: ごはん、鶏肉、ほうれん草など']
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
            data: result
        });
    } catch (error) {
        console.error('テキスト解析API: エラー発生', error);

        if (error instanceof AIError) {
            return NextResponse.json(
                createErrorResponse(error),
                { status: getStatusCodeForError(error.code) }
            );
        }

        if (error instanceof z.ZodError) {
            const validationError = new AIError(
                '入力データが不正です',
                ErrorCode.VALIDATION_ERROR,
                error.errors.map(e => e.message),
                ['入力データの形式を確認してください', '正しい形式で再度お試しください']
            );
            return NextResponse.json(
                createErrorResponse(validationError),
                { status: 400 }
            );
        }

        // その他のエラーは汎用エラーに変換
        const genericError = new AIError(
            'テキスト解析中にエラーが発生しました',
            ErrorCode.INTERNAL_ERROR,
            error,
            ['入力内容を確認して再度お試しください', '別の食品名で試してみてください']
        );

        return NextResponse.json(
            createErrorResponse(genericError),
            { status: 500 }
        );
    }
});

/**
 * エラーコードに応じたHTTPステータスコードを返す
 */
function getStatusCodeForError(errorCode: ErrorCode): number {
    switch (errorCode) {
        case ErrorCode.VALIDATION_ERROR:
            return 400; // Bad Request
        case ErrorCode.AUTHENTICATION_ERROR:
            return 401; // Unauthorized
        case ErrorCode.AUTHORIZATION_ERROR:
            return 403; // Forbidden
        case ErrorCode.RESOURCE_NOT_FOUND:
            return 404; // Not Found
        case ErrorCode.RATE_LIMIT:
        case ErrorCode.RATE_LIMIT_EXCEEDED:
            return 429; // Too Many Requests
        case ErrorCode.CONTENT_FILTER:
            return 422; // Unprocessable Entity
        default:
            return 500; // Internal Server Error
    }
}