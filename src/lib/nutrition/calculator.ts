import { BasicNutritionData, NutritionProgress } from '@/types/nutrition';

/**
 * 栄養計算を一元管理するユーティリティクラス
 * 妊娠期に特化した栄養計算ロジックを提供します
 */
export class NutritionCalculator {
    /**
     * 食事データから栄養素を計算する中央ロジック
     * @param foods 食品リスト
     * @returns 計算された栄養データ
     */
    static calculateMealNutrition(foods: any[]): BasicNutritionData {
        // 食材ごとの栄養素を集計
        const nutrition = foods.reduce((acc, food) => {
            const quantity = this.parseQuantity(food.quantity);
            return {
                calories: acc.calories + (food.nutrition?.calories || 0) * quantity,
                protein: acc.protein + (food.nutrition?.protein || 0) * quantity,
                iron: acc.iron + (food.nutrition?.iron || 0) * quantity,
                folic_acid: acc.folic_acid + (food.nutrition?.folic_acid || 0) * quantity,
                calcium: acc.calcium + (food.nutrition?.calcium || 0) * quantity,
                vitamin_d: acc.vitamin_d + (food.nutrition?.vitamin_d || 0) * quantity,
            };
        }, this.getEmptyNutrition());

        return nutrition;
    }

    /**
     * バランススコア計算ロジック（妊娠期に特化）
     * @param nutrition 栄養データ
     * @returns 栄養バランススコア（0-100）
     */
    static calculateBalanceScore(nutrition: BasicNutritionData): number {
        // 妊娠期に重要な栄養素に重み付け
        const weights = {
            protein: 0.25,
            iron: 0.2,
            folic_acid: 0.25,
            calcium: 0.2,
            vitamin_d: 0.1
        };

        // 1日の推奨摂取量に対する割合を計算
        const dailyValues = {
            protein: 60, // g
            iron: 27,    // mg
            folic_acid: 400, // μg
            calcium: 1000, // mg
            vitamin_d: 10  // μg
        };

        // スコア計算（各栄養素の充足率 × 重み）
        let score = 0;
        for (const [nutrient, weight] of Object.entries(weights)) {
            const value = nutrition[nutrient as keyof typeof nutrition] as number;
            const daily = dailyValues[nutrient as keyof typeof dailyValues];
            // 充足率（最大100%）
            const fulfillment = Math.min(value / daily, 1);
            score += fulfillment * weight * 100;
        }

        return Math.round(score);
    }

    /**
     * 栄養進捗データから総合スコアを計算
     * @param progress 栄養進捗データ
     * @returns 栄養バランススコア（0-100）
     */
    static calculateNutritionScoreFromProgress(progress: NutritionProgress): number {
        if (!progress) return 0;

        // 妊娠期に重要な栄養素に重み付け
        const weights = {
            protein: 0.25,
            iron: 0.2,
            folic_acid: 0.25,
            calcium: 0.2,
            vitamin_d: 0.1
        };

        // 各栄養素の達成率を重み付けして合計（100%を超える場合は100%とする）
        let weightedScore = 0;
        weightedScore += Math.min(progress.protein_percent, 100) * weights.protein;
        weightedScore += Math.min(progress.iron_percent, 100) * weights.iron;
        weightedScore += Math.min(progress.folic_acid_percent, 100) * weights.folic_acid;
        weightedScore += Math.min(progress.calcium_percent, 100) * weights.calcium;
        weightedScore += Math.min(progress.vitamin_d_percent, 100) * weights.vitamin_d;

        return Math.round(weightedScore);
    }

    /**
     * 栄養素の不足を判定する
     * @param progress 栄養進捗データ
     * @returns 不足している栄養素の配列
     */
    static getDeficientNutrients(progress: NutritionProgress): string[] {
        if (!progress) return [];

        const deficientNutrients: string[] = [];

        // 70%未満を不足と判定
        if (progress.iron_percent < 70) deficientNutrients.push('iron');
        if (progress.folic_acid_percent < 70) deficientNutrients.push('folic_acid');
        if (progress.calcium_percent < 70) deficientNutrients.push('calcium');
        if (progress.vitamin_d_percent < 70) deficientNutrients.push('vitamin_d');
        if (progress.protein_percent < 70) deficientNutrients.push('protein');

        return deficientNutrients;
    }

    /**
     * 量の文字列を数値に変換する
     * @param quantityStr 量の文字列表現
     * @returns 数値化された量
     */
    private static parseQuantity(quantityStr: string): number {
        if (!quantityStr) return 1.0;

        // 数値のみを抽出
        const numMatch = quantityStr.match(/(\d+(\.\d+)?)/);
        if (numMatch && numMatch[1]) {
            return parseFloat(numMatch[1]);
        }

        // 特定の単位表現を解析
        if (quantityStr.includes('大さじ')) return 15 / 100;
        if (quantityStr.includes('小さじ')) return 5 / 100;
        if (quantityStr.includes('カップ')) return 200 / 100;
        if (quantityStr.includes('杯')) return 150 / 100;

        return 1.0;
    }

    /**
     * 空の栄養素オブジェクト
     * @returns 初期化された栄養素オブジェクト
     */
    static getEmptyNutrition(): BasicNutritionData {
        return {
            calories: 0,
            protein: 0,
            iron: 0,
            folic_acid: 0,
            calcium: 0,
            vitamin_d: 0
        };
    }
} 