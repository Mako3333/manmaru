import { FoodInputParser, FoodInputParseResult } from './food-input-parser';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import type { MealAnalysisResult } from '@/types/ai'; // Assuming AIService returns this type

/**
 * テキスト解析の結果を表すインターフェース
 */
export interface FoodParseServiceResult {
    foods: FoodInputParseResult[];
    analysisSource: 'parser' | 'ai';
    confidence?: number; // AI解析の場合のみ
    aiRawResult?: MealAnalysisResult | null; // AIの生の結果 (デバッグ用など)
    error?: AppError | null; // 処理中にエラーが発生した場合
}

/**
 * テキスト入力を解析し、食品リストを取得する共通サービス
 *
 * @param text 解析対象のテキスト
 * @returns FoodParseServiceResult 解析結果
 */
export async function parseFoodInputText(text: string): Promise<FoodParseServiceResult> {
    let foods: FoodInputParseResult[] = [];
    let analysisSource: 'parser' | 'ai' = 'parser';
    let confidence: number | undefined = undefined;
    let aiRawResult: MealAnalysisResult | null = null;
    let serviceError: AppError | null = null;

    if (!text || text.trim().length === 0) {
        return {
            foods: [],
            analysisSource: 'parser', // Or handle as error?
            error: new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'Input text is empty.',
                userMessage: "テキストが入力されていません。",
            }),
        };
    }

    // 1. 直接解析を試みる
    try {
        foods = FoodInputParser.parseBulkInput(text);
        if (foods.length > 0) {
            return { foods, analysisSource: 'parser' };
        }
    } catch (parseError) {
        serviceError = new AppError({
            code: ErrorCode.Base.DATA_PROCESSING_ERROR, // Consider a specific parser error code?
            message: `FoodInputParser failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            originalError: parseError instanceof Error ? parseError : undefined
        });
        foods = [];
    }

    // 2. AIフォールバック
    analysisSource = 'ai';
    try {
        const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);
        aiRawResult = await aiService.analyzeMealText(text);

        if (aiRawResult.error) {
            serviceError = new AppError({
                code: ErrorCode.AI.ANALYSIS_ERROR,
                message: aiRawResult.error.message || 'AI text analysis failed',
                details: { originalError: aiRawResult.error.details },
                userMessage: "食事の解析中にAIサービスで問題が発生しました。"
            });
            foods = [];
        } else {
            foods = aiRawResult.foods || [];
            confidence = aiRawResult.confidence;
            if (serviceError) {
            }
        }
    } catch (aiError) {
        serviceError = new AppError({
            code: ErrorCode.AI.API_REQUEST_ERROR,
            message: `AI service call failed: ${aiError instanceof Error ? aiError.message : String(aiError)}`,
            userMessage: "食事の解析に必要なAIサービスに接続できませんでした。",
            originalError: aiError instanceof Error ? aiError : undefined
        });
        foods = [];
    }

    // 最終結果を返す
    return {
        foods,
        analysisSource,
        ...(confidence !== undefined ? { confidence } : {}),
        aiRawResult,
        error: serviceError,
    };
} 