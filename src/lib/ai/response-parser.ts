import { z } from 'zod';
import { FoodAnalysisError, ErrorCode } from '../errors/food-analysis-error';
import { FoodItem, FoodCategory } from '@/types/nutrition';

/**
 * AIレスポンスのパース処理を担当するクラス
 */
export class AIResponseParser {
    /**
     * AIからのレスポンスをパースしてJSON形式に変換
     */
    static parseResponse(response: string): any {
        try {
            // 1. マークダウンブロックからJSONを抽出
            const jsonContent = this.extractJsonFromMarkdown(response);

            // 2. JSONをパース
            const parsedData = JSON.parse(jsonContent);

            return parsedData;
        } catch (error) {
            throw new FoodAnalysisError(
                'AIの応答を解析できませんでした',
                ErrorCode.AI_RESPONSE_FORMAT,
                { rawResponse: response, error }
            );
        }
    }

    /**
     * マークダウンからJSONコンテンツを抽出
     */
    private static extractJsonFromMarkdown(text: string): string {
        // マークダウンのコードブロックを探す
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
            return codeBlockMatch[1].trim();
        }

        // 単純なJSONオブジェクトを探す
        const jsonMatch = text.match(/(\{[\s\S]*\})/);
        if (jsonMatch && jsonMatch[1]) {
            return jsonMatch[1].trim();
        }

        // プレーンテキストとしてそのまま返す
        return text.trim();
    }

    /**
     * 食品データの検証とデフォルト値の補完
     */
    static validateAndEnhanceFoodData(data: unknown): { enhancedFoods: FoodItem[] } {
        try {
            const validatedData = enhancedFoodSchema.parse(data);
            return {
                enhancedFoods: validatedData.enhancedFoods.map(food => ({
                    ...food,
                    id: food.id || `food-${Math.random().toString(36).slice(2)}`,
                    category: this.inferFoodCategory(food.name),
                    confidence: food.confidence || 0.8,
                }))
            };
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new FoodAnalysisError(
                    '食品データの形式が不正です',
                    ErrorCode.AI_RESPONSE_FORMAT,
                    { zodError: error.flatten() }
                );
            }
            throw error;
        }
    }

    /**
     * 食品名からカテゴリを推測
     */
    private static inferFoodCategory(name: string): FoodCategory {
        const normalizedName = name.toLowerCase();

        // キーワードとカテゴリーのマッピング
        const categoryMap: Record<string, FoodCategory> = {
            'ご飯': FoodCategory.GRAINS,
            'パン': FoodCategory.GRAINS,
            '麺': FoodCategory.GRAINS,
            '野菜': FoodCategory.VEGETABLES,
            'サラダ': FoodCategory.VEGETABLES,
            'りんご': FoodCategory.FRUITS,
            'みかん': FoodCategory.FRUITS,
            '肉': FoodCategory.PROTEIN,
            '魚': FoodCategory.PROTEIN,
            '卵': FoodCategory.PROTEIN,
            '牛乳': FoodCategory.DAIRY,
            'ヨーグルト': FoodCategory.DAIRY,
            'チーズ': FoodCategory.DAIRY,
            '塩': FoodCategory.SEASONINGS,
            'しょうゆ': FoodCategory.SEASONINGS,
            'ソース': FoodCategory.SEASONINGS,
        };

        // キーワードに基づいてカテゴリを判定
        for (const [keyword, category] of Object.entries(categoryMap)) {
            if (normalizedName.includes(keyword)) {
                return category;
            }
        }

        return FoodCategory.OTHER;
    }
}

/**
 * 食品データのスキーマ定義
 */
const enhancedFoodSchema = z.object({
    enhancedFoods: z.array(z.object({
        id: z.string().optional(),
        name: z.string(),
        quantity: z.string(),
        confidence: z.number().min(0).max(1).optional(),
        notes: z.string().optional()
    }))
});

/**
 * レスポンス形式の正規化用ユーティリティ関数
 */
export function normalizeAIResponse(
    response: unknown
): { content: string } {
    if (typeof response === 'string') {
        return { content: response };
    }

    if (typeof response === 'object' && response !== null) {
        if ('content' in response && typeof (response as any).content === 'string') {
            return response as { content: string };
        }
        if ('text' in response && typeof (response as any).text === 'string') {
            return { content: (response as any).text };
        }
        return { content: JSON.stringify(response) };
    }

    throw new FoodAnalysisError(
        'AIレスポンスの形式が不正です',
        ErrorCode.AI_RESPONSE_FORMAT,
        { response }
    );
}