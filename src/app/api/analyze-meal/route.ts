import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, createErrorResponse } from '@/lib/util/error-handler';
import { ApiAdapter } from '@/lib/api/api-adapter';

/**
 * 旧式の食事解析API - 新しいAPIにリダイレクト
 * 
 * このAPIはv2 APIへブリッジするためのものです。
 * 新しい実装では、/api/v2/meal/analyze または /api/v2/meal/text-analyze を使用してください。
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
    try {
        const requestData = await req.json();

        // リクエストタイプを判別（テキスト or 画像）
        const hasText = requestData.text && typeof requestData.text === 'string' && requestData.text.trim().length > 0;
        const hasImage = requestData.image && typeof requestData.image === 'string' && requestData.image.trim().length > 0;

        if (!hasText && !hasImage) {
            return createErrorResponse(
                'テキストまたは画像の入力が必要です',
                'INVALID_INPUT',
                400
            );
        }

        // 新しいAPIエンドポイントに転送
        const apiUrl = hasText
            ? '/api/v2/meal/text-analyze'
            : '/api/v2/meal/analyze';

        // 新しいAPIにリクエスト転送
        const response = await fetch(new URL(apiUrl, req.url), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(req.headers.get('Authorization') ? { 'Authorization': req.headers.get('Authorization')! } : {})
            },
            body: JSON.stringify(requestData)
        });

        // レスポンスを取得
        const responseData = await response.json();

        // 新しいAPIフォーマットから旧形式に変換
        const legacyResponse = ApiAdapter.convertStandardToLegacy(responseData);

        // 旧形式のレスポンスを返却
        return NextResponse.json(legacyResponse, {
            status: response.status
        });

    } catch (error) {
        console.error('食事解析APIエラー:', error);
        return createErrorResponse(
            '食事解析中にエラーが発生しました',
            'ANALYSIS_ERROR',
            500
        );
    }
}); 