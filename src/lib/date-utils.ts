import { format, differenceInYears, differenceInWeeks, addWeeks, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * 日付を YYYY-MM-DD 形式にフォーマットする
 */
export function formatDate(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

/**
 * 日付を人間が読みやすい形式にフォーマットする
 */
export function formatReadableDate(date: Date): string {
    return format(date, 'yyyy年MM月dd日', { locale: ja });
}

/**
 * 生年月日から年齢を計算する
 */
export function calculateAgeFromBirthdate(birthdate: string): number {
    const birthdateDate = new Date(birthdate);
    const today = new Date();
    return differenceInYears(today, birthdateDate);
}

/**
 * 出産予定日から妊娠週数を計算する
 * より正確に週数と日数を考慮した計算
 * 日本の習慣に合わせて「〜週目」という表現を使用（例: 19週4日は「20週目」）
 */
export function calculatePregnancyWeek(dueDate: string): { week: number; days: number } {
    const dueDateObj = new Date(dueDate);
    const today = new Date();

    // タイムゾーンの違いを無視するため、日付のみで比較
    dueDateObj.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // 出産予定日は妊娠40週目
    const totalPregnancyDays = 40 * 7;

    // 妊娠開始日を計算（出産予定日の40週前）
    // const conceptionDate = addWeeks(dueDateObj, -totalPregnancyWeeks);
    const conceptionDate = new Date(dueDateObj.getTime() - totalPregnancyDays * 24 * 60 * 60 * 1000);

    // 妊娠開始日から今日までの日数を計算
    const daysPregnant = differenceInDays(today, conceptionDate);

    // 日数を週数に変換（端数切り捨て）
    const completedWeeks = Math.max(0, Math.floor(daysPregnant / 7)); // 負の日数にならないように

    // 端数の日数を計算
    const remainingDays = Math.max(0, daysPregnant % 7); // 負の日数にならないように

    // 日本の習慣に合わせた「〜週目」表現ではなく、完了した週数と日数を使用する
    // const japaneseStyleWeek = remainingDays > 0 ? completedWeeks + 1 : completedWeeks;

    // 妊娠週数を適切な範囲（0〜40週）に制限
    // return Math.max(0, Math.min(totalPregnancyWeeks, japaneseStyleWeek));
    const currentWeek = Math.min(40, completedWeeks);
    const currentDays = currentWeek === 40 ? 0 : remainingDays; // 40週になったら日は0

    return { week: currentWeek, days: currentDays };
}

/**
 * 妊娠週数からトライメスター（妊娠期）の番号を取得する
 * 日本の習慣に合わせた区分
 * @returns トライメスター番号 (1, 2, 3)
 */
export function getTrimesterNumber(week: number): number {
    // 日本の習慣に合わせた妊娠期の区分
    if (week <= 15) return 1; // 第1期: 1-15週目
    if (week <= 27) return 2; // 第2期: 16-27週目
    return 3; // 第3期: 28-40週目
}

/**
 * 妊娠週数からトライメスター（妊娠期）の名称を取得する
 * @returns トライメスターの表示名
 */
export function getTrimesterName(week: number): string {
    if (week <= 15) return "第1期（初期）";
    if (week <= 27) return "第2期（中期）";
    return "第3期（後期）";
}

// 後方互換性のために元の関数名も残しておく
export const getTrimesterFromWeek = getTrimesterName;

/**
 * 現在の日付から指定された日数を加算または減算する
 */
export function addDaysToDate(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
}

/**
 * 2つの日付間の日数を計算する
 */
export function daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 現在の季節を取得する
 * @returns 現在の季節（春、夏、秋、冬）
 */
export function getCurrentSeason(): string {
    const now = new Date();
    const month = now.getMonth() + 1; // 0-indexed -> 1-indexed

    // 日本の季節区分に基づいて季節を判定
    if (3 <= month && month <= 5) {
        return '春';
    } else if (6 <= month && month <= 8) {
        return '夏';
    } else if (9 <= month && month <= 11) {
        return '秋';
    } else {
        return '冬';
    }
}

/**
 * 日本時間の現在日付を取得する（YYYY-MM-DD形式）
 */
export function getJapanDate(): string {
    const now = new Date();
    // 日本時間を考慮してフォーマット (date-fns を利用)
    // 注意: タイムゾーンはサーバー/クライアント環境に依存する可能性があるため、
    // 一貫性を保つためには、専用のライブラリ (e.g., date-fns-tz) の導入も検討する。
    // ここでは単純に `format` を使用する。
    return format(now, 'yyyy-MM-dd');
}

/**
 * 指定された日付を含む週または月の開始日と終了日を取得する
 * @param date 基準となる日付
 * @param type 期間のタイプ ('week' または 'month')
 * @returns 開始日と終了日のオブジェクト { startDate: string, endDate: string }
 */
export function getDateRange(date: Date, type: 'week' | 'month'): { startDate: string, endDate: string } {
    let startDate: Date;
    let endDate: Date;

    if (type === 'week') {
        // 週の開始を月曜日とする場合 (date-fns のデフォルトは日曜日)
        // locale: ja を指定すると月曜日始まりになる
        startDate = startOfWeek(date, { locale: ja });
        endDate = endOfWeek(date, { locale: ja });
    } else if (type === 'month') {
        startDate = startOfMonth(date);
        endDate = endOfMonth(date);
    } else {
        // サポートされていないタイプの場合は、当日を開始日・終了日とする
        console.warn(`getDateRange: Unsupported type "${type}". Returning current date.`);
        startDate = date;
        endDate = date;
    }

    return {
        startDate: formatDate(startDate), // 既存の formatDate を使用
        endDate: formatDate(endDate)     // 既存の formatDate を使用
    };
} 