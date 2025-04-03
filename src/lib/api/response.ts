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
    // エラーコードに基づいてHTTPステータスコードを決定
    const code = error.code;

    // より具体的なエラーコードのマッピング
    if (code.startsWith('auth_')) return 401; // Unauthorized
    if (code.startsWith('forbidden_')) return 403; // Forbidden
    if (code.startsWith('not_found')) return 404; // Not Found
    if (code.startsWith('validation_') || code.startsWith('data_validation_') || code.startsWith('invalid_')) return 400; // Bad Request (Validation or Invalid input)
    if (code.startsWith('rate_limit') || code.startsWith('quota_')) return 429; // Too Many Requests

    // サーバーサイドまたは外部サービス起因のエラーは500 Internal Server Error
    if (
        code.startsWith('server_') ||
        code.startsWith('database_') ||
        code.startsWith('ai_') ||
        code.startsWith('image_') ||
        code.startsWith('gemini_') ||
        code.startsWith('nutrition_') ||
        code.startsWith('file_') // file_* も一旦500とする (例: file_read_error)
    ) {
        return 500;
    }

    // api_errorは汎用的な内部サーバーエラーとして500を返す
    if (code.startsWith('api_')) return 500;

    // 上記以外は予期せぬ内部エラーとして500を返す
    console.warn(`Unknown error code prefix encountered: ${code}. Defaulting to 500.`);
    return 500;
} 