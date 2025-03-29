import { AppError } from '../error/types/base-error';

/**
 * APIレスポンスのメタデータ
 */
export interface ApiResponseMeta {
    /** 処理時間（ミリ秒） */
    processingTimeMs?: number | undefined;
    /** 警告メッセージ */
    warning?: string | undefined;
    /** ページネーション情報 */
    pagination?: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    } | undefined;
}

/**
 * APIレスポンスのエラー情報
 */
export interface ApiResponseError {
    /** エラーコード */
    code: string;
    /** エラーメッセージ */
    message: string;
    /** エラーの詳細情報 */
    details?: unknown | undefined;
    /** 解決のための提案 */
    suggestions?: string[] | undefined;
}

/**
 * 統一APIレスポンス形式
 */
export interface ApiResponse<T> {
    /** 処理の成功・失敗 */
    success: boolean;
    /** レスポンスデータ */
    data?: T | undefined;
    /** エラー情報 */
    error?: ApiResponseError | undefined;
    /** メタデータ */
    meta?: ApiResponseMeta | undefined;
}

/**
 * 成功レスポンスを生成
 */
export function createSuccessResponse<T>(
    data: T,
    meta?: ApiResponseMeta
): ApiResponse<T> {
    return {
        success: true,
        data,
        meta
    };
}

/**
 * エラーレスポンスを生成
 */
export function createErrorResponse(
    error: AppError,
    meta?: ApiResponseMeta
): ApiResponse<never> {
    return {
        success: false,
        error: {
            code: error.code,
            message: error.userMessage,
            details: error.details,
            suggestions: error.suggestions
        },
        meta
    };
}

/**
 * エラーコードに基づいてHTTPステータスコードを取得
 */
export function getHttpStatusCode(error: AppError): number {
    // エラーコードの先頭部分を取得（例：auth_error → auth）
    const errorType = error.code.split('_')[0];

    switch (errorType) {
        case 'auth':
            return 401; // Unauthorized
        case 'forbidden':
            return 403; // Forbidden
        case 'not':
            return 404; // Not Found
        case 'validation':
            return 400; // Bad Request
        case 'rate':
        case 'quota':
            return 429; // Too Many Requests
        case 'server':
            return 500; // Internal Server Error
        default:
            return 400; // Bad Request
    }
} 