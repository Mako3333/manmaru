//src\lib\nutrition\calculator.ts
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
            // 量の係数を計算（標準量に対する比率）
            const quantity = this.parseQuantity(food.quantity);

            // 栄養素の計算
            // 各栄養素について、食品の栄養価 × 量の係数を加算
            return {
                calories: acc.calories + this.calculateWithQuantity(food.nutrition?.calories, quantity),
                protein: acc.protein + this.calculateWithQuantity(food.nutrition?.protein, quantity),
                iron: acc.iron + this.calculateWithQuantity(food.nutrition?.iron, quantity),
                folic_acid: acc.folic_acid + this.calculateWithQuantity(food.nutrition?.folic_acid, quantity),
                calcium: acc.calcium + this.calculateWithQuantity(food.nutrition?.calcium, quantity),
                vitamin_d: acc.vitamin_d + this.calculateWithQuantity(food.nutrition?.vitamin_d, quantity),
            };
        }, this.getEmptyNutrition());

        // 小数点以下2桁に丸める
        return {
            calories: Math.round(nutrition.calories * 100) / 100,
            protein: Math.round(nutrition.protein * 100) / 100,
            iron: Math.round(nutrition.iron * 100) / 100,
            folic_acid: Math.round(nutrition.folic_acid * 100) / 100,
            calcium: Math.round(nutrition.calcium * 100) / 100,
            vitamin_d: Math.round(nutrition.vitamin_d * 100) / 100,
        };
    }

    /**
     * 量を考慮した栄養素の計算
     * @param value 栄養素の値
     * @param quantity 量の係数
     * @returns 計算された栄養素の値
     */
    private static calculateWithQuantity(value: number | undefined | null, quantity: number): number {
        if (typeof value !== 'number' || isNaN(value)) {
            return 0;
        }
        return value * quantity;
    }

    /**
     * 空の栄養データを取得
     */
    private static getEmptyNutrition(): BasicNutritionData {
        return {
            calories: 0,
            protein: 0,
            iron: 0,
            folic_acid: 0,
            calcium: 0,
            vitamin_d: 0,
        };
    }

    /**
     * 量の文字列を係数に変換
     * @param quantity 量の文字列
     * @returns 係数
     */
    private static parseQuantity(quantity: string | undefined | null): number {
        if (!quantity) return 1;

        // 数値のみの場合は係数として扱う
        const numericMatch = quantity.match(/^(\d+\.?\d*)$/);
        if (numericMatch) {
            return parseFloat(numericMatch[1]);
        }

        // 標準的な単位の変換
        const standardUnitMatch = quantity.match(/^(\d+\.?\d*)\s*(g|ml|mg|μg)$/i);
        if (standardUnitMatch) {
            const value = parseFloat(standardUnitMatch[1]);
            const unit = standardUnitMatch[2].toLowerCase();

            switch (unit) {
                case 'g':
                case 'ml':
                    return value / 100; // 100gを基準とする
                case 'mg':
                    return value / 100000; // 100gを基準とする
                case 'μg':
                    return value / 100000000; // 100gを基準とする
                default:
                    return 1;
            }
        }

        // 日本語の量表現の解析
        const japaneseQuantityMap: { [key: string]: number } = {
            '大さじ': 15,
            '小さじ': 5,
            'カップ': 200,
            '本': 40,
            '個': 50,
            '株': 50,
            '束': 100,
            '缶': 100,
            '切れ': 80,
            '枚': 60,
        };

        // 数値と単位を分離
        const japaneseMatch = quantity.match(/^(大|小|)(\d+\.?\d*)(株|本|個|束|缶|さじ|カップ|切れ|枚)$/);
        if (japaneseMatch) {
            const prefix = japaneseMatch[1];
            const value = parseFloat(japaneseMatch[2]);
            const unit = japaneseMatch[3];

            let baseGrams = japaneseQuantityMap[unit] || 0;
            if (prefix === '大' && unit === 'さじ') {
                baseGrams = japaneseQuantityMap['大さじ'];
            } else if (prefix === '小' && unit === 'さじ') {
                baseGrams = japaneseQuantityMap['小さじ'];
            }

            return (value * baseGrams) / 100; // 100gを基準とする
        }

        // デフォルトは1（標準量として扱う）
        return 1;
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
} 