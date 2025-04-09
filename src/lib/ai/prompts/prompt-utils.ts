import { format } from 'date-fns';
import { PromptType } from '@/lib/ai/prompts/prompt-service';
// import { UserProfile, NutritionTargets } from '@/types/profile'; // profile.ts が見つからないためコメントアウト
import { StandardizedMealNutrition } from '@/types/nutrition';
import { DEFAULT_NUTRITION_TARGETS } from '@/lib/nutrition/nutrition-display-utils'; // NutritionTargets の実体はこちら
import {
    calculatePregnancyWeek,
    getTrimesterNumber,
    getCurrentSeason,
} from '@/lib/date-utils';

// UserProfile の仮定義 (より適切な場所で定義するべき)
interface UserProfile {
    due_date?: string | null;
    name?: string | null;
    dietaryRestrictions?: string[] | null;
    allergies?: string[] | null;
    preferences?: string | null;
}

// NutritionTargets の型定義
type NutritionTargets = typeof DEFAULT_NUTRITION_TARGETS;

/**
 * 現在の季節を判定する関数
 * @param month 月 (1-12)
 * @returns 季節の名前
 */
export function getSeason(month: number): string {
    if (month >= 3 && month <= 5) {
        return '春';
    } else if (month >= 6 && month <= 8) {
        return '夏';
    } else if (month >= 9 && month <= 11) {
        return '秋';
    } else {
        return '冬';
    }
}

/**
 * 日付を日本語フォーマットで取得
 * @param date 日付オブジェクト
 * @returns フォーマットされた日付文字列
 */
export function formatDateJP(date: Date = new Date()): string {
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * コンテキストヘルパー関数
 * 栄養アドバイス用のコンテキストを生成
 */
export function createNutritionAdviceContext(params: {
    pregnancyWeek: number;
    trimester: number;
    deficientNutrients: string[];
    isSummary: boolean;
    date?: Date;
    profile: UserProfile;
    targets: NutritionTargets;
    dailyData: StandardizedMealNutrition;
}): Record<string, unknown> {
    const date = params.date || new Date();
    const month = date.getMonth() + 1; // 0-11 なので +1

    return {
        pregnancyWeek: params.pregnancyWeek,
        trimester: params.trimester,
        deficientNutrients: params.deficientNutrients,
        isSummary: params.isSummary,
        formattedDate: formatDateJP(date),
        currentSeason: getSeason(month),
        profile: params.profile,
        targets: params.targets,
        dailyData: params.dailyData
    };
}

/**
 * 食品テキストを配列から整形
 */
export function formatFoodsText(foods: Array<{ name: string, quantity?: string }>): string {
    return foods.map(food =>
        `・${food.name}${food.quantity ? ` ${food.quantity}` : ''}`
    ).join('\n');
}

/**
 * レシピ提案用のコンテキストを生成
 * @param profile ユーザーのプロフィール
 * @param deficientNutrients 栄養素不足のリスト
 * @param mealHistory 過去の食事履歴
 * @returns レシピ提案用のコンテキストオブジェクト
 */
export function createRecipeSuggestionContext(
    profile: UserProfile,
    deficientNutrients: string[],
    mealHistory?: Record<string, StandardizedMealNutrition>
): Record<string, unknown> {
    let pregnancyWeek: number | undefined;
    let trimester: number | undefined;

    if (profile.due_date) {
        try {
            pregnancyWeek = calculatePregnancyWeek(profile.due_date);
            trimester = getTrimesterNumber(pregnancyWeek);
        } catch (error) {
            console.error('Error calculating pregnancy week/trimester:', error);
        }
    }

    const context: Record<string, unknown> = {
        ...(pregnancyWeek !== undefined && { pregnancyWeek }),
        ...(trimester !== undefined && { trimester }),
        deficientNutrients: deficientNutrients.join(', '),
        allergies: profile.allergies?.join(', ') ?? '特になし',
        preferences: profile.preferences ?? '特になし',
        recentMeals: mealHistory
            ? JSON.stringify(Object.values(mealHistory).slice(-5), null, 2)
            : 'なし',
    };

    return context as Record<string, unknown>;
}

/**
 * 食品解析用のコンテキストを生成
 * @param userQuery ユーザーのクエリ文字列。
 * @returns 食品解析プロンプトのコンテキストオブジェクト。
 */
export function createFoodParsingContext(
    userQuery: string,
): Record<string, unknown> {
    return {
        userQuery,
    };
} 