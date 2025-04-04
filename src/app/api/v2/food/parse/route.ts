import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api/middleware';
import { FoodInputParser } from '@/lib/food/food-input-parser';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { z } from 'zod';
import { parseFoodInputText } from '@/lib/food/food-parsing-service';

/**
 * 食品テキスト解析API v2
 * テキスト入力から食品情報を解析し、名前と量のペアを返す
 */

const requestSchema = z.object({
    text: z.string().min(1, "テキスト入力は必須です"),
    // trimester はこのエンドポイントでは使用しないため削除 (必要なら残す)
    // trimester: z.number().int().min(1).max(3).optional()
});

export const POST = withErrorHandling(async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestData = await req.json();

    try {
        const validatedData = requestSchema.parse(requestData);
        const text = validatedData.text.trim();

        const parseResult = await parseFoodInputText(text);

        if (parseResult.error) {
            throw parseResult.error;
        }

        const foods = parseResult.foods;

        if (!foods || foods.length === 0) {
            throw new AppError({
                code: ErrorCode.Nutrition.FOOD_NOT_FOUND,
                message: '食品が検出されませんでした',
                userMessage: '入力テキストから食品を検出できませんでした。別の入力をお試しください。',
                details: { reason: `Food parsing service (source: ${parseResult.analysisSource}) could not detect any food items.` }
            });
        }

        let nameQuantityPairs;
        try {
            nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(foods);
        } catch (pairError) {
            // console.error('Error generating name quantity pairs:', pairError); // 本番では logger を使う想定
            throw new AppError({
                code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                message: `Error generating name-quantity pairs: ${pairError instanceof Error ? pairError.message : String(pairError)}`,
                userMessage: "解析結果の整形中に問題が発生しました。",
                originalError: pairError instanceof Error ? pairError : undefined
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                foods,
                originalText: text,
                parsedItems: nameQuantityPairs,
                ...(parseResult.confidence !== undefined ? { confidence: parseResult.confidence } : {}),
            },
            meta: {
                processingTimeMs: Date.now() - startTime,
                analysisSource: parseResult.analysisSource
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '入力データが無効です',
                userMessage: "入力内容に誤りがあります。確認してください。",
                details: {
                    reason: error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
                    originalError: error
                }
            });
        }

        if (error instanceof AppError) {
            throw error;
        }

        // console.error('Unhandled error in /food/parse:', error); // 本番では logger を使う想定
        throw new AppError({
            code: ErrorCode.Base.UNKNOWN_ERROR,
            message: `Unhandled error in /food/parse: ${error instanceof Error ? error.message : String(error)}`,
            userMessage: "サーバー内部で予期しない問題が発生しました。",
            originalError: error instanceof Error ? error : undefined
        });
    }
});

export const OPTIONS = withErrorHandling(async () => {
    return NextResponse.json({ success: true, data: { message: 'OK' } });
}); 