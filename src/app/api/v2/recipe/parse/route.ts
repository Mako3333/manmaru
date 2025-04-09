import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api/middleware';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import type { RecipeAnalysisResult } from '@/types/ai';
import { z } from 'zod';
import {
    createStandardizedMealNutrition,
    convertToLegacyNutrition
} from '@/lib/nutrition/nutrition-type-utils';
import { StandardizedMealNutrition, Nutrient, NutritionData } from '@/types/nutrition';
import { IAIService } from '@/lib/ai/ai-service.interface';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';
import { JSDOM } from 'jsdom';
import { getRecipeParser } from '@/lib/recipe-parsers/parser-factory';
import { RecipeParser } from '@/lib/recipe-parsers/parser-interface';
import { GenericParser } from '@/lib/recipe-parsers/generic';
import * as cheerio from 'cheerio';

// リクエストの検証スキーマ
const requestSchema = z.object({
    url: z.string().url("有効なURLを指定してください").optional(),
    text: z.string().min(1, "テキストを入力してください").optional(),
})
    .refine(data => data.url || data.text, {
        message: "URLまたはテキストのいずれか一方を指定してください",
        path: ["url", "text"], // エラーメッセージを関連付けるパス
    });

/**
 * レシピ解析API v2
 * ハイブリッドアプローチ: 専用パーサー優先、AIフォールバック
 */
export const POST = withErrorHandling(async (req: NextRequest): Promise<NextResponse> => {
    const requestData = await req.json();
    try {
        const validatedData = requestSchema.parse(requestData);
        const url = validatedData.url?.trim();

        if (!url) { // ハイブリッドアプローチでは URL が必須
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'レシピURLが必要です'
            });
        }

        // TODO: sanitizeAndValidateUrl がないので、一時的に簡易バリデーション
        try {
            new URL(url); // URL形式かチェック
        } catch (_) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '無効な形式のURLです。',
            });
        }

        const startTime = Date.now();

        // 1. HTML取得 & DOM構築
        console.log(`[API Route] Fetching HTML for: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
            signal: AbortSignal.timeout(15000), // 15秒タイムアウト
            redirect: 'follow' // リダイレクトに従う
        });
        if (!response.ok) {
            throw new AppError({
                code: ErrorCode.Base.NETWORK_ERROR, // より適切なエラーコードに変更
                message: `URLの取得に失敗しました: ${response.status} ${response.statusText}`,
                details: { url }
            });
        }
        const htmlContent = await response.text();
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;
        console.log(`[API Route] HTML fetched and DOM created for: ${url}`);

        // 2. パーサー取得
        const parser: RecipeParser = getRecipeParser(url);
        console.log(`[API Route] Using parser: ${parser.constructor.name}`);

        let recipeTitle: string | undefined = 'レシピ';
        let servingsString: string | undefined = '1人分';
        let ingredients: FoodInputParseResult[] = [];
        let analysisSource: 'parser' | 'ai' = 'parser'; // 解析ソースを記録

        // 3. パーサー実行 or AI実行
        if (!(parser instanceof GenericParser)) {
            // 3a. 専用パーサーの場合
            console.log(`[API Route] Using dedicated parser: ${parser.constructor.name}`);
            try {
                recipeTitle = parser.extractTitle(document) || recipeTitle;
                ingredients = parser.extractIngredients(document);
                // TODO: servings はインターフェースにないので、別途取得方法を検討
                // 例: const servings = parser.extractServings ? parser.extractServings(document) : servingsString;

                console.log(`[API Route] Parsed by dedicated parser: ${ingredients.length} ingredients found.`);
                analysisSource = 'parser';
            } catch (parseError) {
                console.error(`[API Route] Dedicated parser error, falling back to AI:`, parseError);
                analysisSource = 'ai'; // AIフォールバックフラグ
                // エラーが発生してもAIフォールバックに進むため、ここではエラーを投げない
                // 必要に応じてエラー内容をログに残すか、meta情報に追加する
            }
        }

        // 汎用パーサー(未対応サイト) または 専用パーサーエラーの場合 -> AIフォールバック
        if (parser instanceof GenericParser || analysisSource === 'ai') {
            console.log(`[API Route] Analyzing with AI for: ${url} (Source: ${analysisSource})`);
            const aiService: IAIService = AIServiceFactory.getService(AIServiceType.GEMINI);

            // --- HTMLクリーンアップ (cheerio) --- START
            let cleanedHtml = htmlContent;
            try {
                const $ = cheerio.load(htmlContent);

                // 不要な要素を削除 (例: script, style, header, footer, nav, aside)
                // より高度なレシピ本文抽出ロジックも検討可能
                $('script, style, header, footer, nav, aside, .ad, [class*="advertisement"], [id*="ad"], form').remove();

                // 主要なレシピコンテンツが含まれていそうな要素を選択 (例)
                // より洗練されたセレクタが必要になる場合がある
                const mainContentSelectors = ['main', 'article', '.recipe', '#recipe', '[itemprop="recipeInstructions"]', '[class*="recipe-content"]'];
                let mainContentHtml = '';
                for (const selector of mainContentSelectors) {
                    if ($(selector).length > 0) {
                        mainContentHtml = $(selector).html() || '';
                        // logger.debug(`[HTML Cleanup] Found main content with selector: ${selector}`);
                        // console.log(`[HTML Cleanup] Found main content with selector: ${selector}`); // logger 代替コメントアウト
                        break; // 最初に見つかった主要コンテンツを使用
                    }
                }

                if (mainContentHtml) {
                    cleanedHtml = `<html><body>${mainContentHtml}</body></html>`;
                    // logger.info(`[HTML Cleanup] Extracted main content for AI analysis.`);
                    // console.log(`[HTML Cleanup] Extracted main content for AI analysis.`); // logger 代替コメントアウト
                } else {
                    // 主要コンテンツが見つからない場合は、クリーンアップされた全体のHTMLを使用
                    cleanedHtml = $.html();
                    // logger.warn(`[HTML Cleanup] Could not find main content container. Using cleaned full HTML.`);
                    // console.warn(`[HTML Cleanup] Could not find main content container. Using cleaned full HTML.`); // logger 代替コメントアウト
                }

                // さらに不要な空白や改行を削除してトークン数を削減
                cleanedHtml = cleanedHtml.replace(/\s{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();
                // logger.debug(`[HTML Cleanup] Cleaned HTML length: ${cleanedHtml.length}`);
                // console.log(`[HTML Cleanup] Cleaned HTML length: ${cleanedHtml.length}`); // logger 代替コメントアウト

            } catch (cleanupError) {
                // logger.error(`[HTML Cleanup Error] Failed to clean HTML for ${url}`, cleanupError);
                console.error(`[HTML Cleanup Error] Failed to clean HTML for ${url}`, cleanupError); // logger 代替
                // クリーンアップに失敗しても、元のHTMLで続行する
                cleanedHtml = htmlContent;
            }
            // --- HTMLクリーンアップ (cheerio) --- END

            // AIによる解析 (戻り値の型を RecipeAnalysisResult に)
            const aiResult: RecipeAnalysisResult = await aiService.parseRecipeFromUrl(url, cleanedHtml);

            if (aiResult.error) {
                throw new AppError({
                    code: ErrorCode.AI.ANALYSIS_FAILED,
                    message: aiResult.error.message || 'AIによるレシピ解析に失敗しました',
                    details: aiResult.error.details
                });
            }

            recipeTitle = aiResult.title || recipeTitle;
            servingsString = aiResult.servings || servingsString;
            ingredients = aiResult.ingredients || []; // RecipeAnalysisResult型のプロパティに合わせる
            console.log(`[API Route] Parsed by AI: ${ingredients.length} ingredients found.`);
            analysisSource = 'ai';
        }

        // 4. servingsString から数値を取得 (1人前計算用) - 共通処理
        let servingsNum = 1;
        if (servingsString) {
            const match = servingsString.match(/\d+/);
            if (match) {
                const parsed = parseInt(match[0], 10);
                if (!isNaN(parsed) && parsed > 0) servingsNum = parsed;
            }
        }

        // 5. 材料リストの検証 - 共通処理
        if (ingredients.length === 0) {
            throw new AppError({
                code: ErrorCode.Nutrition.FOOD_NOT_FOUND,
                message: '材料が検出されませんでした',
                details: { reason: 'レシピから材料を検出できませんでした。' + (analysisSource === 'parser' ? ' (専用パーサー使用)' : ' (AI使用)'), url }
            });
        }

        // 6. 栄養計算の実行 - 共通処理
        console.log(`[API Route] Calculating nutrition for ${ingredients.length} ingredients...`);
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);
        const nameQuantityPairs = ingredients.map((item: FoodInputParseResult) => ({
            name: item.foodName,
            quantity: item.quantityText || undefined
        })) as Array<{ name: string; quantity?: string }>;
        const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);
        console.log(`[API Route] Nutrition calculation complete.`);

        // 7. 結果の整形と返却 - StandardizedMealNutrition に統一
        // NutritionService からの結果を Standardized に変換
        // すでに StandardizedMealNutrition 型の場合はそのまま使用
        let standardizedNutrition: StandardizedMealNutrition;

        if (nutritionResult.nutrition && 'totalCalories' in nutritionResult.nutrition) {
            // すでに StandardizedMealNutrition 型の場合（テスト環境など）
            standardizedNutrition = nutritionResult.nutrition as StandardizedMealNutrition;
        } else {
            // Legacy 形式から変換が必要な場合
            const originalNutritionData = nutritionResult.nutrition as unknown as NutritionData;
            standardizedNutrition = createStandardizedMealNutrition(originalNutritionData);
        }

        // 1人前あたりの栄養素を計算
        const perServingNutrition: StandardizedMealNutrition | undefined = servingsNum > 1
            ? {
                ...standardizedNutrition,
                totalCalories: standardizedNutrition.totalCalories / servingsNum,
                totalNutrients: standardizedNutrition.totalNutrients.map(nutrient => ({
                    ...nutrient,
                    value: nutrient.value / servingsNum
                }))
            }
            : undefined;

        // 後方互換性のために legacyNutrition も生成 (オプション)
        const legacyNutrition = convertToLegacyNutrition(standardizedNutrition);
        const legacyPerServing = perServingNutrition ? convertToLegacyNutrition(perServingNutrition) : undefined;

        let warningMessage;
        if (nutritionResult.reliability.confidence < 0.7) {
            warningMessage = '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }
        if (analysisSource === 'ai' && ingredients.length > 0) {
            warningMessage = (warningMessage ? warningMessage + ' ' : '') + 'AIによる解析のため、精度が低い可能性があります。';
        }

        return NextResponse.json({
            success: true,
            data: {
                recipe: {
                    title: recipeTitle,
                    servings: servingsString,
                    ingredients: nameQuantityPairs,
                    sourceUrl: url
                },
                nutritionResult: {
                    nutrition: standardizedNutrition,
                    perServing: perServingNutrition,
                    legacyNutrition: legacyNutrition,
                    legacyPerServing: legacyPerServing,
                    reliability: nutritionResult.reliability,
                    matchResults: nutritionResult.matchResults
                }
            },
            meta: {
                processingTimeMs: Date.now() - startTime,
                analysisSource: analysisSource,
                ...(warningMessage ? { warning: warningMessage } : {})
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '入力データが無効です',
                details: {
                    reason: error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
                    originalError: error
                }
            });
        }
        if (error instanceof AppError) throw error;
        console.error('[API Route] Unexpected error:', error);
        throw new AppError({
            code: ErrorCode.Base.API_ERROR,
            message: '予期せぬエラーが発生しました。' + (error instanceof Error ? ` (${error.message})` : ''),
            originalError: error instanceof Error ? error : new Error(String(error))
        });
    }
});

/**
 * プリフライトリクエスト対応
 */
export const OPTIONS = withErrorHandling(async () => {
    return NextResponse.json({ success: true, data: { message: 'OK' } });
}); 