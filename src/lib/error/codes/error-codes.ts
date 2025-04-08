/**
 * エラーコードの定義
 * システム全体で使用される統一的なエラーコード
 */
export const ErrorCode = {
    // 基本エラー
    Base: {
        UNKNOWN_ERROR: 'unknown_error',
        NETWORK_ERROR: 'network_error',
        AUTH_ERROR: 'auth_error',
        API_ERROR: 'api_error',
        DATA_VALIDATION_ERROR: 'data_validation_error',
        DATA_PROCESSING_ERROR: 'data_processing_error',
        DATA_NOT_FOUND: 'data_not_found',
    },

    // 栄養計算関連
    Nutrition: {
        // 食品検索関連
        FOOD_NOT_FOUND: 'food_not_found',
        FOOD_MATCH_LOW_CONFIDENCE: 'food_match_low_confidence',
        FOOD_REPOSITORY_ERROR: 'food_repository_error',
        INVALID_FOOD_DATA: 'invalid_food_data',
        MULTIPLE_FOODS_FOUND: 'multiple_foods_found',
        FOOD_MATCHING_ERROR: 'food_matching_error',

        // 量解析関連
        QUANTITY_PARSE_ERROR: 'quantity_parse_error',
        INVALID_QUANTITY: 'invalid_quantity',

        // 栄養計算関連
        NUTRITION_CALCULATION_ERROR: 'nutrition_calculation_error',
        MISSING_NUTRITION_DATA: 'missing_nutrition_data',
    },

    // AI関連
    AI: {
        ANALYSIS_ERROR: 'ai_analysis_error',
        MODEL_ERROR: 'ai_model_error',
        PARSING_ERROR: 'ai_parsing_error',
        ANALYSIS_FAILED: 'ai_analysis_failed',
        IMAGE_PROCESSING_ERROR: 'image_processing_error',
        API_REQUEST_ERROR: 'ai_api_request_error',
    },

    // リソース制限関連
    Resource: {
        RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
        QUOTA_EXCEEDED: 'quota_exceeded',
    },

    // ファイル処理関連
    File: {
        UPLOAD_ERROR: 'file_upload_error',
        PROCESSING_ERROR: 'file_processing_error',
        INVALID_IMAGE: 'invalid_image',
    }
} as const;

/**
 * エラーコードの型定義
 */
export type ErrorCodeType = typeof ErrorCode;

/**
 * 各カテゴリのエラーコード型
 */
export type BaseErrorCode = ErrorCodeType['Base'][keyof ErrorCodeType['Base']];
export type NutritionErrorCode = ErrorCodeType['Nutrition'][keyof ErrorCodeType['Nutrition']];
export type AIErrorCode = ErrorCodeType['AI'][keyof ErrorCodeType['AI']];
export type ResourceErrorCode = ErrorCodeType['Resource'][keyof ErrorCodeType['Resource']];
export type FileErrorCode = ErrorCodeType['File'][keyof ErrorCodeType['File']];

/**
 * すべてのエラーコードの型
 */
export type AnyErrorCode =
    | BaseErrorCode
    | NutritionErrorCode
    | AIErrorCode
    | ResourceErrorCode
    | FileErrorCode;

/**
 * エラーの深刻度レベル
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * デフォルトのエラーメッセージ
 */
export const DEFAULT_ERROR_MESSAGES: Record<AnyErrorCode, string> = {
    // Base
    unknown_error: 'エラーが発生しました。しばらく経ってからもう一度お試しください。',
    network_error: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
    auth_error: 'この操作を行うにはログインが必要です。',
    api_error: 'サーバー処理中にエラーが発生しました。',
    data_validation_error: '入力データが無効です。入力内容を確認してください。',
    data_processing_error: 'データの処理中にエラーが発生しました。',
    data_not_found: '指定されたデータが見つかりませんでした。',

    // Nutrition
    food_not_found: '食品が見つかりませんでした。',
    food_match_low_confidence: '食品の一致度が低いです。',
    food_repository_error: '食品データベースへのアクセス中にエラーが発生しました。',
    invalid_food_data: '食品データが無効です。',
    multiple_foods_found: '複数の食品候補が見つかりました。絞り込んでください。',
    food_matching_error: '食品情報の取得中にエラーが発生しました。',
    quantity_parse_error: '食品量の解析に失敗しました。',
    invalid_quantity: '無効な量が指定されました。',
    nutrition_calculation_error: '栄養計算中にエラーが発生しました。',
    missing_nutrition_data: '栄養データが不足しています。',

    // AI
    ai_analysis_error: 'AI解析中にエラーが発生しました。',
    ai_model_error: 'AIモデルでエラーが発生しました。',
    ai_parsing_error: 'AI応答の解析に失敗しました。',
    ai_analysis_failed: 'AI分析に失敗しました。',
    image_processing_error: '画像処理中にエラーが発生しました。',
    ai_api_request_error: 'AI APIへのリクエスト中にエラーが発生しました。',

    // Resource
    rate_limit_exceeded: 'リクエスト制限に達しました。しばらく経ってからお試しください。',
    quota_exceeded: '使用制限に達しました。しばらく経ってからお試しください。',

    // File
    file_upload_error: 'ファイルのアップロードに失敗しました。',
    file_processing_error: 'ファイルの処理中にエラーが発生しました。',
    invalid_image: '画像が無効です。別の画像をお試しください。'
}; 