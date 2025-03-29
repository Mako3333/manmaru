import { NextRequest, NextResponse } from 'next/server';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';

/**
 * エラーハンドリングミドルウェア
 * 
 * API処理のエラーハンドリングをラップする関数
 * @param handler APIハンドラー関数
 * @returns 処理結果
 */
export const withErrorHandling = (
    handler: (req: NextRequest) => Promise<NextResponse>
) => {
    return async (req: NextRequest) => {
        try {
            return await handler(req);
        } catch (error) {
            console.error('API Error:', error);

            if (error instanceof ApiError) {
                return createErrorResponse(
                    error.userMessage,
                    error.code,
                    error.statusCode,
                    error.details
                );
            }

            return createErrorResponse(
                'サーバーエラーが発生しました。しばらく経ってから再度お試しください。',
                ErrorCode.UNKNOWN_ERROR,
                500,
                process.env.NODE_ENV === 'development'
                    ? { message: error instanceof Error ? error.message : String(error) }
                    : undefined
            );
        }
    };
};

/**
 * エラーレスポンスを作成
 * 
 * 共通フォーマットのエラーレスポンスを生成
 * @param message エラーメッセージ
 * @param code エラーコード
 * @param status HTTPステータスコード
 * @param details 詳細情報
 * @returns NextResponseオブジェクト
 */
export const createErrorResponse = (
    message: string,
    code: string = ErrorCode.UNKNOWN_ERROR,
    status: number = 500,
    details?: any
) => {
    return NextResponse.json(
        {
            success: false,
            error: message,
            errorCode: code,
            details
        },
        { status }
    );
}; 