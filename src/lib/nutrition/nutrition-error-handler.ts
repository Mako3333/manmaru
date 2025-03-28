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
    static handleCalculationError(error: unknown, foodItems?: Array<{ name: string; quantity?: string }>): AppError {
        if (error instanceof AppError) {
            return error;
        }

        const errorMessage = error instanceof Error
            ? error.message
            : '栄養計算中に不明なエラーが発生しました';

        return new AppError(
            errorMessage,
            ErrorCode.NUTRITION_CALCULATION_ERROR,
            '栄養計算中にエラーが発生しました',
            { foodItems, originalError: error },
            'error',
            [
                '食品データと量の情報を確認してください',
                '別の食品名で試してみてください'
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
            ErrorCode.QUANTITY_PARSE_ERROR,
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
            ErrorCode.DATA_VALIDATION_ERROR,
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

    /**
     * 食品が見つからない場合のエラーを処理
     */
    static foodNotFoundError(foodName: string): AppError {
        return new AppError(
            `食品「${foodName}」が見つかりませんでした`,
            ErrorCode.FOOD_NOT_FOUND,
            `「${foodName}」が食品データベースに見つかりませんでした。`,
            { foodName },
            'warning',
            [
                '別の名前や表現で検索してみてください',
                'より一般的な食品名を使用してみてください',
                '該当する食品が類似した名前で登録されている可能性があります'
            ]
        );
    }

    /**
     * 食品マッチング低信頼度エラーを処理
     */
    static foodMatchLowConfidenceError(foodName: string, matchedFood: string, confidence: number): AppError {
        return new AppError(
            `食品「${foodName}」の一致度が低いです（${confidence}）`,
            ErrorCode.FOOD_MATCH_LOW_CONFIDENCE,
            `「${foodName}」は「${matchedFood}」と一致しましたが、信頼度が低いです。`,
            { foodName, matchedFood, confidence },
            'warning',
            [
                'より明確な食品名を入力してみてください',
                '提案された食品が正しくない場合は、別の名前で試してください'
            ]
        );
    }
} 