//src\lib\ai\gemini-response-parser.ts
import { FoodInputParseResult } from '@/lib/food/food-input-parser';

/**
 * AIデバッグ情報の型定義
 */
export interface GeminiDebugInfo {
    parsedData?: Record<string, unknown>;
    sourceFormat?: 'nutrition_advice' | 'recipe' | 'food/text/image' | string;
    [key: string]: unknown;
}

/**
 * AI応答の解析結果を表す型
 */
export interface GeminiParseResult {
    foods?: FoodInputParseResult[];
    confidence?: number; // Optional number
    title?: string;
    servings?: string;
    // nutrition プロパティは必須だが、値は undefined になりうる
    nutrition: { [key: string]: number | string } | undefined;
    advice_summary?: string;
    advice_detail?: string;
    recommended_foods?: { name: string; description: string | undefined }[];
    error?: string;
    debug?: GeminiDebugInfo;
}

/**
 * AI入力データの型定義
 */
export interface GeminiInputData {
    text?: string;
    imageDescription?: string;
    imageUrl?: string;
    [key: string]: unknown;
}

/**
 * Gemini APIの応答を解析するパーサー
 */
export class GeminiResponseParser {
    /**
     * AI応答テキストから食品リストを解析
     * 戻り値の型を GeminiParseResult に変更
     */
    async parseResponse(responseText: string): Promise<GeminiParseResult> {
        console.log(`[GeminiResponseParser] Parsing response (length: ${responseText.length})`);
        try {
            // ```json ... ``` ブロックを探す
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            let jsonStr = '';

            if (jsonMatch && jsonMatch[1]) {
                jsonStr = jsonMatch[1].trim();
                console.log(`[GeminiResponseParser] Found JSON block.`);
            } else {
                // JSONブロックがない場合、全体がJSONであると仮定してみる
                try {
                    // 応答全体がJSONとしてパースできるか試す
                    JSON.parse(responseText);
                    jsonStr = responseText.trim();
                    console.log(`[GeminiResponseParser] Response might be raw JSON.`);
                } catch (e) {
                    // パース失敗ならJSONではないと判断
                    console.error('[GeminiResponseParser] Failed to find or parse JSON block:', responseText);
                    return {
                        // nutrition プロパティを追加
                        nutrition: undefined,
                        error: 'AIの応答から有効なJSONデータが見つかりませんでした。'
                    };
                }
            }

            if (!jsonStr) {
                // nutrition プロパティを追加
                return { nutrition: undefined, error: '抽出されたJSON文字列が空です。' };
            }

            console.log(`[GeminiResponseParser] Extracted JSON string (preview): ${jsonStr.substring(0, 100)}...`);
            const parsedData = JSON.parse(jsonStr) as Record<string, unknown>;

            // 優先度: アドバイス形式かチェック
            if ('advice_summary' in parsedData || 'advice_detail' in parsedData || 'recommended_foods' in parsedData) {
                console.log('[GeminiResponseParser] Parsing as Nutrition Advice result.');
                // recommended_foods の型チェックと変換
                const recommended_foods = Array.isArray(parsedData.recommended_foods) ?
                    parsedData.recommended_foods.map((item: Record<string, unknown>) => ({
                        name: typeof item?.name === 'string' ? item.name : '不明な食品',
                        description: typeof item?.description === 'string' ? item.description : undefined
                    })) : undefined;

                // Optional プロパティを安全に取得
                const advice_summary = typeof parsedData.advice_summary === 'string' ? parsedData.advice_summary : undefined;
                const advice_detail = typeof parsedData.advice_detail === 'string' ? parsedData.advice_detail : undefined;

                return {
                    nutrition: undefined,
                    // 値が undefined でない場合のみプロパティを追加
                    ...(advice_summary !== undefined && { advice_summary }),
                    ...(advice_detail !== undefined && { advice_detail }),
                    ...(recommended_foods !== undefined && { recommended_foods }),
                    debug: { parsedData, sourceFormat: 'nutrition_advice' }
                };
            }
            // 次にレシピ解析結果かチェック
            else if ('title' in parsedData || 'servings' in parsedData || 'ingredients' in parsedData) {
                console.log('[GeminiResponseParser] Parsing as Recipe Analysis result.');
                const foods: FoodInputParseResult[] = Array.isArray(parsedData.ingredients) ?
                    (parsedData.ingredients || []).map((item: Record<string, unknown>) => ({
                        foodName: item.name as string || '',
                        quantityText: item.quantity as string | null || null,
                        confidence: 0.8 // レシピの材料には信頼度がないためデフォルト値
                    })) : [];
                return {
                    // nutrition プロパティを追加
                    nutrition: undefined,
                    foods,
                    title: parsedData.title as string,
                    servings: parsedData.servings as string,
                    debug: { parsedData, sourceFormat: 'recipe' }
                };
            }
            // 次に画像・テキスト解析結果かチェック
            else if ('foods' in parsedData) {
                console.log('[GeminiResponseParser] Parsing as Food/Text/Image Analysis result.');
                const foods: FoodInputParseResult[] = Array.isArray(parsedData.foods) ?
                    (parsedData.foods || []).map((item: Record<string, unknown>) => ({
                        foodName: item.name as string || '',
                        quantityText: item.quantity as string | null || null,
                        // confidence は item に存在すれば number、なければ default 値
                        confidence: typeof item.confidence === 'number' ? item.confidence : 0.7
                    })) : [];
                // confidence は parsedData に number として存在すればその値、なければ undefined
                const confidence = typeof parsedData.confidence === 'number' ? parsedData.confidence : undefined;
                const nutrition = typeof parsedData.nutrition === 'object' && parsedData.nutrition !== null ?
                    parsedData.nutrition as Record<string, number | string> : undefined;
                return {
                    foods,
                    // confidence が undefined でない場合のみプロパティを追加
                    ...(confidence !== undefined && { confidence }),
                    nutrition, // nutrition は必須
                    debug: { parsedData, sourceFormat: 'food/text/image' }
                };
            }
            // 想定外のJSON形式
            else {
                console.warn('[GeminiResponseParser] Unknown JSON structure:', parsedData);
                return {
                    // nutrition プロパティを追加
                    nutrition: undefined,
                    error: 'AIの応答JSONの構造が予期しない形式でした。'
                };
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[GeminiResponseParser] Error parsing response:', error, { responseText });
            return {
                // nutrition プロパティを追加
                nutrition: undefined,
                error: `AI応答の解析中にエラーが発生しました: ${errorMessage}`
            };
        }
    }

    /**
     * AIモデルに送信するプロンプトを生成
     * @deprecated PromptServiceを使用してください
     */
    generatePrompt(inputData: GeminiInputData): string {
        console.warn('GeminiResponseParser.generatePrompt is deprecated. Use PromptService instead.');

        // プロンプトテンプレート（互換性のために残していますが、実際にはPromptServiceを使用します）
        const promptTemplate = `
あなたは日本の妊婦向け栄養管理アプリの食品認識AIです。
以下の食事情報から含まれる食品を特定し、JSON形式で出力してください。

# 指示
1. 食事写真や説明から食品名と量を特定する
2. 各食品を最もシンプルな基本形で表現する（例: 「塩鮭の切り身」→「鮭」）
3. 量が明示されていない場合は推測せず、空のままにする
4. 下記のJSON形式で出力する

# 出力フォーマット
\`\`\`json
{
  "foods": [
    {
      "name": "食品名1",
      "quantity": "量（例: 100g、1個）",
      "confidence": 0.9
    },
    // 他の食品...
  ],
  "confidence": 0.85
}
\`\`\`

# 入力データ
${inputData.text || inputData.imageDescription || '入力情報なし'}

# 出力
`;

        return promptTemplate;
    }
} 