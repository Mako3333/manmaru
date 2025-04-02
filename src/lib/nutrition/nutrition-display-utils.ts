/**
 * 栄養素表示用のユーティリティ関数
 * 表示に特化した計算ロジックを提供します
 */

// 栄養データの型定義（共通で使用する場合は別ファイルに移動すべき）
export interface NutritionData {
    calories_percent: number;
    protein_percent: number;
    iron_percent: number;
    folic_acid_percent: number;
    calcium_percent: number;
    vitamin_d_percent: number;
    actual_calories?: number;
    target_calories?: number;
    actual_protein?: number;
    target_protein?: number;
    actual_iron?: number;
    target_iron?: number;
    actual_folic_acid?: number;
    target_folic_acid?: number;
    actual_calcium?: number;
    target_calcium?: number;
    actual_vitamin_d?: number;
    target_vitamin_d?: number;
    overall_score?: number;
}

/**
 * 栄養バランススコアを計算する
 * 各栄養素の達成率から総合スコアを計算します
 * 
 * @param nutritionData 栄養データ
 * @returns 0-100のスコア値
 */
export function calculateNutritionScore(nutritionData: NutritionData | null): number {
    if (!nutritionData) return 0;

    // 各栄養素の達成率
    const nutrients = [
        nutritionData.calories_percent,
        nutritionData.protein_percent,
        nutritionData.iron_percent,
        nutritionData.folic_acid_percent,
        nutritionData.calcium_percent,
        nutritionData.vitamin_d_percent
    ];

    // 各栄養素の達成率をスコア化（理想的な範囲内なら高得点）
    const scores = nutrients.map(percent => {
        if (percent < 50) return percent / 2; // 50%未満は達成率の半分をスコアとする
        if (percent <= 110) return 50; // 50-110%は満点50点
        if (percent <= 130) return 50 - ((percent - 110) / 20) * 25; // 110-130%は徐々に減点
        return 25; // 130%以上は25点
    });

    // スコアの合計（300点満点）を100点満点に換算
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    return Math.round(totalScore / 6 * 2); // 各栄養素50点満点×6項目＝300点→100点満点に調整
}

/**
 * 栄養素の状態に応じた色クラスを取得
 * @param percent 達成率
 * @returns テキスト色とバックグラウンド色のCSSクラス
 */
export function getNutrientColor(percent: number): string {
    if (percent < 50) return 'text-red-500 bg-red-50';
    if (percent < 70) return 'text-orange-500 bg-orange-50';
    if (percent <= 110) return 'text-green-500 bg-green-50';
    if (percent <= 130) return 'text-orange-500 bg-orange-50';
    return 'text-red-500 bg-red-50';
}

/**
 * 栄養素の状態に応じたバーの色を取得
 * @param percent 達成率
 * @returns CSSクラス名
 */
export function getNutrientBarColor(percent: number): string {
    if (percent < 50) return 'bg-red-500';
    if (percent < 70) return 'bg-orange-500';
    if (percent <= 110) return 'bg-green-500';
    if (percent <= 130) return 'bg-orange-500';
    return 'bg-red-500';
} 