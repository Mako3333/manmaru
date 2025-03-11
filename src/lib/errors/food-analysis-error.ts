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
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    DB_INIT_ERROR = 'DB_INIT_ERROR',
    DB_LOAD_ERROR = 'DB_LOAD_ERROR',
    AI_MODEL_ERROR = 'AI_MODEL_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',
    PARSE_ERROR = 'PARSE_ERROR'
}

/**
 * 食品分析エラークラス
 */
export class FoodAnalysisError extends Error {
    code: ErrorCode;
    originalError: Error | null;
    details?: string[];

    constructor(
        message: string,
        code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
        originalError: Error | null = null,
        details?: string[]
    ) {
        super(message);
        this.name = 'FoodAnalysisError';
        this.code = code;
        this.originalError = originalError;
        this.details = details;

        // エラーログの詳細化
        console.error(`FoodAnalysisError [${code}]: ${message}`, {
            details,
            originalError: originalError ? {
                name: originalError.name,
                message: originalError.message,
                stack: originalError.stack
            } : null
        });
    }

    /**
     * ユーザーフレンドリーなエラーメッセージを取得
     */
    getUserFriendlyMessage(): string {
        switch (this.code) {
            case ErrorCode.VALIDATION_ERROR:
                return '入力データが正しくありません。食品名と量を確認してください。';
            case ErrorCode.DB_ERROR:
                return 'データベース処理中にエラーが発生しました。しばらく経ってからお試しください。';
            case ErrorCode.DB_INIT_ERROR:
                return '栄養データベースの初期化に失敗しました。ページを再読み込みしてください。';
            case ErrorCode.DB_LOAD_ERROR:
                return '栄養データベースの読み込みに失敗しました。インターネット接続を確認してください。';
            case ErrorCode.AI_MODEL_ERROR:
                return 'テキスト解析中にエラーが発生しました。別の表現で入力してみてください。';
            case ErrorCode.NETWORK_ERROR:
                return 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
            case ErrorCode.TIMEOUT_ERROR:
                return '処理がタイムアウトしました。しばらく経ってからお試しください。';
            case ErrorCode.PARSE_ERROR:
                return 'データの解析に失敗しました。入力形式を確認してください。';
            default:
                return 'エラーが発生しました。しばらく経ってからお試しください。';
        }
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