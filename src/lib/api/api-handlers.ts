import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ApiError, AppError, ErrorCode } from '@/lib/errors/app-errors';
import { validateRequestParams } from '@/lib/validation/response-validators';

/**
 * APIエンドポイントハンドラの型定義
 */
type ApiHandler = (
    req: NextRequest,
    context: { params: Record<string, string>; user: any }
) => Promise<NextResponse>;

/**
 * セッション認証とエラーハンドリングを備えたAPIハンドララッパー
 */
export function withAuthAndErrorHandling(handler: ApiHandler) {
    return async (req: NextRequest, { params }: { params: Record<string, string> }) => {
        try {
            // ユーザー認証確認
            const supabase = createRouteHandlerClient({ cookies });
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                return NextResponse.json(
                    { error: '認証が必要です', code: ErrorCode.AUTH_REQUIRED },
                    { status: 401 }
                );
            }

            // ハンドラ実行
            return await handler(req, { params, user });

        } catch (error) {
            console.error('API error:', error);

            // APIエラーの場合
            if (error instanceof ApiError) {
                return NextResponse.json(
                    {
                        error: error.userMessage,
                        code: error.code,
                        details: process.env.NODE_ENV === 'development' ? error.details : undefined
                    },
                    { status: error.statusCode }
                );
            }

            // AppErrorの場合
            if (error instanceof AppError) {
                return NextResponse.json(
                    {
                        error: error.userMessage,
                        code: error.code,
                        details: process.env.NODE_ENV === 'development' ? error.details : undefined
                    },
                    { status: getStatusCodeFromErrorCode(error.code) }
                );
            }

            // その他のエラー
            return NextResponse.json(
                {
                    error: 'サーバーエラーが発生しました',
                    code: ErrorCode.UNKNOWN_ERROR,
                    details: process.env.NODE_ENV === 'development'
                        ? error instanceof Error ? error.message : String(error)
                        : undefined
                },
                { status: 500 }
            );
        }
    };
}

/**
 * リクエストデータを検証するヘルパー関数
 */
export async function validateRequestData<T>(
    request: NextRequest,
    requiredFields: string[] = []
): Promise<T> {
    try {
        const data = await request.json();
        const validation = validateRequestParams<T>(data, requiredFields);

        if (!validation.isValid) {
            throw new ApiError(
                `リクエストデータ検証エラー: ${validation.errorMessage}`,
                ErrorCode.DATA_VALIDATION_ERROR,
                validation.errorMessage,
                400
            );
        }

        return validation.data as T;
    } catch (error) {
        if (error instanceof ApiError) throw error;

        throw new ApiError(
            `リクエストデータ検証エラー: ${error instanceof Error ? error.message : String(error)}`,
            ErrorCode.DATA_VALIDATION_ERROR,
            '無効なリクエストデータです',
            400
        );
    }
}

/**
 * エラーコードからHTTPステータスコードを取得
 */
function getStatusCodeFromErrorCode(code: ErrorCode): number {
    switch (code) {
        case ErrorCode.AUTH_REQUIRED:
        case ErrorCode.AUTH_INVALID:
        case ErrorCode.AUTH_EXPIRED:
            return 401;

        case ErrorCode.DATA_VALIDATION_ERROR:
            return 400;

        case ErrorCode.DATA_NOT_FOUND:
            return 404;

        case ErrorCode.RATE_LIMIT_EXCEEDED:
        case ErrorCode.QUOTA_EXCEEDED:
            return 429;

        default:
            return 500;
    }
}

/**
 * レスポンスデータの作成
 */
export function createSuccessResponse<T>(data: T, message?: string) {
    return {
        success: true,
        data,
        ...(message ? { message } : {})
    };
} 