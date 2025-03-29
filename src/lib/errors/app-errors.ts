/**
 * アプリケーション固有のエラーコード列挙型
 */
//src\lib\errors\app-errors.ts
export enum ErrorCode {
    // 一般的なエラー
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',

    // 認証関連のエラー
    AUTH_REQUIRED = 'AUTH_REQUIRED',
    AUTH_INVALID = 'AUTH_INVALID',
    AUTH_EXPIRED = 'AUTH_EXPIRED',

    // データ処理エラー
    DATA_VALIDATION_ERROR = 'DATA_VALIDATION_ERROR',
    DATA_PROCESSING_ERROR = 'DATA_PROCESSING_ERROR',
    DATA_NOT_FOUND = 'DATA_NOT_FOUND',

    // API関連エラー
    API_ERROR = 'API_ERROR',
    API_REQUEST_FAILED = 'API_REQUEST_FAILED',
    API_RESPONSE_INVALID = 'API_RESPONSE_INVALID',
    API_TIMEOUT = 'API_TIMEOUT',

    // AI関連エラー
    AI_ANALYSIS_ERROR = 'AI_ANALYSIS_ERROR',
    AI_MODEL_ERROR = 'AI_MODEL_ERROR',
    AI_PARSING_ERROR = 'AI_PARSING_ERROR',
    AI_ANALYSIS_FAILED = 'AI_ANALYSIS_FAILED',

    // 食事・栄養関連エラー
    MEAL_PROCESSING_ERROR = 'MEAL_PROCESSING_ERROR',
    NUTRITION_CALCULATION_ERROR = 'NUTRITION_CALCULATION_ERROR',
    FOOD_NOT_FOUND = 'FOOD_NOT_FOUND',
    FOOD_MATCH_LOW_CONFIDENCE = 'FOOD_MATCH_LOW_CONFIDENCE',
    QUANTITY_PARSE_ERROR = 'QUANTITY_PARSE_ERROR',
    FOOD_RECOGNITION_ERROR = 'FOOD_RECOGNITION_ERROR',

    // リソース制限エラー
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

    // ファイル処理エラー
    FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
    FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',
    INVALID_IMAGE = 'INVALID_IMAGE',

    // その他のアプリ特有エラー
    PREGNANCY_DATA_ERROR = 'PREGNANCY_DATA_ERROR',
    RECIPE_PROCESSING_ERROR = 'RECIPE_PROCESSING_ERROR'
}

/**
 * エラー深刻度レベルの列挙型
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * アプリケーション基本エラークラス
 */
export class AppError extends Error {
    /**
     * エラーコード
     */
    public readonly code: ErrorCode;

    /**
     * ユーザー向けのエラーメッセージ
     */
    public readonly userMessage: string;

    /**
     * エラーの詳細情報
     */
    public readonly details?: unknown;

    /**
     * エラーの深刻度
     */
    public readonly severity: ErrorSeverity;

    /**
     * 対処方法の提案
     */
    public readonly suggestions: string[];

    /**
     * 元のエラー（存在する場合）
     */
    public readonly originalError?: Error | undefined;

    /**
     * コンストラクタ
     */
    constructor(
        message: string,
        code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
        userMessage?: string,
        details?: unknown,
        severity: ErrorSeverity = 'error',
        suggestions: string[] = [],
        originalError?: Error | undefined
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.userMessage = userMessage || this.getDefaultUserMessage(code);
        this.details = details;
        this.severity = severity;
        this.suggestions = suggestions;
        this.originalError = originalError;

        // スタックトレースを正しく設定
        Object.setPrototypeOf(this, AppError.prototype);

        // エラーをログに記録
        this.logError();
    }

    /**
     * エラーをJSON形式に変換
     */
    public toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            userMessage: this.userMessage,
            details: this.details,
            severity: this.severity,
            suggestions: this.suggestions,
            stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
        };
    }

    /**
     * エラーをログに記録
     */
    private logError() {
        console.error(`[${this.name}] ${this.code}: ${this.message}`, {
            userMessage: this.userMessage,
            details: this.details,
            suggestions: this.suggestions,
            originalError: this.originalError
        });
    }

    /**
     * エラーコードに基づいたデフォルトのユーザー向けメッセージを取得
     */
    private getDefaultUserMessage(code: ErrorCode): string {
        switch (code) {
            case ErrorCode.UNKNOWN_ERROR:
                return 'エラーが発生しました。しばらく経ってからもう一度お試しください。';
            case ErrorCode.NETWORK_ERROR:
                return 'ネットワーク接続に問題があります。インターネット接続を確認してください。';
            case ErrorCode.AUTH_REQUIRED:
                return 'この操作を行うにはログインが必要です。';
            case ErrorCode.AUTH_INVALID:
                return 'ログイン情報が無効です。再度ログインしてください。';
            case ErrorCode.AUTH_EXPIRED:
                return 'ログインセッションの有効期限が切れました。再度ログインしてください。';
            case ErrorCode.DATA_VALIDATION_ERROR:
                return '入力データが無効です。入力内容を確認してください。';
            case ErrorCode.DATA_PROCESSING_ERROR:
                return 'データの処理中にエラーが発生しました。';
            case ErrorCode.DATA_NOT_FOUND:
                return '指定されたデータが見つかりませんでした。';
            case ErrorCode.API_ERROR:
                return 'サーバー処理中にエラーが発生しました。';
            case ErrorCode.API_REQUEST_FAILED:
                return 'サーバーとの通信に失敗しました。しばらく経ってからお試しください。';
            case ErrorCode.API_RESPONSE_INVALID:
                return 'サーバーからの応答が不正です。';
            case ErrorCode.API_TIMEOUT:
                return 'サーバーからの応答がタイムアウトしました。';
            case ErrorCode.AI_ANALYSIS_FAILED:
                return 'AI分析に失敗しました。別の方法をお試しください。';
            case ErrorCode.AI_MODEL_ERROR:
                return 'AI処理中にエラーが発生しました。しばらく経ってからお試しください。';
            case ErrorCode.AI_PARSING_ERROR:
                return 'AI応答の解析に失敗しました。';
            case ErrorCode.MEAL_PROCESSING_ERROR:
                return '食事データの処理中にエラーが発生しました。';
            case ErrorCode.NUTRITION_CALCULATION_ERROR:
                return '栄養計算中にエラーが発生しました。';
            case ErrorCode.FOOD_RECOGNITION_ERROR:
                return '食品認識中にエラーが発生しました。';
            case ErrorCode.RATE_LIMIT_EXCEEDED:
                return 'リクエスト制限に達しました。しばらく経ってからお試しください。';
            case ErrorCode.QUOTA_EXCEEDED:
                return '使用制限に達しました。しばらく経ってからお試しください。';
            case ErrorCode.FILE_UPLOAD_ERROR:
                return 'ファイルのアップロードに失敗しました。';
            case ErrorCode.FILE_PROCESSING_ERROR:
                return 'ファイルの処理中にエラーが発生しました。';
            case ErrorCode.INVALID_IMAGE:
                return '画像が無効です。別の画像をお試しください。';
            case ErrorCode.PREGNANCY_DATA_ERROR:
                return '妊娠データの処理中にエラーが発生しました。';
            case ErrorCode.RECIPE_PROCESSING_ERROR:
                return 'レシピデータの処理中にエラーが発生しました。';
            default:
                return 'エラーが発生しました。しばらく経ってからもう一度お試しください。';
        }
    }
}

/**
 * API関連のエラークラス
 */
export class ApiError extends AppError {
    /**
     * HTTPステータスコード
     */
    public readonly statusCode: number;

    /**
     * コンストラクタ
     */
    constructor(
        message: string,
        code: ErrorCode = ErrorCode.API_ERROR,
        userMessage?: string,
        statusCode: number = 500,
        details?: unknown,
        severity: ErrorSeverity = 'error',
        suggestions: string[] = [],
        originalError?: Error | undefined
    ) {
        super(message, code, userMessage, details, severity, suggestions, originalError);
        this.name = 'ApiError';
        this.statusCode = statusCode;

        // スタックトレースを正しく設定
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

/**
 * 認証関連のエラークラス
 */
export class AuthError extends AppError {
    constructor(
        message: string = 'ログインが必要です',
        code: ErrorCode = ErrorCode.AUTH_REQUIRED,
        userMessage: string = 'この操作を行うにはログインが必要です',
        details?: unknown,
        suggestions: string[] = ['ログインページからログインしてください'],
        originalError?: Error | undefined
    ) {
        super(message, code, userMessage, details, 'warning', suggestions, originalError);
        this.name = 'AuthError';

        // スタックトレースを正しく設定
        Object.setPrototypeOf(this, AuthError.prototype);
    }
}

/**
 * データ処理エラークラス
 */
export class DataProcessingError extends AppError {
    constructor(
        message: string,
        entity: string,
        code: ErrorCode = ErrorCode.DATA_PROCESSING_ERROR,
        details?: unknown,
        suggestions: string[] = [],
        originalError?: Error | undefined
    ) {
        super(
            message,
            code,
            `${entity}の処理中にエラーが発生しました`,
            details,
            'error',
            suggestions,
            originalError
        );
        this.name = 'DataProcessingError';

        // スタックトレースを正しく設定
        Object.setPrototypeOf(this, DataProcessingError.prototype);
    }
}

/**
 * AI分析エラークラス
 */
export class AiAnalysisError extends AppError {
    constructor(
        message: string,
        detail?: string,
        code: ErrorCode = ErrorCode.AI_ANALYSIS_FAILED,
        details?: unknown,
        suggestions: string[] = ['別の入力方法をお試しください'],
        originalError?: Error | undefined
    ) {
        super(
            `AI分析エラー: ${message}`,
            code,
            `栄養分析でエラーが発生しました${detail ? `（${detail}）` : ''}`,
            details,
            'error',
            suggestions,
            originalError
        );
        this.name = 'AiAnalysisError';

        // スタックトレースを正しく設定
        Object.setPrototypeOf(this, AiAnalysisError.prototype);
    }
}

/**
 * ファイル処理エラークラス
 */
export class FileProcessingError extends AppError {
    constructor(
        message: string,
        fileType: string,
        code: ErrorCode = ErrorCode.FILE_PROCESSING_ERROR,
        details?: unknown,
        suggestions: string[] = [],
        originalError?: Error | undefined
    ) {
        super(
            message,
            code,
            `${fileType}の処理中にエラーが発生しました`,
            details,
            'error',
            suggestions,
            originalError
        );
        this.name = 'FileProcessingError';

        // スタックトレースを正しく設定
        Object.setPrototypeOf(this, FileProcessingError.prototype);
    }
}

/**
 * バリデーションエラークラス
 */
export class ValidationError extends AppError {
    constructor(
        message: string,
        fieldName: string,
        code: ErrorCode = ErrorCode.DATA_VALIDATION_ERROR,
        details?: unknown,
        suggestions: string[] = [],
        originalError?: Error | undefined
    ) {
        super(
            message,
            code,
            `${fieldName}の入力内容が無効です`,
            details,
            'warning',
            suggestions,
            originalError
        );
        this.name = 'ValidationError';

        // スタックトレースを正しく設定
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

/**
 * エラーコードからHTTPステータスコードを取得する関数
 */
export function getStatusCodeFromErrorCode(code: ErrorCode): number {
    switch (code) {
        case ErrorCode.DATA_VALIDATION_ERROR:
            return 400; // Bad Request
        case ErrorCode.AUTH_REQUIRED:
        case ErrorCode.AUTH_INVALID:
        case ErrorCode.AUTH_EXPIRED:
            return 401; // Unauthorized
        case ErrorCode.DATA_NOT_FOUND:
            return 404; // Not Found
        case ErrorCode.RATE_LIMIT_EXCEEDED:
        case ErrorCode.QUOTA_EXCEEDED:
            return 429; // Too Many Requests
        case ErrorCode.INVALID_IMAGE:
            return 415; // Unsupported Media Type
        default:
            return 500; // Internal Server Error
    }
}

/**
 * APIエラーレスポンスを作成する関数
 */
export function createErrorResponse(error: AppError) {
    return {
        success: false,
        error: {
            code: error.code,
            message: error.userMessage,
            details: error.details,
            suggestions: error.suggestions
        }
    };
} 