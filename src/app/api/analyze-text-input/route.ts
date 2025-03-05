import { NextResponse } from "next/server";
import { z } from "zod";
import {
    FoodItem,
    DetectedFoods
} from "@/types/nutrition";
import { createGeminiModel } from "@/lib/langchain/langchain";
import { AIResponseParser } from "@/lib/ai/response-parser";
import { FoodAnalysisError, ErrorCode, createErrorResponse } from "@/lib/errors/food-analysis-error";
import { NutritionDatabase } from "@/lib/nutrition/database";
import { AIModelFactory } from '@/lib/ai/model-factory';
import { PromptService, PromptType } from '@/lib/ai/prompts/prompt-service';
import { formatFoodsText } from '@/lib/ai/prompts/prompt-utils';
import { withErrorHandling } from '@/lib/errors/error-utils';
import { AIError } from '@/lib/errors/ai-error';

// リクエスト用のZodスキーマ
const RequestSchema = z.object({
    foods: z.array(z.object({
        name: z.string(),
        quantity: z.string().optional()
    }))
});

// テキスト入力解析のAPIエンドポイント
export const POST = withErrorHandling(async (request: Request) => {
    try {
        console.log('テキスト解析リクエスト受信');
        const body = await request.json();
        console.log('リクエストボディ:', body);

        // APIキーの取得と検証
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            throw new AIError(
                'API設定エラー',
                ErrorCode.API_KEY_ERROR,
                null,
                ['GEMINI_API_KEY環境変数を設定してください']
            );
        }

        // リクエストデータの検証
        const { foods } = RequestSchema.parse(body);

        // 食品データがない場合はエラー
        if (!foods || foods.length === 0) {
            throw new AIError(
                '食品データが必要です',
                ErrorCode.VALIDATION_ERROR,
                null,
                ['少なくとも1つの食品を入力してください']
            );
        }

        // AIモデルファクトリーの使用
        const model = AIModelFactory.createTextModel({
            temperature: 0.2,
            maxOutputTokens: 1024
        });

        // プロンプトサービスの使用
        const promptService = PromptService.getInstance();
        const foodsText = formatFoodsText(foods);
        const prompt = promptService.generateTextInputAnalysisPrompt({ foodsText });

        // AIモデル呼び出し
        console.log('テキスト解析API: Gemini API呼び出し');
        const result = await model.invoke(prompt);
        const responseText = result.toString();

        // JSONレスポンスの抽出
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new FoodAnalysisError(
                'AIからの応答を解析できませんでした',
                ErrorCode.RESPONSE_PARSE_ERROR,
                responseText
            );
        }

        // JSONパース
        try {
            const jsonResponse = JSON.parse(jsonMatch[0]);
            console.log('テキスト解析API: 解析成功', JSON.stringify(jsonResponse).substring(0, 100) + '...');
            return NextResponse.json(jsonResponse);
        } catch (parseError) {
            throw new FoodAnalysisError(
                'AIレスポンスのJSON解析に失敗しました',
                ErrorCode.RESPONSE_PARSE_ERROR,
                { error: parseError, text: jsonMatch[0] }
            );
        }
    } catch (error) {
        // エラー変換処理
        if (error instanceof FoodAnalysisError || error instanceof AIError) {
            throw error;
        }

        if (error instanceof z.ZodError) {
            throw new AIError(
                'リクエスト形式が不正です',
                ErrorCode.VALIDATION_ERROR,
                error
            );
        }

        throw new AIError(
            'テキスト解析中にエラーが発生しました',
            ErrorCode.AI_MODEL_ERROR,
            error
        );
    }
});