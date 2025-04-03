/**
 * 栄養素表示用のユーティリティ関数
 * 表示に特化した計算ロジックを提供します
 */

import { StandardizedMealNutrition, Nutrient } from '@/types/nutrition'; // StandardizedMealNutrition と Nutrient をインポート

// 栄養データの型定義（共通で使用する場合は別ファイルに移動すべき）
// export interface NutritionData { // ← コメントアウトまたは削除検討
//     calories_percent: number;
//     protein_percent: number;
//     iron_percent: number;
//     folic_acid_percent: number;
//     calcium_percent: number;
//     vitamin_d_percent: number;
//     actual_calories?: number;
//     target_calories?: number;
//     actual_protein?: number;
//     target_protein?: number;
//     actual_iron?: number;
//     target_iron?: number;
//     actual_folic_acid?: number;
//     target_folic_acid?: number;
//     actual_calcium?: number;
//     target_calcium?: number;
//     actual_vitamin_d?: number;
//     target_vitamin_d?: number;
//     overall_score?: number;
// }
// src/types/nutrition.ts の NutritionData を利用するか、必要なら Display 用の型を別途定義
import type { NutritionData as LegacyNutritionData } from '@/types/nutrition'; // 必要に応じて元の型も参照

// 目標値の型定義
export interface NutritionTargets {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d: number;
    [key: string]: number; // 拡張性のため
}

// デフォルト目標値 (例: 厚労省 日本人の食事摂取基準 30-49歳女性 活動量普通)
// 必要に応じてユーザー属性に合わせて調整する想定
export const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
    calories: 2050,
    protein: 50,     // g
    iron: 10.5,    // mg (月経あり)
    folic_acid: 240, // μg (プテロイルモノグルタミン酸当量)
    calcium: 650,    // mg
    vitamin_d: 8.5   // μg
};

// 栄養素名とプロパティ名のマッピング (キーを小文字にして曖昧検索対応)
export const NUTRIENT_NAME_TO_KEY: Record<string, keyof NutritionTargets> = {
    'カロリー': 'calories',
    'エネルギー': 'calories',
    'たんぱく質': 'protein',
    'タンパク質': 'protein',
    '蛋白質': 'protein',
    '鉄分': 'iron',
    '鉄': 'iron',
    '葉酸': 'folic_acid',
    'カルシウム': 'calcium',
    'ビタミンd': 'vitamin_d',
    'ビタミンＤ': 'vitamin_d',
};

// 達成率を計算するヘルパー (0-100の範囲に丸める)
export function calculatePercentage(value: number | undefined, target: number | undefined): number {
    if (value === undefined || target === undefined || target === 0) return 0;
    // 達成率の上限を考慮しない場合: Math.round((value / target) * 100)
    // ここでは 0-100% の範囲で表示する場合を想定 (スコア計算では100%超も考慮)
    return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

// 栄養素名からターゲットキーを取得するヘルパー
function getTargetKeyFromName(name: string): keyof NutritionTargets | undefined {
    const lowerCaseName = name.toLowerCase();
    // 完全一致または前方一致で検索
    for (const [keyName, targetKey] of Object.entries(NUTRIENT_NAME_TO_KEY)) {
        if (lowerCaseName === keyName.toLowerCase() || lowerCaseName.startsWith(keyName.toLowerCase())) {
            return targetKey;
        }
    }
    // マッピングで見つからない場合は、そのままキーとして試す
    if (lowerCaseName in DEFAULT_NUTRITION_TARGETS) {
        return lowerCaseName as keyof NutritionTargets;
    }
    return undefined;
}

// 栄養素の値を取得するヘルパー (単位変換が必要な場合はここで対応)
function getNutrientValue(nutrient: Nutrient): number {
    // TODO: 必要に応じて単位変換ロジックを追加 (例: mg -> g)
    // 例: if (nutrient.unit === 'mg' && targetUnit === 'g') return nutrient.value / 1000;
    return nutrient.value;
}

/**
 * 栄養バランススコアを計算する
 * 各栄養素の達成率から総合スコアを計算します
 *
 * @param nutrition 栄養データ (StandardizedMealNutrition or LegacyNutritionData)
 * @param targets 目標値
 * @returns 0-100のスコア値
 */
export function calculateNutritionScore(
    nutrition: StandardizedMealNutrition | LegacyNutritionData | null,
    targets: NutritionTargets = DEFAULT_NUTRITION_TARGETS
): number {
    if (!nutrition) return 0;

    // 主要6栄養素の重み付け (合計1になるように調整)
    // カロリーは直接スコアに入れず、他の栄養素のバランスを見る方式も考えられる
    // ここでは葉酸・鉄分の重要度を少し高く設定
    const weights: Partial<Record<keyof NutritionTargets, number>> = {
        protein: 0.20,
        iron: 0.25,
        folic_acid: 0.25,
        calcium: 0.15,
        vitamin_d: 0.15,
        // calories: 0.0, // カロリーはスコア計算から除外する場合
    };
    // 型を明示的に指定
    const totalWeight = Object.values(weights).reduce((sum: number, w: number | undefined) => sum + (w || 0), 0);

    let weightedScoreSum = 0;

    // StandardizedMealNutrition型かどうかを判定
    const isStandardized = 'totalNutrients' in nutrition;

    if (isStandardized) {
        const stdNutrition = nutrition as StandardizedMealNutrition;

        for (const [targetKey, weight] of Object.entries(weights)) {
            // weight が undefined でないことを確認
            if (weight === undefined) continue;

            const nutrient = stdNutrition.totalNutrients.find(n => getTargetKeyFromName(n.name) === targetKey);
            const targetValue = targets[targetKey as keyof NutritionTargets];

            if (nutrient && targetValue !== undefined && targetValue > 0) {
                const value = getNutrientValue(nutrient);
                // 達成率 (上限なしで計算)
                const achievementRate = value / targetValue;
                // スコアリングロジック (例: 100%で満点、過剰は減点しないシンプルな方式)
                // 100%達成で weight * 100 点、それ以下は線形
                const score = Math.min(1.0, achievementRate) * (weight * 100);
                weightedScoreSum += score;
            }
        }

    } else {
        // --- LegacyNutritionData 用のロジック ---
        // TODO: src/types/nutrition.ts の NutritionData (LegacyNutritionData) の
        // 実際の構造に基づいて、レガシー形式のスコア計算ロジックを正しく実装する。
        // 現在は StandardizedMealNutrition のみをサポートするため、一旦コメントアウト。
        // const oldNutrition = nutrition as any;
        /*
        const legacyNutrientsMap: Record<string, keyof LegacyNutritionData> = {
            // エラー: LegacyNutritionData に *_percent プロパティは存在しない可能性が高い
            // protein: 'protein_percent',
            // iron: 'iron_percent',
            // folic_acid: 'folic_acid_percent',
            // calcium: 'calcium_percent',
            // vitamin_d: 'vitamin_d_percent',
        };

        for (const [targetKey, weight] of Object.entries(weights)) {
             if (weight === undefined) continue; // weight チェック
             const legacyKey = legacyNutrientsMap[targetKey];
             if (legacyKey && typeof oldNutrition[legacyKey] === 'number') {
                 const percent = oldNutrition[legacyKey];
                 // スコアリングロジック (元のスコアリングに近い形)
                 let scoreContribution = 0;
                 if (percent < 50) scoreContribution = (percent / 50); // 0-1.0
                 else if (percent <= 110) scoreContribution = 1.0; // 満点
                 else if (percent <= 130) scoreContribution = 1.0 - ((percent - 110) / 20) * 0.5; // 1.0 -> 0.5
                 else scoreContribution = 0.5;

                 weightedScoreSum += scoreContribution * (weight * 100);
             }
        }
        */
        // --- LegacyNutritionData 用のロジックここまで ---
    }

    // 加重スコアの合計を返す (totalWeight で割ることで正規化も可能だが、ここでは単純合計)
    return Math.max(0, Math.min(100, Math.round(weightedScoreSum))); // 0-100 の範囲に収める
}

/**
 * 栄養素の状態に応じた色クラスを取得
 * @param percent 達成率 (0-100+ の可能性あり)
 * @returns テキスト色とバックグラウンド色のCSSクラス
 */
export function getNutrientColor(percent: number): string {
    if (percent < 50) return 'text-red-500 bg-red-50';
    if (percent < 80) return 'text-orange-500 bg-orange-50'; // 基準を少し上げる
    if (percent <= 120) return 'text-green-500 bg-green-50'; // 許容範囲を少し広げる
    if (percent <= 150) return 'text-orange-500 bg-orange-50'; // 過剰気味
    return 'text-red-500 bg-red-50'; // 過剰
}

/**
 * 栄養素の状態に応じたバーの色を取得
 * @param percent 達成率 (0-100+ の可能性あり)
 * @returns CSSクラス名
 */
export function getNutrientBarColor(percent: number): string {
    if (percent < 50) return 'bg-red-500';
    if (percent < 80) return 'bg-orange-500'; // 基準を少し上げる
    if (percent <= 120) return 'bg-green-500'; // 許容範囲を少し広げる
    // 120% を超えてもバーの色は緑のままにするか、オレンジ/赤にするかは要件次第
    // return 'bg-orange-500'; // 120% を超えたらオレンジ
    // return 'bg-red-500'; // 150% を超えたら赤
    return 'bg-green-500'; // 100% 超えても緑のまま (UI上の表現として)
}
// --- 既存の getNutrientColor, getNutrientBarColor は達成率を受け取るので大きな変更は不要 ---
// ただし、達成率の評価基準 (閾値) は見直した方が良いかもしれないので調整 