import { AppError, ErrorCode } from '../errors/app-errors';

/**
 * AI解析関連のエラーハンドリング
 */
export class AIErrorHandler {
    /**
     * AI解析の一般的なエラーを処理
     */
    static handleAnalysisError(error: unknown, inputType: 'text' | 'image'): AppError {
        if (error instanceof AppError) {
            return error;
        }

        const message = error instanceof Error ? error.message : '不明なエラー';
        const inputTypeText = inputType === 'text' ? 'テキスト' : '画像';

        return new AppError(
            `AI${inputTypeText}解析でエラーが発生しました: ${message}`,
            ErrorCode.AI_ANALYSIS_FAILED,
            `${inputTypeText}の解析中にエラーが発生しました。しばらく経ってから再度お試しください。`,
            { inputType, originalError: error },
            'error',
            [
                '別の入力方法をお試しください',
                'インターネット接続を確認してください',
                'サービスの状態を確認してください'
            ],
            error instanceof Error ? error : undefined
        );
    }

    /**
     * AI応答パース時のエラーを処理
     */
    static responseParseError(error: unknown, response?: string): AppError {
        if (error instanceof AppError) {
            return error;
        }

        const message = error instanceof Error ? error.message : '不明なエラー';
        return new AppError(
            `AI応答の解析に失敗しました: ${message}`,
            ErrorCode.AI_PARSING_ERROR,
            'AIからの応答を解析できませんでした。別の入力をお試しください。',
            {
                response: response ? (response.length > 500 ? response.substring(0, 500) + '...' : response) : undefined,
                originalError: error
            },
            'error',
            [
                'より明確な表現で入力してみてください',
                '複雑な食事内容は複数回に分けて入力してください'
            ],
            error instanceof Error ? error : undefined
        );
    }

    /**
     * AI APIリクエスト時のエラーを処理
     */
    static apiRequestError(error: unknown, endpoint?: string): AppError {
        if (error instanceof AppError) {
            return error;
        }

        const message = error instanceof Error ? error.message : '不明なエラー';
        return new AppError(
            `AIサービスへのリクエストに失敗しました: ${message}`,
            ErrorCode.API_REQUEST_FAILED,
            'AIサービスとの通信中にエラーが発生しました。しばらく経ってから再度お試しください。',
            { endpoint, originalError: error },
            'error',
            [
                'インターネット接続を確認してください',
                '別の入力方法をお試しください'
            ],
            error instanceof Error ? error : undefined
        );
    }

    /**
     * 画像処理時のエラーを処理
     */
    static imageProcessingError(error: unknown, details?: string): AppError {
        if (error instanceof AppError) {
            return error;
        }

        const message = error instanceof Error ? error.message : '不明なエラー';
        return new AppError(
            `画像処理でエラーが発生しました: ${message}`,
            ErrorCode.FILE_PROCESSING_ERROR,
            `画像の処理中にエラーが発生しました${details ? `：${details}` : ''}。別の画像をお試しください。`,
            { details, originalError: error },
            'error',
            [
                '別の画像をアップロードしてください',
                '画像の解像度や形式を変更してみてください',
                '明るい場所で撮影した画像を使用してください'
            ],
            error instanceof Error ? error : undefined
        );
    }
} 