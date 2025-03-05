import { NextResponse } from 'next/server';
import { AIError, ErrorCode } from './ai-error';

/**
 * APIハンドラーをエラーハンドリングでラップするユーティリティ関数
 * @param handler APIハンドラー関数
 * @returns ラップされたハンドラー関数
 */
export function withErrorHandling(handler: (req: Request) => Promise<Response>) {
    return async (req: Request) => {
        try {
            return await handler(req);
        } catch (error) {
            console.error('API Error:', error);

            // AIエラーの場合
            if (error instanceof AIError) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: error.code,
                            message: error.message,
                            details: error.details
                        }
                    },
                    { status: getStatusCodeForError(error.code) }
                );
            }

            // その他のエラー
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'internal_error',
                        message: 'サーバー内部エラーが発生しました',
                        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
                    }
                },
                { status: 500 }
            );
        }
    };
}

/**
 * エラーコードに対応するHTTPステータスコードを取得
 */
function getStatusCodeForError(code: ErrorCode): number {
    switch (code) {
        case ErrorCode.VALIDATION_ERROR:
            return 400; // Bad Request
        case ErrorCode.AUTHENTICATION_ERROR:
            return 401; // Unauthorized
        case ErrorCode.AUTHORIZATION_ERROR:
            return 403; // Forbidden
        case ErrorCode.RESOURCE_NOT_FOUND:
            return 404; // Not Found
        case ErrorCode.RATE_LIMIT_EXCEEDED:
            return 429; // Too Many Requests
        case ErrorCode.AI_MODEL_ERROR:
        case ErrorCode.RESPONSE_PARSE_ERROR:
        case ErrorCode.INTERNAL_ERROR:
        default:
            return 500; // Internal Server Error
    }
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