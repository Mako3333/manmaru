import { AppError, ErrorOptions } from './base-error';
import { ErrorCode } from '../codes/error-codes';

/**
 * AI解析に関連するエラー
 */
export class AIAnalysisError extends AppError {
    constructor(
        message: string,
        inputType: 'text' | 'image',
        details?: Record<string, unknown>,
        originalError?: Error
    ) {
        const options: ErrorOptions = {
            code: ErrorCode.AI.ANALYSIS_ERROR,
            message,
            userMessage: `AI解析中にエラーが発生しました（${inputType}入力）`,
            details: { inputType, ...(details || {}) },
            severity: 'error',
            suggestions: [
                'しばらく経ってから再度お試しください',
                '別の入力方法をお試しください'
            ],
            originalError
        };
        super(options);
    }
}

/**
 * AI応答の解析エラー
 */
export class AIParsingError extends AppError {
    constructor(
        message: string,
        response?: string,
        originalError?: Error
    ) {
        const options: ErrorOptions = {
            code: ErrorCode.AI.PARSING_ERROR,
            message,
            userMessage: 'AI応答の解析に失敗しました',
            details: { response },
            severity: 'error',
            suggestions: [
                'しばらく経ってから再度お試しください',
                'より簡潔な入力を試してください'
            ],
            originalError
        };
        super(options);
    }
}

/**
 * 画像処理エラー
 */
export class ImageProcessingError extends AppError {
    constructor(
        message: string,
        imageInfo?: { size?: number; format?: string },
        originalError?: Error
    ) {
        const options: ErrorOptions = {
            code: ErrorCode.AI.IMAGE_PROCESSING_ERROR,
            message,
            userMessage: '画像の処理中にエラーが発生しました',
            details: { imageInfo },
            severity: 'error',
            suggestions: [
                '画像のサイズを小さくしてください',
                '別の画像形式（JPG、PNG）を試してください',
                '画像が破損していないか確認してください'
            ],
            originalError
        };
        super(options);
    }
}

/**
 * AI APIリクエストエラー
 */
export class AIApiRequestError extends AppError {
    constructor(
        message: string,
        endpoint?: string,
        originalError?: Error
    ) {
        const options: ErrorOptions = {
            code: ErrorCode.AI.API_REQUEST_ERROR,
            message,
            userMessage: 'AIサービスとの通信中にエラーが発生しました',
            details: { endpoint },
            severity: 'error',
            suggestions: [
                'インターネット接続を確認してください',
                'しばらく経ってから再度お試しください'
            ],
            originalError
        };
        super(options);
    }
} 