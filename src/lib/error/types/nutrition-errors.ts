import { AppError, ErrorOptions } from './base-error';
import { ErrorCode } from '../codes/error-codes';

/**
 * 食品マッチングに関連するエラー
 */
export class FoodMatchingError extends AppError {
    constructor(
        message: string,
        foodName: string,
        confidence?: number,
        originalError?: Error
    ) {
        const options: ErrorOptions = {
            code: confidence ? ErrorCode.Nutrition.FOOD_MATCH_LOW_CONFIDENCE : ErrorCode.Nutrition.FOOD_NOT_FOUND,
            message,
            userMessage: confidence
                ? `「${foodName}」の一致度が低いです（${confidence}%）`
                : `「${foodName}」が見つかりませんでした`,
            details: { foodName, confidence },
            severity: confidence ? 'warning' : 'error',
            suggestions: [
                '別の食品名で検索してみてください',
                '一般的な食品名を使用してください'
            ],
            originalError
        };
        super(options);
    }
}

/**
 * 量解析に関連するエラー
 */
export class QuantityParseError extends AppError {
    constructor(
        message: string,
        inputText: string,
        originalError?: Error
    ) {
        const options: ErrorOptions = {
            code: ErrorCode.Nutrition.QUANTITY_PARSE_ERROR,
            message,
            userMessage: `「${inputText}」の量の解析に失敗しました`,
            details: { inputText },
            severity: 'warning',
            suggestions: [
                '「100g」や「大さじ1」のような形式で入力してください',
                '数値と単位を正しく入力してください'
            ],
            originalError
        };
        super(options);
    }
}

/**
 * 栄養計算に関連するエラー
 */
export class NutritionCalculationError extends AppError {
    constructor(
        message: string,
        foodItems?: Array<{ name: string; quantity?: string }>,
        originalError?: Error
    ) {
        const options: ErrorOptions = {
            code: ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR,
            message,
            userMessage: '栄養計算中にエラーが発生しました',
            details: { foodItems },
            severity: 'error',
            suggestions: [
                '食品と量の情報を確認してください',
                '正しい形式で入力されているか確認してください'
            ],
            originalError
        };
        super(options);
    }
}

/**
 * 食品データベースアクセスに関連するエラー
 */
export class FoodRepositoryError extends AppError {
    constructor(
        message: string,
        operation: string,
        originalError?: Error
    ) {
        const options: ErrorOptions = {
            code: ErrorCode.Nutrition.FOOD_REPOSITORY_ERROR,
            message,
            userMessage: '食品データベースへのアクセス中にエラーが発生しました',
            details: { operation },
            severity: 'error',
            suggestions: [
                'しばらく経ってから再度お試しください',
                'システム管理者に連絡してください'
            ],
            originalError
        };
        super(options);
    }
}

/**
 * 栄養データの不足に関連するエラー
 */
export class MissingNutritionDataError extends AppError {
    constructor(
        message: string,
        foodName: string,
        missingNutrients: string[],
        originalError?: Error
    ) {
        const options: ErrorOptions = {
            code: ErrorCode.Nutrition.MISSING_NUTRITION_DATA,
            message,
            userMessage: `「${foodName}」の栄養データが不足しています`,
            details: { foodName, missingNutrients },
            severity: 'warning',
            suggestions: [
                '別の類似した食品を選択してください',
                'より一般的な食品名を使用してください'
            ],
            originalError
        };
        super(options);
    }
} 