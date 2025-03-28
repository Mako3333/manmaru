import { AppError } from '../errors/app-errors';
import { ErrorCode, ErrorSeverity } from './error-codes';
//src\lib\error\nutrition-errors.ts
/**
 * 食品マッチングに関連するエラー
 */
export class FoodMatchingError extends AppError {
    constructor(
        message: string,
        code: ErrorCode = ErrorCode.FOOD_NOT_FOUND,
        userMessage?: string,
        details?: any,
        severity: ErrorSeverity = 'warning',
        suggestions: string[] = ['別の食品名で検索してみてください', '一般的な食品名を使用してください'],
        originalError?: Error
    ) {
        super(
            message,
            code,
            userMessage || '食品の検索中にエラーが発生しました',
            details,
            severity,
            suggestions,
            originalError
        );
    }
}

/**
 * 量解析に関連するエラー
 */
export class QuantityParseError extends AppError {
    constructor(
        message: string,
        inputText: string,
        code: ErrorCode = ErrorCode.QUANTITY_PARSE_ERROR,
        userMessage?: string,
        severity: ErrorSeverity = 'warning',
        suggestions: string[] = ['「100g」や「大さじ1」のような形式で入力してください'],
        originalError?: Error
    ) {
        super(
            message,
            code,
            userMessage || '食品量の解析に失敗しました',
            { inputText },
            severity,
            suggestions,
            originalError
        );
    }
}

/**
 * 栄養計算に関連するエラー
 */
export class NutritionCalculationError extends AppError {
    constructor(
        message: string,
        foodItems?: Array<{ name: string; quantity?: string }>,
        code: ErrorCode = ErrorCode.NUTRITION_CALCULATION_ERROR,
        userMessage?: string,
        severity: ErrorSeverity = 'error',
        suggestions: string[] = ['食品と量の情報を確認してください'],
        originalError?: Error
    ) {
        super(
            message,
            code,
            userMessage || '栄養計算中にエラーが発生しました',
            { foodItems },
            severity,
            suggestions,
            originalError
        );
    }
}

/**
 * AI解析に関連するエラー
 */
export class AIAnalysisError extends AppError {
    constructor(
        message: string,
        inputData?: { type: 'text' | 'image'; content?: string },
        code: ErrorCode = ErrorCode.AI_ANALYSIS_ERROR,
        userMessage?: string,
        severity: ErrorSeverity = 'error',
        suggestions: string[] = ['しばらく経ってから再度お試しください', '別の入力方法をお試しください'],
        originalError?: Error
    ) {
        super(
            message,
            code,
            userMessage || 'AI解析中にエラーが発生しました',
            { inputData },
            severity,
            suggestions,
            originalError
        );
    }
} 