/**
 * 食品分析エラーコード
 */
export enum ErrorCode {
    // 入力関連エラー
    MISSING_TEXT = 'MISSING_TEXT',
    INVALID_FORMAT = 'INVALID_FORMAT',

    // API関連エラー
    MISSING_API_KEY = 'MISSING_API_KEY',
    API_REQUEST_FAILED = 'API_REQUEST_FAILED',

    // AI関連エラー
    AI_ERROR = 'AI_ERROR',
    PARSING_ERROR = 'PARSING_ERROR',

    // データベース関連エラー
    DB_ERROR = 'DB_ERROR',
    FOOD_NOT_FOUND = 'FOOD_NOT_FOUND',

    // その他
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 食品分析エラークラス
 */
export class FoodAnalysisError extends Error {
    code: ErrorCode;
    details: any;

    constructor(message: string, code: ErrorCode, details?: any) {
        super(message);
        this.name = 'FoodAnalysisError';
        this.code = code;
        this.details = details;
    }
}

/**
 * エラーレスポンスを作成する関数
 */
export function createErrorResponse(error: FoodAnalysisError) {
    return {
        success: false,
        error: {
            message: error.message,
            code: error.code,
            details: error.details ? String(error.details) : undefined
        }
    };
}

/**
 * エラーコードに基づいてユーザーフレンドリーなメッセージを取得
 */
export function getUserFriendlyErrorMessage(code: ErrorCode): string {
    switch (code) {
        case ErrorCode.MISSING_TEXT:
            return '食品データが入力されていません。食品名を入力してください。';
        case ErrorCode.INVALID_FORMAT:
            return '入力形式が正しくありません。正しい形式で入力してください。';
        case ErrorCode.MISSING_API_KEY:
            return 'システム設定エラーが発生しました。管理者にお問い合わせください。';
        case ErrorCode.API_REQUEST_FAILED:
            return 'APIリクエストに失敗しました。ネットワーク接続を確認してください。';
        case ErrorCode.AI_ERROR:
            return 'AI解析中にエラーが発生しました。しばらく経ってからもう一度お試しください。';
        case ErrorCode.PARSING_ERROR:
            return '解析エラーが発生しました。入力内容を確認してください。';
        case ErrorCode.DB_ERROR:
            return 'データベースエラーが発生しました。管理者にお問い合わせください。';
        case ErrorCode.FOOD_NOT_FOUND:
            return '指定された食品が見つかりませんでした。別の食品名を試してください。';
        default:
            return '予期せぬエラーが発生しました。もう一度お試しください。';
    }
} 