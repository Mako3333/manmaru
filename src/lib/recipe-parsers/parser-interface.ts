export interface RecipeParser {
    /**
     * レシピサイトから材料情報を抽出する
     * @param document 解析対象のHTMLドキュメント
     * @returns 材料情報の配列
     */
    extractIngredients(document: Document): {
        name: string;
        quantity?: string;
        unit?: string;
        group?: string;
    }[];

    /**
     * レシピのタイトルを抽出する
     * @param document 解析対象のHTMLドキュメント
     * @returns レシピのタイトル
     */
    extractTitle(document: Document): string;

    /**
     * レシピの画像URLを抽出する
     * @param document 解析対象のHTMLドキュメント
     * @returns 画像URL
     */
    extractImage(document: Document): string | undefined;
}

/**
 * メタタグからコンテンツを取得する共通ユーティリティ関数
 */
export function getMetaContent(document: Document, property: string): string | undefined {
    const metaTag = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
    return metaTag?.getAttribute('content') || undefined;
} 