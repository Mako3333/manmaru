export enum ErrorCode {
    // 既存のエラーコード
    UNKNOWN_ERROR = 'unknown_error',
    API_ERROR = 'api_error',
    NETWORK_ERROR = 'network_error',
    AUTH_ERROR = 'auth_error',

    // 栄養計算システム関連のエラーコード
    FOOD_NOT_FOUND = 'food_not_found',
    FOOD_MATCH_LOW_CONFIDENCE = 'food_match_low_confidence',
    QUANTITY_PARSE_ERROR = 'quantity_parse_error',
    NUTRITION_CALCULATION_ERROR = 'nutrition_calculation_error',
    AI_ANALYSIS_ERROR = 'ai_analysis_error',
    FOOD_REPOSITORY_ERROR = 'food_repository_error',
    INVALID_FOOD_DATA = 'invalid_food_data',
    INVALID_QUANTITY = 'invalid_quantity'
}

export type ErrorSeverity = 'error' | 'warning' | 'info';

// エラーコードごとのデフォルトメッセージ
export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
    // 既存のメッセージ
    [ErrorCode.UNKNOWN_ERROR]: 'エラーが発生しました',
    [ErrorCode.API_ERROR]: 'APIサーバーでエラーが発生しました',
    [ErrorCode.NETWORK_ERROR]: 'ネットワーク接続に問題があります',
    [ErrorCode.AUTH_ERROR]: '認証に失敗しました',

    // 栄養計算システム関連のメッセージ
    [ErrorCode.FOOD_NOT_FOUND]: '食品が見つかりませんでした',
    [ErrorCode.FOOD_MATCH_LOW_CONFIDENCE]: '食品の一致度が低いです',
    [ErrorCode.QUANTITY_PARSE_ERROR]: '食品量の解析に失敗しました',
    [ErrorCode.NUTRITION_CALCULATION_ERROR]: '栄養計算中にエラーが発生しました',
    [ErrorCode.AI_ANALYSIS_ERROR]: 'AI解析中にエラーが発生しました',
    [ErrorCode.FOOD_REPOSITORY_ERROR]: '食品データベースへのアクセスに失敗しました',
    [ErrorCode.INVALID_FOOD_DATA]: '不正な食品データが検出されました',
    [ErrorCode.INVALID_QUANTITY]: '不正な量データが検出されました'
} 