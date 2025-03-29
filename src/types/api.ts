import { ErrorCode } from '@/lib/errors/app-errors';

/**
 * 標準APIレスポンス形式の型定義
 */
export interface StandardApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: ErrorCode;
        message: string;
        details?: unknown;
        suggestions?: string[];
    };
    meta?: {
        processingTimeMs?: number;
        warning?: string;
        [key: string]: unknown;
    };
}

/**
 * ページネーション用のメタデータ
 */
export interface PaginationMeta {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
}

/**
 * 成功レスポンス型
 */
export type SuccessResponse<T> = {
    success: true;
    data: T;
    meta?: {
        processingTimeMs?: number;
        warning?: string;
        pagination?: PaginationMeta;
    };
};

/**
 * エラーレスポンス型
 */
export type ErrorResponse = {
    success: false;
    error: {
        code: ErrorCode;
        message: string;
        details?: Record<string, unknown>;
        suggestions?: string[];
    };
    meta?: {
        processingTimeMs?: number;
    };
};

/**
 * レガシーAPIレスポンス型
 */
export interface LegacyApiResponse<T> {
    success?: boolean;
    data?: T;
    error?: string;
    errorCode?: string;
    details?: unknown;
    suggestions?: string[];
    warning?: string;
}

/**
 * ヘルパー関数: 成功レスポンスの型安全な作成
 */
export function createTypedSuccessResponse<T>(
    data: T,
    meta?: Omit<SuccessResponse<T>['meta'], 'processingTimeMs'>
): SuccessResponse<T> {
    return {
        success: true,
        data,
        ...(meta ? { meta } : {})
    };
}

/**
 * ヘルパー関数: エラーレスポンスの型安全な作成
 */
export function createTypedErrorResponse(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    suggestions?: string[]
): ErrorResponse {
    return {
        success: false,
        error: {
            code,
            message,
            ...(details ? { details } : {}),
            ...(suggestions ? { suggestions } : {})
        }
    };
}

/**
 * API通信の状態を表す型
 */
export interface ApiState<T> {
    data?: T;
    loading: boolean;
    error?: string;
    errorDetails?: unknown;
}

/**
 * APIハンドラー型
 */
export type ApiHandler<T> = (req: Request) => Promise<StandardApiResponse<T>>;

/**
 * APIミドルウェア型
 */
export type ApiMiddleware = <T>(handler: ApiHandler<T>, requireAuth?: boolean) => ApiHandler<T>; 