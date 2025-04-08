/**
 * テキストの正規化
 * 検索用に文字列を標準化する
 */
export function normalizeText(text: string): string {
    if (!text) return '';

    return text
        .toLowerCase()
        .replace(/\s+/g, '') // 空白を削除
        .replace(/[０-９]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0)) // 全角数字→半角
        .replace(/[ａ-ｚＡ-Ｚ]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0)) // 全角英字→半角
        .replace(/[\u3041-\u3096]/g, m => { // ひらがな→カタカナ変換は不要（検索の柔軟性のため）
            return m;
        })
        .replace(/[、。！？]/g, ''); // 句読点を削除
}

/**
 * レーベンシュタイン距離の計算
 */
export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) {
        matrix[i]![0] = i;
    }

    for (let j = 0; j <= b.length; j++) {
        matrix[0]![j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i]![j] = Math.min(
                (matrix[i - 1]?.[j] ?? Infinity) + 1,     // 削除
                (matrix[i]?.[j - 1] ?? Infinity) + 1,     // 挿入
                (matrix[i - 1]?.[j - 1] ?? Infinity) + cost // 置換
            );
        }
    }

    return matrix[a.length]?.[b.length] ?? Math.max(a.length, b.length);
}

/**
 * 文字列間の類似度計算（0.0-1.0）
 */
export function calculateSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const distance = levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);

    // 部分一致ボーナス
    let bonus = 0;
    if (a.includes(b) || b.includes(a)) {
        const minLength = Math.min(a.length, b.length);
        bonus = 0.1 + (minLength / maxLength) * 0.1;
    }

    const similarity = 1 - (distance / maxLength) + bonus;

    return Math.max(0, Math.min(1, similarity)); // 0.0-1.0の範囲に収める
} 