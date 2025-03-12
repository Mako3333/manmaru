import { format, differenceInYears, differenceInWeeks, addWeeks, differenceInDays } from 'date-fns';
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
export function calculatePregnancyWeek(dueDate: string): number {
    const dueDateObj = new Date(dueDate);
    const today = new Date();

    // タイムゾーンの違いを無視するため、日付のみで比較
    dueDateObj.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // 出産予定日は妊娠40週目
    const totalPregnancyWeeks = 40;

    // 妊娠開始日を計算（出産予定日の40週前）
    const conceptionDate = addWeeks(dueDateObj, -totalPregnancyWeeks);

    // 妊娠開始日から今日までの日数を計算
    const daysPregnant = differenceInDays(today, conceptionDate);

    // 日数を週数に変換（端数切り捨て）
    const completedWeeks = Math.floor(daysPregnant / 7);

    // 端数の日数を計算
    const remainingDays = daysPregnant % 7;

    // 日本の習慣に合わせて「〜週目」表現に調整（1日以上経過していれば次の週目と数える）
    // 例: 19週4日 → 「20週目」
    const japaneseStyleWeek = remainingDays > 0 ? completedWeeks + 1 : completedWeeks;

    // 妊娠週数を適切な範囲（0〜40週）に制限
    return Math.max(0, Math.min(totalPregnancyWeeks, japaneseStyleWeek));
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