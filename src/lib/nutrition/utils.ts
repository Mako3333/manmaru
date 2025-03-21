/**
 * 栄養計算システムに関するユーティリティ関数
 */

import { SupabaseFoodDatabase } from './supabase-db';
import { NutritionDatabase } from './database';

/**
 * 栄養データベースのキャッシュを強制的にリフレッシュする
 * @returns キャッシュのリフレッシュが成功したかどうか
 */
export async function forceRefreshNutritionCache(): Promise<boolean> {
    console.log('NutritionUtils: データベースキャッシュの強制更新を開始');

    try {
        // Supabaseデータベースのキャッシュを強制更新
        const supabaseDB = SupabaseFoodDatabase.getInstance();
        await supabaseDB.forceRefreshCache();
        console.log('NutritionUtils: Supabaseデータベースのキャッシュを更新しました');

        // ローカルデータベースも更新（必要な場合）
        try {
            const localDB = NutritionDatabase.getInstance();
            console.log('NutritionUtils: ローカルデータベースの状態を確認');

            // NutritionDatabaseにloadExternalDatabaseメソッドがあれば実行
            if (typeof (localDB as any).loadExternalDatabase === 'function') {
                await (localDB as any).loadExternalDatabase();
                console.log('NutritionUtils: ローカルデータベースを更新しました');
            }
        } catch (localDbError) {
            // ローカルDBのエラーは許容（Supabaseが主体のため）
            console.warn('NutritionUtils: ローカルデータベース更新中にエラー発生:', localDbError);
        }

        return true;
    } catch (error) {
        console.error('NutritionUtils: キャッシュ更新エラー:', error);
        return false;
    }
}

/**
 * 食品名の検索機能をテストする
 * @param foodName テストする食品名
 * @returns 検索結果と成功/失敗の情報
 */
export async function testFoodSearch(foodName: string): Promise<{
    success: boolean;
    message: string;
    fuzzyResults?: any[];
    exactMatch?: any;
}> {
    if (!foodName || foodName.trim() === '') {
        return {
            success: false,
            message: '食品名を入力してください'
        };
    }

    try {
        console.log(`NutritionUtils: 食品「${foodName}」の検索テスト開始`);

        // Supabaseデータベースを使用
        const supabaseDB = SupabaseFoodDatabase.getInstance();

        // 正確な一致を検索
        const exactMatch = await supabaseDB.getFoodByExactName(foodName);
        if (exactMatch) {
            console.log(`NutritionUtils: 「${foodName}」の完全一致が見つかりました: ${exactMatch.name}`);
        } else {
            console.log(`NutritionUtils: 「${foodName}」の完全一致は見つかりませんでした`);
        }

        // ファジー検索を実行
        const fuzzyResults = await supabaseDB.getFoodsByFuzzyMatch(foodName, 5);
        console.log(`NutritionUtils: 「${foodName}」のファジー検索結果: ${fuzzyResults.length}件`);

        if (fuzzyResults.length > 0) {
            return {
                success: true,
                message: `「${foodName}」に類似した食品が${fuzzyResults.length}件見つかりました`,
                fuzzyResults,
                exactMatch: exactMatch || undefined
            };
        } else if (exactMatch) {
            return {
                success: true,
                message: `「${foodName}」の完全一致のみ見つかりました`,
                fuzzyResults: [],
                exactMatch
            };
        } else {
            // 検索結果が0件の場合、キャッシュを更新して再試行
            console.log(`NutritionUtils: 結果が見つからないため、キャッシュを更新して再試行`);
            await supabaseDB.forceRefreshCache();

            // 再検索
            const retryFuzzyResults = await supabaseDB.getFoodsByFuzzyMatch(foodName, 5);
            if (retryFuzzyResults.length > 0) {
                return {
                    success: true,
                    message: `キャッシュ更新後に「${foodName}」に類似した食品が${retryFuzzyResults.length}件見つかりました`,
                    fuzzyResults: retryFuzzyResults
                };
            }

            return {
                success: false,
                message: `「${foodName}」に一致する食品が見つかりませんでした。キャッシュ更新後も結果はありません。`
            };
        }
    } catch (error) {
        console.error(`NutritionUtils: 食品検索テスト中にエラー発生:`, error);
        return {
            success: false,
            message: `検索中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * 栄養計算の結果が異常値（非現実的な値）かどうかをチェック
 * @param calories カロリー値
 * @param foodCount 食品数
 * @returns 異常値かどうかの判定と警告メッセージ
 */
export function checkAbnormalNutritionValues(calories: number, foodCount: number = 1): {
    isAbnormal: boolean;
    warning?: string
} {
    // 一般的な1食分の上限値（経験的な値）
    const MAX_CALORIES_PER_FOOD = 800; // 1食品あたり最大800kcal
    const MAX_MEAL_CALORIES = 2000;    // 1食あたり最大2000kcal

    // 食品数に基づいた上限値
    const maxCaloriesForFoodCount = Math.min(MAX_CALORIES_PER_FOOD * foodCount, MAX_MEAL_CALORIES);

    // 異常値のチェック
    if (calories <= 0) {
        return {
            isAbnormal: true,
            warning: 'カロリー値が0以下です。データが不正確な可能性があります。'
        };
    } else if (calories > maxCaloriesForFoodCount) {
        return {
            isAbnormal: true,
            warning: `カロリー値(${calories}kcal)が一般的な上限(${maxCaloriesForFoodCount}kcal)を超えています。量の指定を確認してください。`
        };
    }

    return { isAbnormal: false };
} 