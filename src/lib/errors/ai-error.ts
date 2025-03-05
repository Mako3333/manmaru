/**
 * AIエラーコード列挙型
 */
export enum ErrorCode {
    // 一般エラー
    UNKNOWN_ERROR = 'unknown_error',
    API_KEY_ERROR = 'api_key_error',
    NETWORK_ERROR = 'network_error',

    // AI関連エラー
    AI_MODEL_ERROR = 'ai_model_error',
    PROMPT_ERROR = 'prompt_error',
    RESPONSE_PARSE_ERROR = 'response_parse_error',

    // 食品分析特有エラー
    IMAGE_PROCESSING_ERROR = 'image_processing_error',
    FOOD_RECOGNITION_ERROR = 'food_recognition_error',

    // 栄養解析特有エラー
    NUTRITION_CALCULATION_ERROR = 'nutrition_calculation_error',

    // 入力検証エラー
    VALIDATION_ERROR = 'validation_error',

    // その他のアプリ特有エラー
    PREGNANCY_DATA_ERROR = 'pregnancy_data_error',

    // 認証・認可エラー
    AUTHENTICATION_ERROR = 'authentication_error',
    AUTHORIZATION_ERROR = 'authorization_error',

    // リソースエラー
    RESOURCE_NOT_FOUND = 'resource_not_found',
    RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',

    // その他
    INTERNAL_ERROR = 'internal_error'
}

/**
 * AIサービス用カスタムエラークラス
 */
export class AIError extends Error {
    /**
     * エラーコード
     */
    public code: ErrorCode;

    /**
     * エラー詳細情報
     */
    public details: any;

    /**
     * エラー対応の提案
     */
    public suggestions: string[];

    /**
     * コンストラクタ
     * @param message エラーメッセージ
     * @param code エラーコード
     * @param details 詳細情報（オプション）
     * @param suggestions 提案（オプション）
     */
    constructor(
        message: string,
        code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
        details?: any,
        suggestions: string[] = []
    ) {
        super(message);
        this.name = 'AIError';
        this.code = code;
        this.details = details;
        this.suggestions = suggestions;

        // スタックトレースを正しく設定（TypeScriptのクラス拡張時の問題対応）
        Object.setPrototypeOf(this, AIError.prototype);

        // エラーログ記録
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
            details: this.details,
            suggestions: this.suggestions,
            stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
        };
    }

    /**
     * エラーログを記録
     */
    private logError() {
        console.error(`[AIError] ${this.code}: ${this.message}`, {
            details: this.details,
            suggestions: this.suggestions
        });
    }
}

/**
 * 食品分析特化エラークラス
 */
export class FoodAnalysisError extends AIError {
    constructor(
        message: string,
        code: ErrorCode = ErrorCode.FOOD_RECOGNITION_ERROR,
        details?: any,
        suggestions: string[] = []
    ) {
        super(message, code, details, suggestions);
        this.name = 'FoodAnalysisError';

        // スタックトレースを正しく設定
        Object.setPrototypeOf(this, FoodAnalysisError.prototype);
    }
}

/**
 * 栄養計算特化エラークラス
 */
export class NutritionError extends AIError {
    constructor(
        message: string,
        code: ErrorCode = ErrorCode.NUTRITION_CALCULATION_ERROR,
        details?: any,
        suggestions: string[] = []
    ) {
        super(message, code, details, suggestions);
        this.name = 'NutritionError';

        // スタックトレースを正しく設定
        Object.setPrototypeOf(this, NutritionError.prototype);
    }
}

/**
 * エラーレスポンスを作成
 */
export function createErrorResponse(error: AIError) {
    return {
        success: false,
        error: error.toJSON()
    };
} 