import { NextResponse } from 'next/server';
import { AIError, ErrorCode, createErrorResponse } from './ai-error';

/**
 * API用のエラーハンドララッパー
 * @param fn API関数
 * @returns ラップされたAPI関数
 */
export function withErrorHandling(fn: Function) {
    return async (request: Request) => {
        try {
            // 元の関数を実行
            return await fn(request);
        } catch (error) {
            console.error('API Error:', error);

            // AIError型へ変換
            const aiError = error instanceof AIError
                ? error
                : new AIError(
                    error instanceof Error ? error.message : '不明なエラーが発生しました',
                    ErrorCode.UNKNOWN_ERROR,
                    error
                );

            // エラーレスポンスを生成
            return NextResponse.json(
                createErrorResponse(aiError),
                { status: aiError.code.includes('validation') ? 400 : 500 }
            );
        }
    };
}

/**
 * APIキーチェック関数
 * @throws AIError if API key is missing
 */
export function checkApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new AIError(
            'API設定エラー',
            ErrorCode.API_KEY_ERROR,
            null,
            ['環境変数GEMINI_API_KEYを設定してください']
        );
    }
    return apiKey;
} 