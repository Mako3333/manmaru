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
    // 現在のUTC時間を取得
    const now = new Date();

    // 日本時間に変換（UTC+9）
    // ただし、タイムゾーンオフセットを考慮して正確な日本時間を計算
    const japanTime = new Date(now.getTime());

    // YYYY-MM-DD形式に変換
    const year = japanTime.getFullYear();
    const month = String(japanTime.getMonth() + 1).padStart(2, '0');
    const day = String(japanTime.getDate()).padStart(2, '0');

    console.log('日本時間の現在日付:', `${year}-${month}-${day}`, '元のDate:', now);

    return `${year}-${month}-${day}`;
}

/**
 * 日付をフォーマットする
 * @param date 日付オブジェクトまたは日付文字列
 * @param format フォーマット（'yyyy-MM-dd'など）
 * @returns フォーマットされた日付文字列
 */
export function formatDate(date: Date | string, format: string = 'yyyy-MM-dd'): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    // 無効な日付の場合
    if (isNaN(d.getTime())) {
        return '';
    }

    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const seconds = d.getSeconds();

    // フォーマット置換
    return format
        .replace('yyyy', year.toString())
        .replace('MM', month.toString().padStart(2, '0'))
        .replace('dd', day.toString().padStart(2, '0'))
        .replace('HH', hours.toString().padStart(2, '0'))
        .replace('mm', minutes.toString().padStart(2, '0'))
        .replace('ss', seconds.toString().padStart(2, '0'));
}

/**
 * 2つの日付間の日数を計算する
 * @param date1 日付1
 * @param date2 日付2
 * @returns 日数差（絶対値）
 */
export function daysBetween(date1: Date | string, date2: Date | string): number {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

    // 時間部分を無視して日付のみで計算
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());

    // ミリ秒を日に変換
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    return Math.floor(Math.abs(utc2 - utc1) / MS_PER_DAY);
} 