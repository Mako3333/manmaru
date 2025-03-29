import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '../error/types/base-error';
import { ErrorCode } from '../error/codes/error-codes';
import { createSuccessResponse, createErrorResponse, getHttpStatusCode } from './response';

/**
 * APIハンドラーの型定義
 */
export type ApiHandler<T> = (
    req: NextRequest,
    context: { params: Record<string, string> }
) => Promise<T>;

/**
 * エラーハンドリングミドルウェア
 */
export function withErrorHandling<T>(handler: ApiHandler<T>) {
    return async (
        req: NextRequest,
        context: { params: Record<string, string> }
    ): Promise<NextResponse> => {
        const startTime = Date.now();

        try {
            const result = await handler(req, context);
            return NextResponse.json(
                createSuccessResponse(result, {
                    processingTimeMs: Date.now() - startTime
                })
            );
        } catch (error) {
            console.error('API Error:', error);

            const appError = error instanceof AppError
                ? error
                : new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: error instanceof Error ? error.message : '不明なエラーが発生しました',
                    details: error,
                    severity: 'error'
                });

            return NextResponse.json(
                createErrorResponse(appError, {
                    processingTimeMs: Date.now() - startTime
                }),
                { status: getHttpStatusCode(appError) }
            );
        }
    };
}

/**
 * 認証とエラーハンドリングを組み合わせたミドルウェア
 */
export function withAuthAndErrorHandling<T>(
    handler: ApiHandler<T>,
    requireAuth = true
) {
    return async (
        req: NextRequest,
        context: { params: Record<string, string> }
    ): Promise<NextResponse> => {
        const startTime = Date.now();

        try {
            // 認証チェック
            if (requireAuth) {
                const authHeader = req.headers.get('authorization');
                if (!authHeader) {
                    throw new AppError({
                        code: ErrorCode.Base.AUTH_ERROR,
                        message: '認証が必要です',
                        severity: 'error'
                    });
                }
                // TODO: 実際の認証ロジックを実装
            }

            const result = await handler(req, context);
            return NextResponse.json(
                createSuccessResponse(result, {
                    processingTimeMs: Date.now() - startTime
                })
            );
        } catch (error) {
            console.error('API Error:', error);

            const appError = error instanceof AppError
                ? error
                : new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: error instanceof Error ? error.message : '不明なエラーが発生しました',
                    details: error,
                    severity: 'error'
                });

            return NextResponse.json(
                createErrorResponse(appError, {
                    processingTimeMs: Date.now() - startTime
                }),
                { status: getHttpStatusCode(appError) }
            );
        }
    };
} 