/**
 * 食事解析システムのカスタムエラークラス
 */
export class FoodAnalysisError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'FoodAnalysisError';
    }
}

/**
 * エラーコードの定義
 */
export const ErrorCode = {
    // 設定エラー
    CONFIG_ERROR: 'CONFIG_ERROR',
    MISSING_API_KEY: 'MISSING_API_KEY',
    MISSING_DB_PATH: 'MISSING_DB_PATH',

    // 入力エラー
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_IMAGE: 'MISSING_IMAGE',
    INVALID_IMAGE: 'INVALID_IMAGE',
    MISSING_TEXT: 'MISSING_TEXT',
    INVALID_REQUEST: 'INVALID_REQUEST',

    // AI解析エラー
    AI_ERROR: 'AI_ERROR',
    AI_TIMEOUT: 'AI_TIMEOUT',
    AI_RESPONSE_FORMAT: 'AI_RESPONSE_FORMAT',

    // データベースエラー
    DB_ERROR: 'DB_ERROR',
    DB_READ_ERROR: 'DB_READ_ERROR',
    DB_MATCHING_ERROR: 'DB_MATCHING_ERROR',
    DB_DATA_INCONSISTENCY: 'DB_DATA_INCONSISTENCY',
} as const;

/**
 * エラーレスポンスの型定義
 */
export interface ErrorResponse {
    code: string;
    message: string;
    details?: unknown;
    suggestions?: string[];
}

/**
 * エラーレスポンスを生成する関数
 */
export function createErrorResponse(
    error: Error | FoodAnalysisError,
    suggestions?: string[]
): ErrorResponse {
    if (error instanceof FoodAnalysisError) {
        return {
            code: error.code,
            message: error.message,
            details: error.details,
            suggestions,
        };
    }

    return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        details: error.stack,
        suggestions,
    };
}

/**
 * エラー時のユーザー向けメッセージを取得
 */
export function getUserFriendlyMessage(code: string): string {
    const messages: Record<string, string> = {
        [ErrorCode.MISSING_API_KEY]: 'システムの設定が不完全です。管理者にお問い合わせください。',
        [ErrorCode.MISSING_DB_PATH]: 'データベースの設定が不完全です。管理者にお問い合わせください。',
        [ErrorCode.MISSING_IMAGE]: '画像データが見つかりません。もう一度写真を撮影してください。',
        [ErrorCode.INVALID_IMAGE]: '画像の形式が正しくありません。別の画像を試してください。',
        [ErrorCode.MISSING_TEXT]: 'テキストデータが入力されていません。',
        [ErrorCode.INVALID_REQUEST]: 'リクエストの形式が正しくありません。',
        [ErrorCode.AI_ERROR]: 'AI解析中にエラーが発生しました。しばらく時間をおいて再度お試しください。',
        [ErrorCode.AI_TIMEOUT]: 'AI解析がタイムアウトしました。しばらく時間をおいて再度お試しください。',
        [ErrorCode.DB_ERROR]: 'データベースでエラーが発生しました。しばらく時間をおいて再度お試しください。',
        [ErrorCode.DB_MATCHING_ERROR]: '食品データの照合に失敗しました。手動で入力してください。',
    };

    return messages[code] || 'エラーが発生しました。しばらく時間をおいて再度お試しください。';
}