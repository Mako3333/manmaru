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
    PREGNANCY_DATA_ERROR = 'pregnancy_data_error'
}

/**
 * 基本AIエラークラス
 * すべてのAI関連エラーのベースクラス
 */
export class AIError extends Error {
    public code: ErrorCode;
    public details: any;
    public suggestions: string[];

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

        // エラーログ記録
        this.logError();
    }

    /**
     * JSON形式のエラー情報を返す
     */
    public toJSON() {
        return {
            error: {
                code: this.code,
                message: this.message,
                suggestions: this.suggestions
            }
        };
    }

    /**
     * エラー情報をログに記録
     */
    private logError() {
        console.error(`AIError [${this.code}]: ${this.message}`, this.details);
    }
}

/**
 * 食品分析特化エラー
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
    }
}

/**
 * 栄養計算特化エラー
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
    }
}

/**
 * エラーレスポンス生成関数
 */
export function createErrorResponse(error: AIError) {
    return {
        success: false,
        ...error.toJSON(),
        timestamp: new Date().toISOString()
    };
} 