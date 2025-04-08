import { toast } from 'react-hot-toast';
import { AppError } from './types/base-error';

type ErrorHandlerOptions = {
    showToast?: boolean;
    rethrow?: boolean;
    toastOptions?: {
        title?: string;
        duration?: number;
    };
    logger?: (message: string, error: unknown) => void;
};

/**
 * 統一されたエラーハンドリング関数
 * @param error エラーオブジェクト
 * @param options ハンドリングオプション
 */
export function handleError(error: unknown, options?: ErrorHandlerOptions): void {
    const defaultOptions: ErrorHandlerOptions = {
        showToast: true,
        rethrow: false,
        toastOptions: {
            title: 'エラーが発生しました',
            duration: 4000
        },
        logger: console.error
    };

    const opts = { ...defaultOptions, ...options };

    // エラーをログに記録
    if (opts.logger) {
        if (error instanceof AppError) {
            opts.logger(`[AppError] ${error.code}: ${error.message}`, error);
        } else if (error instanceof Error) {
            opts.logger(`[Error] ${error.name}: ${error.message}`, error);
        } else {
            opts.logger('[Unknown Error]', error);
        }
    }

    // トースト通知
    if (opts.showToast) {
        const message = error instanceof AppError
            ? error.userMessage || error.message
            : error instanceof Error
                ? error.message
                : '予期しないエラーが発生しました';

        toast.error(`${opts.toastOptions?.title || 'エラーが発生しました'}: ${message}`);
    }

    // エラーを再スロー
    if (opts.rethrow) {
        throw error;
    }
} 