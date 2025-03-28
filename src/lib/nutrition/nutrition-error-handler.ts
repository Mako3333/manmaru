import { AppError, ErrorCode } from '../errors/app-errors';

// 食品名と量のペアを表す型
interface NameQuantityPair {
    name: string;
    quantity?: string;
}

/**
 * 栄養計算関連のエラーハンドリング
 */
export class NutritionErrorHandler {
    /**
     * 栄養計算の一般的なエラーを処理
     */
    static handleCalculationError(error: unknown, foods?: NameQuantityPair[]): AppError {
        if (error instanceof AppError) {
            return error;
        }

        const message = error instanceof Error ? error.message : '不明なエラー';
        return new AppError(
            `栄養計算でエラーが発生しました: ${message}`,
            ErrorCode.NUTRITION_CALCULATION_ERROR,
            '栄養計算の処理中にエラーが発生しました。',
            { foods, originalError: error },
            'error',
            [
                '入力した食品名と量を確認してください',
                'しばらく経ってから再度お試しください'
            ],
            error instanceof Error ? error : undefined
        );
    }

    /**
     * 量解析のエラーを処理
     */
    static quantityParseError(quantityText: string): AppError {
        return new AppError(
            `量「${quantityText}」の解析に失敗しました`,
            ErrorCode.NUTRITION_CALCULATION_ERROR,
            `「${quantityText}」の解析ができませんでした。正しい形式で入力してください。`,
            { quantityText },
            'warning',
            [
                '例: 「100g」「大さじ1」「1個」などの形式で入力してください',
                '単位を明確に指定すると解析しやすくなります'
            ]
        );
    }

    /**
     * 不正な食品データのエラーを処理
     */
    static invalidFoodDataError(foodName: string, details?: any): AppError {
        return new AppError(
            `食品「${foodName}」のデータが不正です`,
            ErrorCode.NUTRITION_CALCULATION_ERROR,
            `「${foodName}」の栄養データに問題があります。別の食品を試してください。`,
            { foodName, details },
            'error',
            [
                '別の類似した食品を選択してみてください',
                '管理者に問題を報告してください'
            ]
        );
    }

    /**
     * 栄養素データ不足のエラーを処理
     */
    static missingNutritionDataError(foodName: string): AppError {
        return new AppError(
            `食品「${foodName}」の栄養素データが不足しています`,
            ErrorCode.NUTRITION_CALCULATION_ERROR,
            `「${foodName}」の栄養情報が不完全です。計算結果が正確でない可能性があります。`,
            { foodName },
            'warning',
            [
                '必要な栄養素データが揃っている別の食品を選択してみてください',
                '栄養情報が完全な食品を選択することで、より正確な計算結果が得られます'
            ]
        );
    }
} 