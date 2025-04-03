import { AppError } from '../error/types/base-error';
import { ErrorCode } from '../error/codes/error-codes';

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

    // 新しいエラーコード体系に対応
    switch (code) {
        // 400系エラー
        case ErrorCode.Base.DATA_VALIDATION_ERROR:
        case ErrorCode.Nutrition.FOOD_NOT_FOUND:
        case ErrorCode.Nutrition.INVALID_FOOD_DATA:
        case ErrorCode.Nutrition.INVALID_QUANTITY:
        case ErrorCode.Nutrition.QUANTITY_PARSE_ERROR:
        case ErrorCode.AI.ANALYSIS_FAILED:
            return 400; // Bad Request

        // 401系エラー
        case ErrorCode.Base.AUTH_ERROR:
            return 401; // Unauthorized

        // 404系エラー
        case ErrorCode.Base.DATA_NOT_FOUND:
        case ErrorCode.Base.NETWORK_ERROR: // ネットワークエラーは通常404を含む
            return 404; // Not Found

        // 429系エラー
        case ErrorCode.Resource.RATE_LIMIT_EXCEEDED:
        case ErrorCode.Resource.QUOTA_EXCEEDED:
            return 429; // Too Many Requests

        // 500系エラー
        case ErrorCode.Base.UNKNOWN_ERROR:
        case ErrorCode.Base.API_ERROR:
        case ErrorCode.Base.DATA_PROCESSING_ERROR:
        case ErrorCode.Nutrition.FOOD_REPOSITORY_ERROR:
        case ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR:
        case ErrorCode.Nutrition.MISSING_NUTRITION_DATA:
        case ErrorCode.AI.ANALYSIS_ERROR:
        case ErrorCode.AI.MODEL_ERROR:
        case ErrorCode.AI.PARSING_ERROR:
        case ErrorCode.AI.API_REQUEST_ERROR:
        case ErrorCode.AI.IMAGE_PROCESSING_ERROR:
        case ErrorCode.File.UPLOAD_ERROR:
        case ErrorCode.File.PROCESSING_ERROR:
        case ErrorCode.File.INVALID_IMAGE:
            return 500; // Internal Server Error

        default:
            // 古いプレフィックスベースのエラーコードも引き続きサポート
            if (code.startsWith('auth_')) return 401; // Unauthorized
            if (code.startsWith('forbidden_')) return 403; // Forbidden
            if (code.startsWith('not_found')) return 404; // Not Found
            if (code.startsWith('validation_') || code.startsWith('invalid_')) return 400; // Bad Request
            if (code.startsWith('rate_limit') || code.startsWith('quota_')) return 429; // Too Many Requests
            if (
                code.startsWith('server_') ||
                code.startsWith('database_') ||
                code.startsWith('ai_') ||
                code.startsWith('image_') ||
                code.startsWith('nutrition_') ||
                code.startsWith('file_')
            ) {
                // ANALYSIS_FAILED は switch で 400 になったので、
                // ここで 'ai_' で始まるものは 500 で問題ない
                return 500;
            }

            // マッピングがない場合はログに記録して500を返す
            console.warn(`Unknown error code encountered: ${code}. Defaulting to 500.`);
            return 500;
    }
} 