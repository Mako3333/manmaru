import { NextRequest, NextResponse } from 'next/server';
import { AppError, ErrorCode, ApiError } from '../errors/app-errors';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * レスポンス形式の統一
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
        suggestions?: string[];
    };
    meta?: {
        processingTimeMs?: number;
        warning?: string;
    };
}

/**
 * ハンドラー関数の型
 */
export type ApiHandler<T = any> = (
    req: NextRequest,
    context: { params: any },
    session: any
) => Promise<ApiResponse<T>>;

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
 * 標準的な成功レスポンスを作成
 */
export function createSuccessResponse<T>(data: T, warning?: string): ApiResponse<T> {
    return {
        success: true,
        data,
        meta: warning ? { warning } : undefined
    };
}

/**
 * 標準的なエラーレスポンスを作成
 */
export function createErrorResponse(error: AppError): ApiResponse<never> {
    return {
        success: false,
        error: {
            code: error.code,
            message: error.userMessage,
            details: error.details,
            suggestions: error.suggestions
        }
    };
} 