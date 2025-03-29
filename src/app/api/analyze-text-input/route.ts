//src\app\api\analyze-text-input\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ApiAdapter } from '@/lib/api/api-adapter';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';

/**
 * 食事テキスト入力解析APIエンドポイント（レガシー互換ラッパー）
 * テキスト入力を受け取り、新APIにリダイレクトします
 */
export async function POST(request: NextRequest) {
    console.log('API: テキスト入力解析リクエスト受信（レガシーエンドポイント）');

    try {
        // リクエストボディの解析
        let body: any;
        try {
            body = await request.json();
        } catch (error) {
            throw new ApiError(
                'リクエストボディのJSONパースに失敗しました',
                ErrorCode.DATA_VALIDATION_ERROR,
                '無効なリクエスト形式です',
                400,
                { originalError: error }
            );
        }

        // 必須フィールドの確認
        const { text } = body;
        if (!text) {
            throw new ApiError(
                'テキスト入力が必要です',
                ErrorCode.DATA_VALIDATION_ERROR,
                'テキスト入力を指定してください',
                400
            );
        }

        // 新APIへリクエストを転送
        const response = await fetch(new URL('/api/v2/food/parse', request.url), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 認証トークンを引き継ぐ
                ...Object.fromEntries(request.headers)
            },
            body: JSON.stringify({ text })
        });

        // レスポンスの変換処理
        const result = await response.json();

        // 新APIレスポンスを旧形式に変換
        const legacyResponse = ApiAdapter.convertStandardToLegacy(result);

        console.log('API: テキスト入力解析完了（旧形式に変換）');
        return NextResponse.json(legacyResponse);

    } catch (error) {
        console.error('API: テキスト入力解析エラー', error);

        // エラーレスポンス
        return NextResponse.json(
            {
                success: false,
                error: error instanceof ApiError
                    ? error.userMessage
                    : 'エラーが発生しました。しばらく経ってから再度お試しください。',
                errorCode: error instanceof ApiError
                    ? error.code
                    : ErrorCode.UNKNOWN_ERROR,
                details: process.env.NODE_ENV === 'development'
                    ? error instanceof Error ? error.message : String(error)
                    : undefined
            },
            { status: error instanceof ApiError ? error.statusCode : 500 }
        );
    }
}

/**
 * プリフライトリクエスト対応
 */
export async function OPTIONS() {
    return NextResponse.json({ message: 'OK' });
}