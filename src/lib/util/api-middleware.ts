import { NextRequest, NextResponse } from 'next/server';
import { AppError, ErrorCode, ApiError } from '../errors/app-errors';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { StandardApiResponse, SuccessResponse, ErrorResponse } from '@/types/api';

// 下位互換性のための型エイリアス
export type ApiResponse<T> = StandardApiResponse<T>;

/**
 * ハンドラー関数の型
 */
export type ApiHandler<T = any> = (
    req: NextRequest,
    context: { params: unknown },
    session: unknown
) => Promise<StandardApiResponse<T>>;

/**
 * 認証とエラーハンドリングを含むAPIミドルウェア
 * @param handler APIハンドラー関数
 * @param requireAuth 認証が必要かどうか
 */
export function withAuthAndErrorHandling<T>(
    handler: ApiHandler<T>,
    requireAuth: boolean = true
) {
    return async (req: NextRequest, context: { params: any }) => {
        const startTime = Date.now();

        try {
            // セッション変数を条件文の前で初期化
            let session = null;

            if (requireAuth) {
                const cookieStore = cookies();
                const supabase = createServerComponentClient({
                    cookies: () => cookieStore
                });
                const { data } = await supabase.auth.getSession();
                session = data.session;

                if (!session) {
                    throw new ApiError(
                        '認証が必要です',
                        ErrorCode.AUTH_REQUIRED,
                        'このAPIを使用するにはログインが必要です',
                        401
                    );
                }
            }

            // 常にsessionを渡せるようになる
            const result = await handler(req, context, session);

            // 処理時間の追加（ある場合のみ）
            if (!result.meta) {
                result.meta = {};
            }
            result.meta.processingTimeMs = Date.now() - startTime;

            // 成功レスポンスの返却
            return NextResponse.json(result, { status: 200 });

        } catch (error) {
            // エラー処理
            const processingTimeMs = Date.now() - startTime;

            if (error instanceof ApiError) {
                // APIエラーの場合はそのまま返却
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: error.code,
                            message: error.userMessage,
                            details: error.details,
                            suggestions: error.suggestions
                        },
                        meta: { processingTimeMs }
                    },
                    { status: error.statusCode }
                );
            } else if (error instanceof AppError) {
                // 一般アプリエラーの場合はApiErrorに変換
                const apiError = new ApiError(
                    error.message,
                    error.code,
                    error.userMessage,
                    error.code === ErrorCode.AUTH_REQUIRED ? 401 :
                        error.code === ErrorCode.DATA_VALIDATION_ERROR ? 400 : 500,
                    error.details,
                    error.severity,
                    error.suggestions,
                    error.originalError
                );

                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: apiError.code,
                            message: apiError.userMessage,
                            details: apiError.details,
                            suggestions: apiError.suggestions
                        },
                        meta: { processingTimeMs }
                    },
                    { status: apiError.statusCode }
                );
            } else {
                // 未知のエラーの場合
                console.error('Unhandled API error:', error);

                const message = error instanceof Error ? error.message : '不明なエラーが発生しました';
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: ErrorCode.UNKNOWN_ERROR,
                            message: 'エラーが発生しました。しばらく経ってから再度お試しください。',
                            details: process.env.NODE_ENV === 'development' ? { message } : undefined
                        },
                        meta: { processingTimeMs }
                    },
                    { status: 500 }
                );
            }
        }
    };
}

/**
 * 型安全なAPI処理ラッパー
 * エラーハンドリングを組み込んだ簡易版
 */
export function withStandardApiResponse<T>(
    handler: (req: NextRequest, context: { params: any }) => Promise<T>
): (req: NextRequest, context: { params: any }) => Promise<NextResponse> {
    return async (req: NextRequest, context: { params: any }) => {
        const startTime = performance.now();
        try {
            const result = await handler(req, context);
            const processingTimeMs = Math.round(performance.now() - startTime);

            return createSuccessResponse(result, undefined, processingTimeMs);
        } catch (error) {
            console.error('API Error:', error);

            if (error instanceof AppError) {
                return createErrorResponse(error);
            }

            // 未知のエラーをラップ
            const appError = new AppError(
                String(error),
                ErrorCode.UNKNOWN_ERROR,
                'エラーが発生しました。しばらく経ってから再度お試しください。',
                { originalError: error },
                'error'
            );

            return createErrorResponse(appError);
        }
    };
}

/**
 * 成功応答を生成
 */
export function createSuccessResponse<T>(
    data: T,
    warning?: string,
    processingTimeMs?: number
): NextResponse {
    const response: SuccessResponse<T> = {
        success: true,
        data
    };

    if (warning || processingTimeMs) {
        response.meta = {};
        if (warning) response.meta.warning = warning;
        if (processingTimeMs) response.meta.processingTimeMs = processingTimeMs;
    }

    return NextResponse.json(response);
}

/**
 * エラー応答を生成
 */
export function createErrorResponse(error: AppError): NextResponse {
    const response: ErrorResponse = {
        success: false,
        error: {
            code: error.code,
            message: error.userMessage,
            suggestions: error.suggestions
        },
        meta: {
            processingTimeMs: 0
        }
    };

    if (process.env.NODE_ENV === 'development') {
        response.error.details = error.details as Record<string, unknown>;
    }

    const statusCode = getStatusCodeFromErrorCode(error.code);
    return NextResponse.json(response, { status: statusCode });
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
        case ErrorCode.QUANTITY_PARSE_ERROR:
            return 400;

        case ErrorCode.DATA_NOT_FOUND:
        case ErrorCode.FOOD_NOT_FOUND:
            return 404;

        case ErrorCode.RATE_LIMIT_EXCEEDED:
        case ErrorCode.QUOTA_EXCEEDED:
            return 429;

        default:
            return 500;
    }
} 