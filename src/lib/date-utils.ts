import { format, differenceInYears, differenceInWeeks } from 'date-fns';
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
 */
export function calculatePregnancyWeek(dueDate: string): number {
    const dueDateObj = new Date(dueDate);
    const today = new Date();

    // 出産予定日は妊娠40週目
    const totalPregnancyWeeks = 40;

    // 出産予定日から今日までの週数を計算
    const weeksToGo = Math.max(0, Math.ceil(differenceInWeeks(dueDateObj, today)));

    // 妊娠週数 = 全妊娠期間 - 残り週数
    return Math.min(totalPregnancyWeeks, totalPregnancyWeeks - weeksToGo);
}

/**
 * 妊娠週数からトライメスターを取得する
 */
export function getTrimesterFromWeek(week: number): string {
    if (week < 14) return "第1期（初期）";
    if (week < 28) return "第2期（中期）";
    return "第3期（後期）";
}

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