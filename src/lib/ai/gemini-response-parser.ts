//src\lib\ai\gemini-response-parser.ts
import { FoodInputParseResult } from '@/lib/food/food-input-parser';

/**
 * AI応答の解析結果を表す型
 */
export interface GeminiParseResult {
    foods: FoodInputParseResult[];
    confidence: number;
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
        try {
            // デフォルトの結果（エラー時）
            const defaultResult: GeminiParseResult = {
                foods: [],
                confidence: 0,
                error: '応答の解析に失敗しました'
            };

            if (!responseText) {
                return defaultResult;
            }

            // JSONフォーマットの検出
            const jsonMatch = responseText.match(/```json([\s\S]*?)```|{[\s\S]*}/);
            if (!jsonMatch) {
                console.error('GeminiResponseParser: JSON形式の応答が見つかりませんでした', responseText);
                return {
                    ...defaultResult,
                    debug: { rawResponse: responseText }
                };
            }

            // JSONテキストの抽出と解析
            let jsonText = jsonMatch[1] || jsonMatch[0];
            jsonText = jsonText.trim();

            // 最初と最後の波括弧がない場合、追加
            if (!jsonText.startsWith('{')) {
                jsonText = '{' + jsonText;
            }
            if (!jsonText.endsWith('}')) {
                jsonText = jsonText + '}';
            }

            let parsedData;
            try {
                parsedData = JSON.parse(jsonText);
            } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                console.error('GeminiResponseParser: JSON解析エラー', e, jsonText);
                return {
                    ...defaultResult,
                    error: 'JSON解析エラー: ' + errorMessage,
                    debug: { rawResponse: responseText, jsonText }
                };
            }

            // 期待される形式の確認
            if (!parsedData.foods || !Array.isArray(parsedData.foods)) {
                console.error('GeminiResponseParser: 期待される形式ではありません', parsedData);
                return {
                    ...defaultResult,
                    error: '応答フォーマットエラー: foods配列がありません',
                    debug: { parsedData }
                };
            }

            // 食品リストの変換
            const foods: FoodInputParseResult[] = parsedData.foods.map((item: any) => {
                // 食品名と量の取得
                const foodName = item.name || item.food_name || '';
                const quantityText = item.quantity || item.amount || null;

                return {
                    foodName,
                    quantityText,
                    confidence: item.confidence || 0.8 // AIの確信度（指定がなければデフォルト値）
                };
            });

            // 全体の確信度をメタデータから取得、または計算
            let confidence = parsedData.confidence || 0;
            if (confidence === 0 && foods.length > 0) {
                // 個々の食品の確信度の平均
                confidence = foods.reduce((sum, food) => sum + food.confidence, 0) / foods.length;
            }

            return {
                foods,
                confidence,
                debug: { parsedData }
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GeminiResponseParser: 予期しないエラー', error);
            return {
                foods: [],
                confidence: 0,
                error: '解析中の予期しないエラー: ' + errorMessage
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