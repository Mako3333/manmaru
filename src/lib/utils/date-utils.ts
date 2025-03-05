/**
 * 現在の季節を取得する関数
 * @returns 現在の季節を表す文字列（'春', '夏', '秋', '冬'）
 */
export const getCurrentSeason = (): string => {
    const now = new Date();
    const month = now.getMonth() + 1; // JavaScriptの月は0から始まるため+1

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
}; 