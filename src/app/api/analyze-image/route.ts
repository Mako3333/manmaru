import { NextResponse } from "next/server";
import { z } from "zod";
import { AIService } from "@/lib/ai/ai-service";
import { AIError, ErrorCode } from "@/lib/errors/ai-error";
import { withErrorHandling } from "@/lib/errors/error-utils";

// リクエスト用のZodスキーマ
const RequestSchema = z.object({
    imageBase64: z.string(),
    mimeType: z.string().optional().default('image/jpeg')
});

// 画像解析のAPIエンドポイント
export const POST = withErrorHandling(async (request: Request) => {
    console.log('画像解析リクエスト受信');
    const body = await request.json();

    // リクエストデータの検証
    const { imageBase64, mimeType } = RequestSchema.parse(body);

    // 画像データがない場合はエラー
    if (!imageBase64) {
        throw new AIError(
            '画像データが必要です',
            ErrorCode.VALIDATION_ERROR,
            null,
            ['画像データが空です']
        );
    }

    // AIサービスのインスタンスを取得
    const aiService = AIService.getInstance();

    // 食事タイプは「その他」として解析
    const result = await aiService.analyzeMeal(imageBase64, 'その他');

    console.log('画像解析API: 解析成功', JSON.stringify(result).substring(0, 100) + '...');

    // 結果を返却
    return NextResponse.json(result);
}); 