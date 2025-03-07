import { FoodItem, NutritionData, DatabaseFoodItem } from "@/types/nutrition";
import { FoodAnalysisError, ErrorCode } from "@/lib/errors/food-analysis-error";

// 仮の食品データベース（実際の実装ではSupabaseなどから取得）
const FOOD_DATABASE: Record<string, DatabaseFoodItem> = {
    "ご飯": {
        name: "ご飯",
        calories: 168,
        protein: 2.5,
        iron: 0.1,
        folic_acid: 3,
        calcium: 3,
        standard_quantity: "100g",
        aliases: ["白米", "ライス"]
    },
    "サラダ": {
        name: "サラダ",
        calories: 25,
        protein: 1.2,
        iron: 0.5,
        folic_acid: 45,
        calcium: 20,
        standard_quantity: "100g",
        aliases: ["野菜サラダ", "グリーンサラダ"]
    },
    "りんご": {
        name: "りんご",
        calories: 52,
        protein: 0.2,
        iron: 0.1,
        folic_acid: 3,
        calcium: 4,
        standard_quantity: "100g",
        aliases: ["アップル"]
    },
    "牛乳": {
        name: "牛乳",
        calories: 61,
        protein: 3.3,
        iron: 0.04,
        folic_acid: 5,
        calcium: 110,
        standard_quantity: "100ml",
        aliases: ["ミルク"]
    },
    "鶏肉": {
        name: "鶏肉",
        calories: 191,
        protein: 20,
        iron: 0.5,
        folic_acid: 7,
        calcium: 5,
        standard_quantity: "100g",
        aliases: ["チキン"]
    },
    "ほうれん草": {
        name: "ほうれん草",
        calories: 20,
        protein: 2.2,
        iron: 2.0,
        folic_acid: 110,
        calcium: 49,
        standard_quantity: "100g",
        aliases: ["スピナッチ"]
    },
    "豆腐": {
        name: "豆腐",
        calories: 72,
        protein: 6.6,
        iron: 1.1,
        folic_acid: 15,
        calcium: 120,
        standard_quantity: "100g",
        aliases: ["とうふ"]
    }
};

/**
 * 栄養データベースクラス
 * 食品データの検索と栄養計算を行う
 */
export class NutritionDatabase {
    private static instance: NutritionDatabase;
    private foodDatabase: Record<string, DatabaseFoodItem>;

    private constructor() {
        this.foodDatabase = FOOD_DATABASE;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static getInstance(): NutritionDatabase {
        if (!NutritionDatabase.instance) {
            NutritionDatabase.instance = new NutritionDatabase();
        }
        return NutritionDatabase.instance;
    }

    /**
     * 食品名から栄養データを検索
     * @param foodName 食品名
     * @returns 食品の栄養データ
     */
    findFoodByName(foodName: string): DatabaseFoodItem | null {
        // 入力値の正規化
        const normalizedInput = foodName.toLowerCase().trim();

        // 完全一致検索
        if (this.foodDatabase[foodName]) {
            return this.foodDatabase[foodName];
        }

        // スコアベースの部分一致検索
        let bestMatch: DatabaseFoodItem | null = null;
        let bestScore = 0;

        for (const key in this.foodDatabase) {
            const food = this.foodDatabase[key];
            let currentScore = 0;

            // 名前の部分一致スコア計算
            const foodNameLower = food.name.toLowerCase();
            if (foodNameLower === normalizedInput) {
                currentScore = 100; // 完全一致（大文字小文字無視）
            } else if (foodNameLower.includes(normalizedInput)) {
                currentScore = 80; // 部分一致（含む）
            } else if (normalizedInput.includes(foodNameLower)) {
                currentScore = 60; // 逆部分一致（含まれる）
            }

            // 別名の部分一致スコア計算
            if (food.aliases && currentScore < 100) {
                for (const alias of food.aliases) {
                    const aliasLower = alias.toLowerCase();
                    if (aliasLower === normalizedInput) {
                        currentScore = Math.max(currentScore, 90); // 別名完全一致
                        break;
                    } else if (aliasLower.includes(normalizedInput)) {
                        currentScore = Math.max(currentScore, 70); // 別名部分一致
                        break;
                    } else if (normalizedInput.includes(aliasLower)) {
                        currentScore = Math.max(currentScore, 50); // 別名逆部分一致
                        break;
                    }
                }
            }

            // より良いマッチがあれば更新
            if (currentScore > bestScore) {
                bestScore = currentScore;
                bestMatch = food;
            }
        }

        // スコアが一定以上の場合のみ返す
        return bestScore >= 50 ? bestMatch : null;
    }

    /**
     * 量の文字列から数値に変換
     * @param quantity 量の文字列（例: "100g", "2個"）
     * @param standardQuantity 標準量（例: "100g"）
     * @returns 変換係数
     */
    private parseQuantity(quantity: string, standardQuantity: string): number {
        try {
            // 入力がない場合はデフォルト値
            if (!quantity || quantity.trim() === '') {
                return 1.0;
            }

            // 数値部分と単位部分を抽出
            const quantityMatch = quantity.match(/(\d+\.?\d*)([^\d]*)/);
            const standardMatch = standardQuantity.match(/(\d+\.?\d*)([^\d]*)/);

            if (!quantityMatch || !standardMatch) {
                console.log('量の解析失敗:', quantity, standardQuantity);
                return 1.0; // デフォルト値
            }

            const quantityValue = parseFloat(quantityMatch[1]);
            const quantityUnit = quantityMatch[2].trim();
            const standardValue = parseFloat(standardMatch[1]);
            const standardUnit = standardMatch[2].trim();

            console.log('量の解析:', {
                quantityValue,
                quantityUnit,
                standardValue,
                standardUnit
            });

            // 単位が同じ場合は単純な比率を返す
            if (quantityUnit === standardUnit) {
                return quantityValue / standardValue;
            }

            // 単位変換テーブルを使用
            const unitConversions: Record<string, number> = {
                'g': 1,
                'グラム': 1,
                'ml': 1,
                'ミリリットル': 1,
                '個': 100,
                '枚': 50,
                '杯': 150,
                '皿': 200,
                '人前': 250,
                '大さじ': 15,
                '小さじ': 5,
                'カップ': 200
            };

            // 単位が異なる場合の変換
            if (unitConversions[quantityUnit] && unitConversions[standardUnit]) {
                const quantityInGrams = quantityValue * unitConversions[quantityUnit];
                const standardInGrams = standardValue * unitConversions[standardUnit];
                return quantityInGrams / standardInGrams;
            }

            // 特殊なケース
            if (quantityUnit === '個' && standardUnit === 'g') {
                return (quantityValue * 100) / standardValue;
            }

            if (quantityUnit === '杯' && standardUnit === 'g') {
                return (quantityValue * 150) / standardValue;
            }

            // その他のケース
            console.log('単位変換に失敗:', quantityUnit, standardUnit);
            return 1.0;
        } catch (error) {
            console.error('量の解析エラー:', error);
            return 1.0; // エラー時はデフォルト値
        }
    }

    /**
     * 食品リストから栄養データを計算
     * @param foods 食品リスト
     * @returns 計算された栄養データ
     */
    async calculateNutrition(foods: FoodItem[]): Promise<NutritionData> {
        try {
            console.log('栄養計算開始:', foods);

            // 初期値
            const nutritionData: NutritionData = {
                calories: 0,
                protein: 0,
                iron: 0,
                folic_acid: 0,
                calcium: 0,
                vitamin_d: 0,
                confidence_score: 0,
                overall_score: 0,
                deficient_nutrients: [],
                sufficient_nutrients: [],
                daily_records: []
            };

            let totalConfidence = 0;
            let foundFoodsCount = 0;

            // 各食品の栄養素を合計
            for (const food of foods) {
                // 食品名が空の場合はスキップ
                if (!food.name || food.name.trim() === '') {
                    console.log('食品名が空のためスキップ:', food);
                    continue;
                }

                const dbFood = this.findFoodByName(food.name);

                if (dbFood) {
                    foundFoodsCount++;
                    console.log('食品データ見つかりました:', food.name, '→', dbFood.name);

                    // 量の変換係数を計算
                    const quantityFactor = food.quantity
                        ? this.parseQuantity(food.quantity, dbFood.standard_quantity)
                        : 1.0;

                    console.log('量の変換係数:', quantityFactor, food.quantity, dbFood.standard_quantity);

                    // 栄養素を加算
                    nutritionData.calories += dbFood.calories * quantityFactor;
                    nutritionData.protein += dbFood.protein * quantityFactor;
                    nutritionData.iron += dbFood.iron * quantityFactor;
                    nutritionData.folic_acid += dbFood.folic_acid * quantityFactor;
                    nutritionData.calcium += dbFood.calcium * quantityFactor;

                    // ビタミンDは仮の値（実際のデータベースでは正確な値を使用）
                    nutritionData.vitamin_d += 0.5 * quantityFactor;

                    // 信頼度スコアを加算
                    totalConfidence += food.confidence || 0.8;
                } else {
                    console.log('食品データが見つかりません:', food.name);
                    // 見つからない場合は推定値を使用
                    // カロリーのみ仮の値を設定（他の栄養素は0のまま）
                    nutritionData.calories += 100; // 一般的な食品として100kcal程度と仮定
                    totalConfidence += 0.3; // 低い信頼度
                }
            }

            // 平均信頼度を計算
            nutritionData.confidence_score = foods.length > 0
                ? totalConfidence / foods.length
                : 0.5;

            // 見つかった食品の割合に応じて信頼度を調整
            if (foods.length > 0) {
                const foundRatio = foundFoodsCount / foods.length;
                nutritionData.confidence_score *= foundRatio;
            }

            // 栄養素の値を小数点以下2桁に丸める
            nutritionData.calories = Math.round(nutritionData.calories * 100) / 100;
            nutritionData.protein = Math.round(nutritionData.protein * 100) / 100;
            nutritionData.iron = Math.round(nutritionData.iron * 100) / 100;
            nutritionData.folic_acid = Math.round(nutritionData.folic_acid * 100) / 100;
            nutritionData.calcium = Math.round(nutritionData.calcium * 100) / 100;
            nutritionData.vitamin_d = Math.round(nutritionData.vitamin_d * 100) / 100;

            // 不足している栄養素と十分な栄養素を計算
            this.calculateNutrientStatus(nutritionData);

            // 総合スコアを計算
            this.calculateOverallScore(nutritionData);

            console.log('栄養計算結果:', nutritionData);
            return nutritionData;
        } catch (error) {
            console.error('栄養計算エラー:', error);
            throw new FoodAnalysisError(
                '栄養計算中にエラーが発生しました',
                ErrorCode.DB_ERROR,
                error
            );
        }
    }

    /**
     * 栄養素の状態（不足/十分）を計算
     * @param nutritionData 栄養データ
     */
    private calculateNutrientStatus(nutritionData: NutritionData): void {
        // 仮の基準値（実際のアプリケーションでは設定から取得するべき）
        const thresholds = {
            calories: 2000,
            protein: 60,
            iron: 27,
            folic_acid: 400,
            calcium: 1000,
            vitamin_d: 10
        };

        // 不足している栄養素と十分な栄養素を分類
        const deficient = [];
        const sufficient = [];

        if (nutritionData.calories < thresholds.calories * 0.7) deficient.push('calories');
        else sufficient.push('calories');

        if (nutritionData.protein < thresholds.protein * 0.7) deficient.push('protein');
        else sufficient.push('protein');

        if (nutritionData.iron < thresholds.iron * 0.7) deficient.push('iron');
        else sufficient.push('iron');

        if (nutritionData.folic_acid < thresholds.folic_acid * 0.7) deficient.push('folic_acid');
        else sufficient.push('folic_acid');

        if (nutritionData.calcium < thresholds.calcium * 0.7) deficient.push('calcium');
        else sufficient.push('calcium');

        if (nutritionData.vitamin_d < thresholds.vitamin_d * 0.7) deficient.push('vitamin_d');
        else sufficient.push('vitamin_d');

        nutritionData.deficient_nutrients = deficient;
        nutritionData.sufficient_nutrients = sufficient;
    }

    /**
     * 総合スコアを計算
     * @param nutritionData 栄養データ
     */
    private calculateOverallScore(nutritionData: NutritionData): void {
        // 仮の基準値
        const thresholds = {
            calories: 2000,
            protein: 60,
            iron: 27,
            folic_acid: 400,
            calcium: 1000,
            vitamin_d: 10
        };

        // 総合スコアの計算（簡易版）
        const totalScore = (
            (nutritionData.calories / thresholds.calories) * 100 +
            (nutritionData.protein / thresholds.protein) * 100 +
            (nutritionData.iron / thresholds.iron) * 100 +
            (nutritionData.folic_acid / thresholds.folic_acid) * 100 +
            (nutritionData.calcium / thresholds.calcium) * 100 +
            (nutritionData.vitamin_d / thresholds.vitamin_d) * 100
        ) / 6;

        nutritionData.overall_score = Math.min(100, Math.round(totalScore));
    }
} 