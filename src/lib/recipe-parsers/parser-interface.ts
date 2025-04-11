import { FoodInputParseResult } from '@/lib/food/food-input-parser';

/**
 * レシピパーサーインターフェース
 */
export interface RecipeParser {
    /**
     * レシピサイトから材料情報を抽出する
     * @param document 解析対象のHTMLドキュメント
     * @returns 材料情報の配列
     */
    extractIngredients(document: Document): FoodInputParseResult[];

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

    /**
     * レシピの分量（何人前か）を抽出 (オプション)
     */
    extractServings?(document: Document): string | undefined;
}

/**
 * メタタグからコンテンツを取得する共通ユーティリティ関数
 */
export function getMetaContent(document: Document, name: string): string | undefined {
    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return meta?.getAttribute('content') || undefined;
}

/**
 * HTMLドキュメントからJSON-LD形式の構造化データを抽出
 * @param document HTMLドキュメントオブジェクト
 * @returns JSON-LDデータの配列、見つからない場合やパースエラー時は空配列
 */
export function extractJsonLd(document: Document): any[] { // 戻り値の型を any[] に設定
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const jsonData: any[] = [];

    scripts.forEach(script => {
        try {
            if (script.textContent) {
                const parsed = JSON.parse(script.textContent);
                // パース結果が配列の場合とオブジェクトの場合があるため、統一的に扱う
                if (Array.isArray(parsed)) {
                    jsonData.push(...parsed);
                } else if (typeof parsed === 'object' && parsed !== null) {
                    jsonData.push(parsed);
                }
            }
        } catch (error) {
            console.error('Error parsing JSON-LD script:', error, 'Script content:', script.textContent?.substring(0, 100));
            // エラーが発生しても処理を続行
        }
    });

    return jsonData;
} 