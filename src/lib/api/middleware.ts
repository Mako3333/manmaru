import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '../error/types/base-error';
import { ErrorCode } from '../error/codes/error-codes';
import { createErrorResponse, getHttpStatusCode } from './response';

/**
 * APIハンドラーの型定義
 */
export type ApiHandler<T = NextResponse> = (
    req: NextRequest,
    context: { params: Record<string, string> }
) => Promise<T>;

/**
 * エラーハンドリングミドルウェア
 */
export function withErrorHandling(handler: ApiHandler<NextResponse>) {
    return async (
        req: NextRequest,
        context: { params: Record<string, string> }
    ): Promise<NextResponse> => {
        const startTime = Date.now();

        try {
            const resultResponse = await handler(req, context);

            if (!(resultResponse instanceof NextResponse)) {
                console.error("API handler did not return a NextResponse object:", resultResponse);
                throw new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: "API handler returned invalid response type."
                });
            }

            return resultResponse;
        } catch (error) {
            console.error('API Error caught by middleware:', error);

            const appError = error instanceof AppError
                ? error
                : new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: error instanceof Error ? error.message : '不明なエラーが発生しました',
                    originalError: error instanceof Error ? error : undefined,
                    severity: 'error'
                });

            const errorResponse = createErrorResponse(appError, {
                processingTimeMs: Date.now() - startTime
            });

            return errorResponse;
        }
    };
}

/**
 * 認証とエラーハンドリングを組み合わせたミドルウェア
 */
export function withAuthAndErrorHandling(
    handler: ApiHandler<NextResponse>,
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

            // ハンドラを実行し、NextResponseを受け取る
            const resultResponse = await handler(req, context);

            // ハンドラが NextResponse を返したかチェック
            if (!(resultResponse instanceof NextResponse)) {
                console.error("API handler (withAuth) did not return a NextResponse object:", resultResponse);
                throw new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: "API handler returned invalid response type."
                });
            }

            // ハンドラが生成した NextResponse をそのまま返す
            return resultResponse;

        } catch (error) {
            // エラーログ改善
            console.error('API Error caught by auth middleware:', error);

            // AppError インスタンス生成を withErrorHandling と同様に
            const appError = error instanceof AppError
                ? error
                : new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: error instanceof Error ? error.message : '不明なエラーが発生しました',
                    originalError: error instanceof Error ? error : undefined,
                    severity: 'error'
                });

            // createErrorResponse でエラーレスポンス生成
            const errorResponse = createErrorResponse(appError, {
                processingTimeMs: Date.now() - startTime
            });

            // 生成した NextResponse をそのまま return
            return errorResponse;
        }
    };
} 