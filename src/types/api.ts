import { ErrorCode, AnyErrorCode } from '@/lib/error';
import { ApiResponse as BaseApiResponse } from '@/lib/api/response';

/**
 * ページネーション用のメタデータ
 */
export interface PaginationMeta {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
}

/**
 * 拡張APIレスポンス型
 */
export interface ApiResponse<T = unknown> extends BaseApiResponse<T> {
    meta?: {
        processingTimeMs?: number;
        warning?: string;
        pagination?: PaginationMeta;
        analysisSource?: 'parser' | 'ai';
    };
}

/**
 * 成功レスポンス型
 */
export type SuccessResponse<T> = {
    success: true;
    data: T;
    meta?: ApiResponse<T>['meta'];
};

/**
 * エラーレスポンス型
 */
export type ErrorResponse = {
    success: false;
    error: {
        code: AnyErrorCode;
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
export type ApiHandler<T> = (req: Request) => Promise<ApiResponse<T>>;

/**
 * APIミドルウェア型
 */
export type ApiMiddleware = <T>(handler: ApiHandler<T>, requireAuth?: boolean) => ApiHandler<T>; 