import { NutritionData, FoodItem, DetectedFoods } from "@/types/nutrition";

/**
 * AIレスポンスを解析するためのクラス
 * テキスト入力と食事画像の両方からの解析結果を処理
 */
export class AIResponseParser {
    /**
     * AIからのテキストレスポンスを解析して栄養データに変換
     * @param response AIからのレスポンステキスト
     * @returns 構造化された栄養データ
     */
    static parseNutritionData(response: string): NutritionData {
        try {
            // JSONとして解析を試みる
            if (response.includes('{') && response.includes('}')) {
                // JSONの部分を抽出
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0];
                    const data = JSON.parse(jsonStr);

                    // 必要なフィールドが存在するか確認
                    return this.validateAndNormalizeData(data);
                }
            }

            // テキスト形式の場合は正規表現でデータを抽出
            return this.extractDataFromText(response);
        } catch (error) {
            console.error("AIレスポンスの解析に失敗しました:", error);
            // デフォルト値を返す
            return {
                calories: 0,
                protein: 0,
                iron: 0,
                folic_acid: 0,
                calcium: 0,
                vitamin_d: 0,
                confidence_score: 0.5,
                overall_score: 0,
                deficient_nutrients: [],
                sufficient_nutrients: [],
                daily_records: []
            };
        }
    }

    /**
     * テキスト入力解析用のレスポンスパーサー
     * @param response AIからのレスポンステキスト
     * @returns 解析された食品データ
     */
    static parseResponse(response: string): any {
        try {
            // JSONとして解析を試みる
            if (response.includes('{') && response.includes('}')) {
                // JSONの部分を抽出
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0];
                    return JSON.parse(jsonStr);
                }
            }

            // JSONが見つからない場合はエラー
            throw new Error("有効なJSONデータが見つかりませんでした");
        } catch (error) {
            console.error("AIレスポンスのJSON解析に失敗しました:", error);
            // 空のデータを返す
            return { enhancedFoods: [] };
        }
    }

    /**
     * 食品データの検証と拡張
     * @param data AIから解析された生データ
     * @returns 検証・拡張された食品データ
     */
    static validateAndEnhanceFoodData(data: any): DetectedFoods {
        // データが存在しない場合は空の配列を返す
        if (!data || !data.enhancedFoods || !Array.isArray(data.enhancedFoods)) {
            return { foods: [] };
        }

        // 各食品データを検証して正規化
        const foods: FoodItem[] = data.enhancedFoods.map((item: any) => {
            return {
                name: item.name || "不明な食品",
                quantity: item.quantity || "1個",
                confidence: typeof item.confidence === 'number' ? item.confidence : 0.7
            };
        }).filter((item: FoodItem) => item.name !== "不明な食品");

        return { foods };
    }

    /**
     * データの検証と正規化
     * @param data 解析された生データ
     * @returns 正規化された栄養データ
     */
    private static validateAndNormalizeData(data: any): NutritionData {
        // 基本的な栄養データの構造を確保
        const nutritionData: NutritionData = {
            calories: parseFloat(data.calories) || 0,
            protein: parseFloat(data.protein) || 0,
            iron: parseFloat(data.iron) || 0,
            folic_acid: parseFloat(data.folic_acid) || 0,
            calcium: parseFloat(data.calcium) || 0,
            vitamin_d: parseFloat(data.vitamin_d) || 0,
            confidence_score: parseFloat(data.confidence_score) || 0.5,
            overall_score: 0,
            deficient_nutrients: [],
            sufficient_nutrients: [],
            daily_records: data.daily_records || []
        };

        // 不足している栄養素と十分な栄養素を計算
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

        return nutritionData;
    }

    /**
     * テキストからデータを抽出
     * @param text AIからのテキストレスポンス
     * @returns 抽出された栄養データ
     */
    private static extractDataFromText(text: string): NutritionData {
        const nutritionData: NutritionData = {
            calories: 0,
            protein: 0,
            iron: 0,
            folic_acid: 0,
            calcium: 0,
            vitamin_d: 0,
            confidence_score: 0.5,
            overall_score: 0,
            deficient_nutrients: [],
            sufficient_nutrients: [],
            daily_records: []
        };

        // カロリー
        const caloriesMatch = text.match(/カロリー[：:]\s*(\d+)/i) ||
            text.match(/calories[：:]\s*(\d+)/i);
        if (caloriesMatch) nutritionData.calories = parseFloat(caloriesMatch[1]);

        // タンパク質
        const proteinMatch = text.match(/タンパク質[：:]\s*(\d+\.?\d*)/i) ||
            text.match(/protein[：:]\s*(\d+\.?\d*)/i);
        if (proteinMatch) nutritionData.protein = parseFloat(proteinMatch[1]);

        // 鉄分
        const ironMatch = text.match(/鉄分[：:]\s*(\d+\.?\d*)/i) ||
            text.match(/iron[：:]\s*(\d+\.?\d*)/i);
        if (ironMatch) nutritionData.iron = parseFloat(ironMatch[1]);

        // 葉酸
        const folicAcidMatch = text.match(/葉酸[：:]\s*(\d+\.?\d*)/i) ||
            text.match(/folic acid[：:]\s*(\d+\.?\d*)/i);
        if (folicAcidMatch) nutritionData.folic_acid = parseFloat(folicAcidMatch[1]);

        // カルシウム
        const calciumMatch = text.match(/カルシウム[：:]\s*(\d+\.?\d*)/i) ||
            text.match(/calcium[：:]\s*(\d+\.?\d*)/i);
        if (calciumMatch) nutritionData.calcium = parseFloat(calciumMatch[1]);

        // ビタミンD
        const vitaminDMatch = text.match(/ビタミンD[：:]\s*(\d+\.?\d*)/i) ||
            text.match(/vitamin d[：:]\s*(\d+\.?\d*)/i);
        if (vitaminDMatch) nutritionData.vitamin_d = parseFloat(vitaminDMatch[1]);

        // 信頼度スコア
        const confidenceMatch = text.match(/信頼度[：:]\s*(\d+\.?\d*)/i) ||
            text.match(/confidence[：:]\s*(\d+\.?\d*)/i);
        if (confidenceMatch) nutritionData.confidence_score = parseFloat(confidenceMatch[1]);

        // データを検証して正規化
        return this.validateAndNormalizeData(nutritionData);
    }
}