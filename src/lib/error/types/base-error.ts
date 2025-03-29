import { AnyErrorCode, DEFAULT_ERROR_MESSAGES, ErrorSeverity } from '../codes/error-codes';

/**
 * エラーオプションのインターフェース
 */
export interface ErrorOptions {
    /** エラーコード */
    code: AnyErrorCode;
    /** エラーメッセージ（開発者向け） */
    message: string;
    /** ユーザー向けメッセージ（オプション） */
    userMessage?: string;
    /** エラーの詳細情報 */
    details?: unknown;
    /** エラーの深刻度 */
    severity?: ErrorSeverity;
    /** 解決のための提案 */
    suggestions?: string[];
    /** 元のエラー */
    originalError?: Error | undefined;
}

/**
 * アプリケーション基本エラークラス
 */
export class AppError extends Error {
    /** エラーコード */
    public readonly code: AnyErrorCode;
    /** ユーザー向けメッセージ */
    public readonly userMessage: string;
    /** エラーの詳細情報 */
    public readonly details?: unknown;
    /** エラーの深刻度 */
    public readonly severity: ErrorSeverity;
    /** 解決のための提案 */
    public readonly suggestions: string[];
    /** 元のエラー */
    public readonly originalError?: Error | undefined;

    constructor(options: ErrorOptions) {
        super(options.message);
        this.name = this.constructor.name;
        this.code = options.code;
        this.userMessage = options.userMessage || DEFAULT_ERROR_MESSAGES[options.code];
        this.details = options.details;
        this.severity = options.severity || 'error';
        this.suggestions = options.suggestions || this.getDefaultSuggestions(options.code);
        this.originalError = options.originalError;

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
            code: this.code,
            message: this.message,
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
            severity: this.severity,
            suggestions: this.suggestions,
            originalError: this.originalError
        });
    }

    /**
     * エラーコードに基づいたデフォルトの提案を取得
     */
    private getDefaultSuggestions(code: AnyErrorCode): string[] {
        const commonSuggestions = ['しばらく経ってからもう一度お試しください'];

        switch (code) {
            case 'network_error':
                return ['インターネット接続を確認してください', ...commonSuggestions];
            case 'auth_error':
                return ['ログインページからログインしてください'];
            case 'food_not_found':
                return ['別の食品名で検索してみてください', '一般的な食品名を使用してください'];
            case 'food_match_low_confidence':
                return ['より具体的な食品名を入力してください', '一般的な食品名を使用してください'];
            case 'quantity_parse_error':
                return ['「100g」や「大さじ1」のような形式で入力してください'];
            case 'invalid_image':
                return ['対応している画像形式（JPG、PNG）を使用してください', '別の画像をお試しください'];
            default:
                return commonSuggestions;
        }
    }
} 