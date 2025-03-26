import { toast } from 'react-hot-toast';
import { NextResponse } from 'next/server';
import { AppError, ErrorCode, ApiError, getStatusCodeFromErrorCode, createErrorResponse } from './app-errors';

/**
 * エラーハンドラーオプション
 */
export interface ErrorHandlerOptions {
    /**
     * コンソールにログを出力するかどうか
     */
    logToConsole?: boolean;

    /**
     * トースト通知を表示するかどうか
     */
    showToast?: boolean;

    /**
     * アナリティクスにエラーを報告するかどうか
     */
    reportToAnalytics?: boolean;

    /**
     * エラーをスローするかどうか
     * falseの場合、エラーは処理されて返されるが、再スローはされない
     */
    rethrow?: boolean;

    /**
     * トーストメッセージのカスタマイズ
     */
    toastOptions?: {
        /**
         * カスタムタイトル
         */
        title?: string;

        /**
         * カスタム説明
         */
        description?: string;

        /**
         * 表示時間（ミリ秒）
         */
        duration?: number;
    };
}

/**
 * デフォルトのエラーハンドラーオプション
 */
const defaultOptions: ErrorHandlerOptions = {
    logToConsole: true,
    showToast: true,
    reportToAnalytics: process.env.NODE_ENV === 'production',
    rethrow: false,
    toastOptions: {
        duration: 4000 // 4秒
    }
};

/**
 * 汎用エラーハンドリング関数
 * クライアントサイドでエラーを処理するための共通関数
 */
export function handleError(error: unknown, options: ErrorHandlerOptions = {}): AppError {
    const opts = { ...defaultOptions, ...options };

    // エラーオブジェクトの標準化
    let appError: AppError;

    if (error instanceof AppError) {
        appError = error;
    } else if (error instanceof Error) {
        appError = new AppError(
            error.message,
            ErrorCode.UNKNOWN_ERROR,
            undefined,
            { originalMessage: error.message, stack: error.stack },
            'error',
            [],
            error
        );
    } else {
        appError = new AppError(
            String(error),
            ErrorCode.UNKNOWN_ERROR,
            undefined,
            { originalValue: error },
            'error'
        );
    }

    // コンソールログ
    if (opts.logToConsole) {
        console.error(`[${appError.name}] ${appError.code}: ${appError.message}`, appError);
    }

    // トースト通知
    if (opts.showToast && typeof toast !== 'undefined') {
        const { toastOptions } = opts;
        const title = toastOptions?.title || undefined;
        const description = toastOptions?.description || appError.userMessage;
        const duration = toastOptions?.duration || 4000;

        // エラーの深刻度に応じてトーストの種類を変える
        switch (appError.severity) {
            case 'info':
                toast.info(title || description, {
                    description: title ? description : undefined,
                    duration
                });
                break;
            case 'warning':
                toast.warning(title || description, {
                    description: title ? description : undefined,
                    duration
                });
                break;
            case 'critical':
            case 'error':
            default:
                toast.error(title || description, {
                    description: title ? description : undefined,
                    duration
                });
                break;
        }
    }

    // アナリティクスへの報告
    if (opts.reportToAnalytics) {
        // TODO: エラー追跡サービスへの連携
        // 例: Sentry.captureException(error);
    }

    // 必要に応じてエラーを再スロー
    if (opts.rethrow) {
        throw appError;
    }

    return appError;
}

/**
 * API リクエスト用のエラーハンドリング高階関数（HOF）
 * クライアントサイドでAPIリクエストを行う際のエラーハンドリングを簡単にするためのラッパー
 */
export async function withErrorHandling<T>(
    fn: () => Promise<T>,
    options?: ErrorHandlerOptions
): Promise<T | null> {
    try {
        return await fn();
    } catch (error) {
        handleError(error, options);
        return null;
    }
}

/**
 * APIレスポンスのエラーチェック
 * fetchの結果を検証し、エラーがあれば適切に処理する
 */
export async function checkApiResponse<T>(
    response: Response,
    customErrorMessage?: string
): Promise<T> {
    if (!response.ok) {
        let errorData: any;
        let statusCode = response.status;
        let errorCode = ErrorCode.API_ERROR;
        let message = customErrorMessage || 'APIリクエストに失敗しました';
        let details: any = null;

        try {
            // レスポンスのJSONデータを取得
            errorData = await response.json();

            // エラーデータが存在する場合は情報を抽出
            if (errorData && errorData.error) {
                message = errorData.error.message || message;
                errorCode = errorData.error.code || errorCode;
                details = errorData.error.details || null;
            }
        } catch (e) {
            // JSONパースエラーの場合はレスポンスのテキストを使用
            try {
                const text = await response.text();
                details = { responseText: text };
            } catch {
                details = { statusText: response.statusText };
            }
        }

        // ApiErrorをスロー
        throw new ApiError(
            message,
            errorCode,
            undefined, // userMessageは自動生成
            statusCode,
            details
        );
    }

    return await response.json() as T;
}

/**
 * API Handler用のエラーハンドリングラッパー
 * サーバーサイドのAPIハンドラーをラップしてエラー処理を統一する
 */
export function withApiErrorHandling(handler: (req: Request) => Promise<Response>) {
    return async (req: Request) => {
        try {
            return await handler(req);
        } catch (error) {
            console.error('API Error:', error);

            // AppErrorの場合
            if (error instanceof AppError) {
                return NextResponse.json(
                    createErrorResponse(error),
                    { status: error instanceof ApiError ? error.statusCode : getStatusCodeFromErrorCode(error.code) }
                );
            }

            // その他のエラーはAppErrorに変換
            const appError = new AppError(
                error instanceof Error ? error.message : String(error),
                ErrorCode.UNKNOWN_ERROR,
                undefined,
                error instanceof Error ? { stack: error.stack } : error,
                'error',
                ['しばらく経ってからもう一度お試しください'],
                error instanceof Error ? error : undefined
            );

            return NextResponse.json(
                createErrorResponse(appError),
                { status: 500 }
            );
        }
    };
} 