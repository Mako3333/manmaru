//src\lib\ai\gemini-response-parser.ts
import { FoodInputParseResult } from '@/lib/food/food-input-parser';

/**
 * AI応答の解析結果を表す型
 */
export interface GeminiParseResult {
    foods: FoodInputParseResult[];
    confidence?: number;
    title?: string;
    servings?: string;
    error?: string;
    debug?: any; // デバッグ情報用
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
                        foods: [],
                        error: 'AIの応答から有効なJSONデータが見つかりませんでした。'
                    };
                }
            }

            if (!jsonStr) {
                return { foods: [], error: '抽出されたJSON文字列が空です。' };
            }

            console.log(`[GeminiResponseParser] Extracted JSON string (preview): ${jsonStr.substring(0, 100)}...`);
            const parsedData = JSON.parse(jsonStr);

            // レシピ解析結果 (title, servings, ingredients) かどうかをチェック
            if ('title' in parsedData || 'servings' in parsedData || 'ingredients' in parsedData) {
                console.log('[GeminiResponseParser] Parsing as Recipe Analysis result.');
                const foods: FoodInputParseResult[] = (parsedData.ingredients || []).map((item: any) => ({
                    foodName: item.name || '',
                    quantityText: item.quantity || null, // プロンプトで quantity は string or null を期待
                    confidence: 0.8 // レシピからの抽出なので、信頼度は比較的高めに設定 (仮)
                }));
                return {
                    foods,
                    title: parsedData.title,
                    servings: parsedData.servings,
                    // confidence はレシピ解析では不要かも
                    debug: { parsedData, sourceFormat: 'recipe' }
                };
            }
            // 画像・テキスト解析結果 (foods, confidence) かどうかをチェック
            else if ('foods' in parsedData) {
                console.log('[GeminiResponseParser] Parsing as Food/Text Analysis result.');
                const foods: FoodInputParseResult[] = (parsedData.foods || []).map((item: any) => ({
                    foodName: item.name || '',
                    // 既存の画像/テキスト解析プロンプトは quantity を返す想定か？
                    // なければ null を設定
                    quantityText: item.quantity || null,
                    confidence: typeof item.confidence === 'number' ? item.confidence : 0.7 // デフォルト値
                }));
                const confidence = typeof parsedData.confidence === 'number' ? parsedData.confidence : undefined;
                return {
                    foods,
                    confidence,
                    // title, servings はこの形式では含まれない
                    debug: { parsedData, sourceFormat: 'food/text' }
                };
            }
            // 想定外のJSON形式
            else {
                console.warn('[GeminiResponseParser] Unknown JSON structure:', parsedData);
                return {
                    foods: [],
                    error: 'AIの応答JSONの構造が予期しない形式でした。'
                };
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[GeminiResponseParser] Error parsing response:', error, { responseText });
            return {
                foods: [],
                error: `AI応答の解析中にエラーが発生しました: ${errorMessage}`
            };
        }
    }

    /**
     * AIモデルに送信するプロンプトを生成
     * @deprecated PromptServiceを使用してください
     */
    generatePrompt(inputData: any): string {
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