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
}): Record<string, any> {
    const date = params.date || new Date();
    const month = date.getMonth() + 1; // 0-11 なので +1

    return {
        pregnancyWeek: params.pregnancyWeek,
        trimester: params.trimester,
        deficientNutrients: params.deficientNutrients,
        isSummary: params.isSummary,
        formattedDate: formatDateJP(date),
        currentSeason: getSeason(month)
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