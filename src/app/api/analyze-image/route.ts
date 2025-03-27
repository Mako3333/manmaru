//src\app\api\analyze-image\route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { AIService } from "@/lib/ai/ai-service";
import { AIError, ErrorCode, createErrorResponse } from "@/lib/errors/ai-error";
import { withErrorHandling } from "@/lib/errors/error-utils";

// リクエスト用のZodスキーマ
const RequestSchema = z.object({
    imageBase64: z.string(),
    mimeType: z.string().optional().default('image/jpeg')
});

// 画像解析のAPIエンドポイント
export const POST = withErrorHandling(async (request: Request) => {
    console.log('画像解析リクエスト受信');
    const body = await request.json();

    // リクエストデータの検証
    const { imageBase64, mimeType } = RequestSchema.parse(body);

    // 画像データがない場合はエラー
    if (!imageBase64) {
        throw new AIError(
            '画像データが必要です',
            ErrorCode.VALIDATION_ERROR,
            null,
            ['画像データを提供してください', 'テキスト入力で食品を記録することもできます']
        );
    }

    try {
        // AIサービスのインスタンスを取得
        const aiService = AIService.getInstance();

        // 食事タイプは「その他」として解析
        const result = await aiService.analyzeMeal(imageBase64, 'その他');

        console.log('画像解析API: 解析成功', JSON.stringify(result).substring(0, 100) + '...');

        // 結果を返却
        return NextResponse.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('画像解析APIエラー:', error);

        // AIErrorの場合は詳細なエラー情報を返す
        if (error instanceof AIError) {
            return NextResponse.json(
                createErrorResponse(error),
                { status: getStatusCodeForError(error.code) }
            );
        }

        // その他のエラーは汎用エラーに変換
        const genericError = new AIError(
            '画像の解析中にエラーが発生しました',
            ErrorCode.INTERNAL_ERROR,
            error,
            ['別の画像をお試しください', 'テキスト入力で食品を記録することもできます']
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
        case ErrorCode.INVALID_IMAGE:
            return 415; // Unsupported Media Type
        default:
            return 500; // Internal Server Error
    }
} 