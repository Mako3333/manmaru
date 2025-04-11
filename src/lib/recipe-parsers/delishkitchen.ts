import { RecipeParser, getMetaContent, extractJsonLd } from './parser-interface';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';

export class DelishKitchenParser implements RecipeParser {
    /**
     * デリッシュキッチンのレシピから材料情報を抽出する
     */
    extractIngredients(document: Document): FoodInputParseResult[] {
        const ingredients: FoodInputParseResult[] = [];

        try {
            // console.log('デリッシュキッチンのレシピを解析中...'); // デバッグ用

            // 正確なセレクタを使用
            const ingredientElements = document.querySelectorAll('li.ingredient');
            // console.log(`${ingredientElements.length}個の材料要素が見つかりました`); // デバッグ用

            // グループ名を追跡
            let currentGroup = '';

            // 各材料要素を処理
            Array.from(document.querySelectorAll('li.ingredient, li.ingredient-group_header')).forEach(element => {
                // グループヘッダーの場合
                if (element.classList.contains('ingredient-group_header')) {
                    currentGroup = element.textContent?.trim() || '';
                    // console.log(`材料グループ: ${currentGroup}`); // デバッグ用
                    return;
                }

                // 材料の場合
                const nameElement = element.querySelector('.ingredient-name');
                const quantityElement = element.querySelector('.ingredient-serving');

                if (nameElement) {
                    ingredients.push({
                        foodName: nameElement.textContent?.trim() || '',
                        quantityText: quantityElement?.textContent?.trim() || null,
                        confidence: 0.9
                    });
                }
            });

            // グループが見つからなかった場合の代替セレクタ
            if (ingredients.length === 0) {
                // 代替セレクタの試行
                const altSelectors = [
                    '.ingredient-list__item',
                    '.recipe-ingredients__item',
                    '.recipe-ingredient-list li',
                    '[class*="ingredient"]'
                ];

                for (const selector of altSelectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        elements.forEach(element => {
                            const text = element.textContent?.trim();
                            if (text && text.length > 0) {
                                // 「材料名：分量」形式を分割
                                const parts = text.split(/：|:|…/);
                                if (parts.length > 1 && parts[0]) {
                                    ingredients.push({
                                        foodName: parts[0].trim() || '',
                                        quantityText: parts.length > 1 && parts[1] ? parts[1].trim() || null : null,
                                        confidence: 0.8
                                    });
                                } else {
                                    ingredients.push({
                                        foodName: text,
                                        quantityText: null,
                                        confidence: 0.7
                                    });
                                }
                            }
                        });
                        break;
                    }
                }
            }

            // 材料が見つからない場合、テーブルを探す
            if (ingredients.length === 0) {
                this.extractIngredientsFromTables(document, ingredients);
            }

            // デバッグ情報
            // console.log(`デリッシュキッチンのレシピ解析: ${ingredients.length}個の材料を検出しました`);
            // if (ingredients.length > 0) {
            //     console.log('検出された材料の例:', ingredients.slice(0, 3));
            // }

            return ingredients;
        } catch (error) {
            console.error('デリッシュキッチン材料抽出エラー:', error);
            throw new AppError({
                code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                message: `デリッシュキッチンのレシピ解析でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: 'デリッシュキッチンのレシピ解析に失敗しました。サイトの仕様が変更された可能性があります。',
                originalError: error instanceof Error ? error : new Error(String(error))
            });
        }
    }

    /**
     * テーブルから材料を抽出
     */
    private extractIngredientsFromTables(
        document: Document,
        ingredients: FoodInputParseResult[]
    ): void {
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            if (rows.length >= 3) { // 最低3行ある表は材料テーブルの可能性が高い
                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2 && cells[0]?.textContent && cells[1]?.textContent) {
                        const name = cells[0].textContent.trim();
                        const quantity = cells[1].textContent.trim() || null;
                        if (name && !name.includes('function(') && !name.includes('script')) {
                            ingredients.push({
                                foodName: name,
                                quantityText: quantity,
                                confidence: 0.8
                            });
                        }
                    }
                }
                if (ingredients.length > 0) break;
            }
        }
    }

    /**
     * レシピのタイトルを抽出
     */
    extractTitle(document: Document): string {
        // OGPタイトルを優先
        const ogTitle = getMetaContent(document, 'og:title');
        if (ogTitle) return ogTitle;

        // h1タグをチェック
        const h1 = document.querySelector('h1.recipe-title');
        if (h1?.textContent) return h1.textContent.trim();

        // titleタグをチェック
        const titleTag = document.querySelector('title');
        if (titleTag?.textContent) return titleTag.textContent.trim();

        return '無題のレシピ';
    }

    /**
     * レシピの画像URLを抽出
     */
    extractImage(document: Document): string | undefined {
        // 1. OGP画像を優先
        const ogImage = getMetaContent(document, 'og:image');
        if (ogImage) {
            // console.log('[DelishKitchenParser] Found image via og:image'); // デバッグ用
            return ogImage;
        }

        // 2. JSON-LD から画像URLを抽出
        try {
            const jsonLdData = extractJsonLd(document); // JSON-LD抽出関数を呼び出す
            if (jsonLdData) {
                const recipeData = jsonLdData.find((item: Record<string, any>) => item['@type'] === 'Recipe');
                if (recipeData && recipeData.image) {
                    // imageが配列の場合と文字列の場合がある
                    const imageUrl = Array.isArray(recipeData.image) ? recipeData.image[0] : recipeData.image;
                    if (typeof imageUrl === 'string') {
                        // console.log('[DelishKitchenParser] Found image via JSON-LD'); // デバッグ用
                        return imageUrl;
                    }
                    // image オブジェクトの場合 (例: { "@type": "ImageObject", "url": "..." })
                    if (typeof imageUrl === 'object' && imageUrl !== null && 'url' in imageUrl && typeof imageUrl.url === 'string') {
                        // console.log('[DelishKitchenParser] Found image via JSON-LD (ImageObject)'); // デバッグ用
                        return imageUrl.url;
                    }
                }
            }
        } catch (e) {
            console.error('[DelishKitchenParser] Error parsing JSON-LD:', e);
        }

        // 3. 特定の画像セレクタを試す (より具体的で信頼性の高いものから順に)
        const selectors = [
            '.video-player img',        // 動画プレーヤー内の画像
            'figure.recipe-video img',  // 動画セクションのfigure内の画像
            'figure.recipe-image img',  // 静止画セクションのfigure内の画像
            'img[itemprop="image"]',    // schema.org の itemprop を持つ画像
            '.recipe-thumbnail img',    // 以前のセレクタ (互換性のため残す)
            '.recipe-main-image img', // 以前のセレクタ (互換性のため残す)
            'article img',              // 記事本文の最初の画像 (最終手段)
            'main img'                  // メインコンテンツの最初の画像 (最終手段)
        ];

        for (const selector of selectors) {
            const imgElement = document.querySelector(selector) as HTMLImageElement | null;
            if (imgElement?.src) {
                // console.log(`[DelishKitchenParser] Found image via selector: ${selector}`); // デバッグ用
                return imgElement.src;
            }
        }

        console.warn('[DelishKitchenParser] Could not extract image URL.');
        return undefined;
    }
} 