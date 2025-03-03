/**
 * 日付をYYYY-MM-DD形式にフォーマットする
 * @param date 日付文字列またはDate
 * @returns YYYY-MM-DD形式の日付文字列
 */
export const formatDate = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
};

/**
 * 指定した日数を日付に加算する
 * @param date 基準日
 * @param days 加算する日数
 * @returns 加算後の日付
 */
export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

/**
 * 指定した日付の週初め（日曜日）を取得する
 * @param date 基準日
 * @returns 週初めの日付
 */
export const getStartOfWeek = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    return result;
};

/**
 * 指定した日付の週末（土曜日）を取得する
 * @param date 基準日
 * @returns 週末の日付
 */
export const getEndOfWeek = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() + (6 - day));
    return result;
};

/**
 * 指定した日付の月初めを取得する
 * @param date 基準日
 * @returns 月初めの日付
 */
export const getStartOfMonth = (date: Date): Date => {
    const result = new Date(date);
    result.setDate(1);
    return result;
};

/**
 * 指定した日付の月末を取得する
 * @param date 基準日
 * @returns 月末の日付
 */
export const getEndOfMonth = (date: Date): Date => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1);
    result.setDate(0);
    return result;
};

/**
 * 指定した期間の種類に応じた日付範囲を取得する
 * @param date 基準日
 * @param rangeType 期間の種類（'day', 'week', 'month'）
 * @returns 開始日と終了日
 */
export const getDateRange = (date: Date, rangeType: 'day' | 'week' | 'month'): { startDate: string, endDate: string } => {
    let startDate: Date;
    let endDate: Date;

    switch (rangeType) {
        case 'day':
            startDate = date;
            endDate = date;
            break;
        case 'week':
            startDate = getStartOfWeek(date);
            endDate = getEndOfWeek(date);
            break;
        case 'month':
            startDate = getStartOfMonth(date);
            endDate = getEndOfMonth(date);
            break;
        default:
            startDate = date;
            endDate = date;
    }

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
};
