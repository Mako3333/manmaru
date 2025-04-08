/**
 * 栄養素表示用のユーティリティ関数
 * 表示に特化した計算ロジックを提供します
 */

import { StandardizedMealNutrition, Nutrient, NutritionProgress } from '@/types/nutrition'; // LegacyNutritionData の代わりに NutritionProgress をインポート

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
export function getTargetKeyFromName(name: string): keyof NutritionTargets | undefined {
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

/**
 * 個々の栄養素の値を取得するヘルパー (単位変換が必要な場合はここで対応)
 * @param nutrient 栄養素オブジェクト
 * @returns 栄養素の値
 */
export function getNutrientValue(nutrient: Nutrient): number {
    // TODO: 必要に応じて単位変換ロジックを追加 (例: mg -> g)
    // 例: if (nutrient.unit === 'mg' && targetUnit === 'g') return nutrient.value / 1000;
    return nutrient.value;
}

/**
 * 栄養素名から StandardizedMealNutrition オブジェクト内の栄養素値を取得
 * @param nutrition StandardizedMealNutrition オブジェクト
 * @param nutrientName 検索する栄養素名
 * @returns 栄養素の値、見つからない場合は 0
 */
export function getNutrientValueByName(nutrition: StandardizedMealNutrition, nutrientName: string): number {
    if (!nutrition || !nutrition.totalNutrients) return 0;

    // カロリーは特別扱い
    if (nutrientName.toLowerCase() === 'calories' ||
        nutrientName.toLowerCase() === 'カロリー' ||
        nutrientName.toLowerCase() === 'エネルギー') {
        return nutrition.totalCalories;
    }

    // totalNutrients から検索
    const nutrient = nutrition.totalNutrients.find(n => {
        // 日本語名での比較
        if (n.name.toLowerCase() === nutrientName.toLowerCase()) return true;

        // 標準化されたキー名の取得を試みる
        const targetKey = getTargetKeyFromName(n.name);
        const queryKey = getTargetKeyFromName(nutrientName);

        // キー名での比較
        return targetKey && queryKey && targetKey === queryKey;
    });

    return nutrient ? nutrient.value : 0;
}

/**
 * 栄養バランススコアを計算する
 * 各栄養素の達成率から総合スコアを計算します
 *
 * @param nutrition 栄養データ (StandardizedMealNutrition or NutritionProgress)
 * @param targets 目標値
 * @returns 0-100のスコア値
 */
export function calculateNutritionScore(
    nutrition: StandardizedMealNutrition | NutritionProgress | null, // 型を NutritionProgress に変更
    targets: NutritionTargets = DEFAULT_NUTRITION_TARGETS
): number {
    if (!nutrition) return 0;

    // 主要6栄養素の重み付け (合計1になるように調整)
    const weights: Partial<Record<keyof NutritionTargets, number>> = {
        protein: 0.20,
        iron: 0.25,
        folic_acid: 0.25,
        calcium: 0.15,
        vitamin_d: 0.15,
    };
    const totalWeight = Object.values(weights).reduce((sum: number, w: number | undefined) => sum + (w || 0), 0);

    let weightedScoreSum = 0;

    // StandardizedMealNutrition型かどうかを判定
    const isStandardized = nutrition && 'totalNutrients' in nutrition; // null チェックを追加

    if (isStandardized) {
        const stdNutrition = nutrition as StandardizedMealNutrition;

        for (const [targetKey, weight] of Object.entries(weights)) {
            // weight が undefined でないことを確認
            if (weight === undefined) continue;

            // getNutrientValueByName を使用
            const value = getNutrientValueByName(stdNutrition, targetKey);
            const targetValue = targets[targetKey as keyof NutritionTargets];

            if (targetValue !== undefined && targetValue > 0) {
                const achievementRate = value / targetValue;
                const score = Math.min(1.0, achievementRate) * (weight * 100);
                weightedScoreSum += score;
            }
        }

    } else if (nutrition) { // nutrition が null でないことを確認 (型は NutritionProgress)
        // --- NutritionProgress 用のロジック ---
        const progressData = nutrition as NutritionProgress; // 型アサーションを NutritionProgress に変更
        // マップの型も keyof NutritionProgress を使うように変更
        const legacyTargetsMap: Record<keyof NutritionTargets, { actual: keyof NutritionProgress, target: keyof NutritionProgress, percent?: keyof NutritionProgress }> = {
            calories: { actual: 'actual_calories', target: 'target_calories', percent: 'calories_percent' },
            protein: { actual: 'actual_protein', target: 'target_protein', percent: 'protein_percent' },
            iron: { actual: 'actual_iron', target: 'target_iron', percent: 'iron_percent' },
            folic_acid: { actual: 'actual_folic_acid', target: 'target_folic_acid', percent: 'folic_acid_percent' },
            calcium: { actual: 'actual_calcium', target: 'target_calcium', percent: 'calcium_percent' },
            vitamin_d: { actual: 'actual_vitamin_d', target: 'target_vitamin_d', percent: 'vitamin_d_percent' },
        };

        for (const [targetKey, weight] of Object.entries(weights)) {
            if (weight === undefined) continue; // weight チェック

            const keys = legacyTargetsMap[targetKey as keyof NutritionTargets];
            if (!keys) continue; // 対応するキーがない場合はスキップ

            const actualValue = progressData[keys.actual];
            const targetValue = progressData[keys.target];
            const percentValue = keys.percent ? progressData[keys.percent] : undefined; // percent値を取得

            let achievementRate = 0;
            // percentValue の型が number | null の可能性があるのでチェック強化
            if (typeof percentValue === 'number' && percentValue > 0) {
                achievementRate = percentValue / 100;
                // actualValue/targetValue も number | null の可能性があるのでチェック強化
            } else if (typeof actualValue === 'number' && typeof targetValue === 'number' && targetValue > 0) {
                achievementRate = actualValue / targetValue;
            }


            if (achievementRate > 0) { // 達成率が計算できた場合のみスコア加算
                const score = Math.min(1.0, achievementRate) * (weight * 100); // 達成率は 1.0 (100%) を上限
                weightedScoreSum += score;
            }
        }
        // --- NutritionProgress 用のロジックここまで ---
    }

    const normalizedScore = weightedScoreSum; // 重み合計が1になる前提なら正規化不要
    return Math.max(0, Math.min(100, Math.round(normalizedScore))); // 0-100 の範囲に収める
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
    if (percent <= 150) return 'bg-orange-500'; // 120%超～150%以下はオレンジ
    return 'bg-red-500'; // 150%超は赤
}

/**
 * 栄養素リストをソートする (表示順のカスタマイズ用)
 * 重要な栄養素を先頭に、その他をアルファベット順にソート
 * @param nutrients 栄養素のリスト
 * @returns ソートされた栄養素リスト
 */
export function sortNutrients(nutrients: Nutrient[]): Nutrient[] {
    if (!nutrients) return [];

    // 優先順位の定義 (数値が小さいほど優先度高)
    const priorityOrder: Record<string, number> = {
        'たんぱく質': 1,
        'タンパク質': 1,
        '鉄分': 2,
        '鉄': 2,
        '葉酸': 3,
        'カルシウム': 4,
        'ビタミンD': 5,
        '脂質': 6,
        '炭水化物': 7,
        '食物繊維': 8,
    };

    return [...nutrients].sort((a, b) => {
        // 優先度が定義されている場合はそれに従う
        const priorityA = priorityOrder[a.name] || 1000;
        const priorityB = priorityOrder[b.name] || 1000;

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        // 優先度が同じ場合は名前でソート
        return a.name.localeCompare(b.name);
    });
} 