import { FoodMatchingService } from './food-matching-service';
import { FoodMatchingServiceFactory } from './food-matching-service-factory';
import { QuantityParser } from '@/lib/nutrition/quantity-parser';

/**
 * 食品入力テキスト解析結果
 */
export interface FoodInputParseResult {
    /** 食品名 */
    foodName: string;

    /** 量の文字列 */
    quantityText: string | null;

    /** 解析の確信度 */
    confidence: number;
}

/**
 * 食品入力テキスト解析クラス
 */
export class FoodInputParser {
    /**
     * ユーザー入力テキストから食品名と量を解析
     * @param input ユーザー入力テキスト
     * @returns 解析結果
     */
    static parseInput(input: string): FoodInputParseResult {
        if (!input || input.trim() === '') {
            return {
                foodName: '',
                quantityText: null,
                confidence: 0
            };
        }

        const normalizedInput = input.trim();

        // パターン1: "食品名 100g" または "食品名　100g"
        const spacePattern = /^(.+?)[\s　]+([0-9０-９]+\.?[0-9０-９]*\s*[a-zA-Zａ-ｚＡ-Ｚ一-龠々ぁ-ヶ]+)$/;
        const spaceMatch = spacePattern.exec(normalizedInput);

        if (spaceMatch) {
            return {
                foodName: spaceMatch[1].trim(),
                quantityText: spaceMatch[2].trim(),
                confidence: 0.9
            };
        }

        // パターン2: "食品名（100g）" または "食品名(100g)"
        const parenthesesPattern = /^(.+?)[\(（]([0-9０-９]+\.?[0-9０-９]*\s*[a-zA-Zａ-ｚＡ-Ｚ一-龠々ぁ-ヶ]+)[\)）]$/;
        const parenthesesMatch = parenthesesPattern.exec(normalizedInput);

        if (parenthesesMatch) {
            return {
                foodName: parenthesesMatch[1].trim(),
                quantityText: parenthesesMatch[2].trim(),
                confidence: 0.9
            };
        }

        // パターン3: "食品名100g" (スペースなし)
        const noSpacePattern = /^(.+?)([0-9０-９]+\.?[0-9０-９]*\s*[a-zA-Zａ-ｚＡ-Ｚ一-龠々ぁ-ヶ]+)$/;
        const noSpaceMatch = noSpacePattern.exec(normalizedInput);

        if (noSpaceMatch) {
            // 食品名の部分が実際にマッチするか確認
            const possibleFoodName = noSpaceMatch[1].trim();

            // 量の部分
            const quantityText = noSpaceMatch[2].trim();

            // このパターンは曖昧なので確信度を下げる
            return {
                foodName: possibleFoodName,
                quantityText: quantityText,
                confidence: 0.7
            };
        }

        // パターン4: "100g食品名" (量が先)
        const quantityFirstPattern = /^([0-9０-９]+\.?[0-9０-９]*\s*[a-zA-Zａ-ｚＡ-Ｚ一-龠々ぁ-ヶ]+)(.+?)$/;
        const quantityFirstMatch = quantityFirstPattern.exec(normalizedInput);

        if (quantityFirstMatch) {
            return {
                foodName: quantityFirstMatch[2].trim(),
                quantityText: quantityFirstMatch[1].trim(),
                confidence: 0.7
            };
        }

        // パターン5: 量を含まない単純な食品名
        return {
            foodName: normalizedInput,
            quantityText: null,
            confidence: 0.8
        };
    }

    /**
     * 複数食品の一括入力を解析
     * @param input 複数食品の入力テキスト
     * @returns 解析結果のリスト
     */
    static parseBulkInput(input: string): FoodInputParseResult[] {
        if (!input || input.trim() === '') {
            return [];
        }

        // 改行、カンマ、または読点で分割
        const lines = input
            .split(/\n|、|,/)
            .map(line => line.trim())
            .filter(line => line !== '');

        // 各行を解析
        return lines.map(line => this.parseInput(line));
    }

    /**
     * 解析結果から食品名と量の組み合わせリストを生成
     * @param parseResults 解析結果のリスト
     * @returns 食品名と量の組み合わせリスト
     */
    static generateNameQuantityPairs(
        parseResults: FoodInputParseResult[]
    ): Array<{ name: string; quantity?: string }> {
        return parseResults.map(result => ({
            name: result.foodName,
            quantity: result.quantityText || undefined
        }));
    }
} 