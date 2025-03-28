import { AppError, ErrorCode } from '../errors/app-errors';

/**
 * 食品マッチング関連のエラーハンドリング
 */
export class FoodMatchingErrorHandler {
    /**
     * 食品が見つからない場合のエラーを生成
     */
    static foodNotFound(foodName: string): AppError {
        return new AppError(
            `食品「${foodName}」が見つかりませんでした`,
            ErrorCode.FOOD_RECOGNITION_ERROR,
            `「${foodName}」は見つかりませんでした。別の名前で検索してください。`,
            { foodName },
            'warning',
            [
                '類似した名前で検索してみてください',
                'より一般的な食品名を使用してください',
                'カテゴリ名で検索することもできます'
            ]
        );
    }

    /**
     * 確信度が低い場合のエラーを生成
     */
    static lowConfidenceMatch(foodName: string, matchedName: string, confidence: number): AppError {
        return new AppError(
            `食品「${foodName}」の確信度が低いです（${confidence.toFixed(2)}）`,
            ErrorCode.FOOD_RECOGNITION_ERROR,
            `「${foodName}」は「${matchedName}」と一致しましたが、確信度が低いです。確認をお願いします。`,
            { foodName, matchedName, confidence },
            'info',
            [
                '一致した食品が正しいか確認してください',
                '正しくない場合は、より具体的な名前で検索してください'
            ]
        );
    }

    /**
     * 食品リポジトリのエラーを処理
     */
    static handleRepositoryError(error: unknown, operation: string): AppError {
        if (error instanceof AppError) {
            return error;
        }

        const message = error instanceof Error ? error.message : '不明なエラー';
        return new AppError(
            `食品リポジトリの操作「${operation}」でエラーが発生しました: ${message}`,
            ErrorCode.DATA_PROCESSING_ERROR,
            '食品データの取得中にエラーが発生しました。しばらく経ってから再度お試しください。',
            { operation, originalError: error },
            'error',
            [
                'アプリを再起動してください',
                'インターネット接続を確認してください'
            ],
            error instanceof Error ? error : undefined
        );
    }
} 