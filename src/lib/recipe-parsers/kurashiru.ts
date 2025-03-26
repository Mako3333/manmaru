import { RecipeParser, getMetaContent } from './parser-interface';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';

export class KurashiruParser implements RecipeParser {
    /**
     * クラシルのレシピから材料情報を抽出する
     */
    extractIngredients(document: Document): { name: string; quantity?: string; unit?: string; group?: string; }[] {
        const ingredients: { name: string; quantity?: string; unit?: string; group?: string; }[] = [];

        try {
            console.log('クラシルのレシピを解析中...');

            // 材料リスト要素を探す
            const ingredientElements = document.querySelectorAll('.ingredient-list__item');
            console.log(`${ingredientElements.length}個の材料要素が見つかりました`);

            if (ingredientElements.length > 0) {
                ingredientElements.forEach(element => {
                    const textContent = element.textContent?.trim();
                    if (textContent) {
                        // 「材料名：分量」形式を分割
                        const parts = textContent.split(/：|:/);
                        if (parts.length > 1) {
                            ingredients.push({
                                name: parts[0].trim(),
                                quantity: parts[1].trim()
                            });
                        } else {
                            ingredients.push({ name: textContent });
                        }
                    }
                });
            } else {
                // 別の可能性のあるセレクタを試す
                const altSelectors = [
                    '.recipe-ingredients__item',
                    '.recipe-ingredient-item',
                    '.recipe-material__item',
                    '[class*="ingredient"]'
                ];

                for (const selector of altSelectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        elements.forEach(element => {
                            const name = element.querySelector('.ingredient-name, .material-name, .name')?.textContent?.trim();
                            const quantity = element.querySelector('.ingredient-quantity, .material-quantity, .quantity')?.textContent?.trim();

                            if (name) {
                                ingredients.push({
                                    name: name,
                                    quantity: quantity
                                });
                            } else {
                                const text = element.textContent?.trim();
                                if (text) {
                                    // 「材料名：分量」形式を分割
                                    const parts = text.split(/：|:|…/);
                                    if (parts.length > 1) {
                                        ingredients.push({
                                            name: parts[0].trim(),
                                            quantity: parts[1].trim()
                                        });
                                    } else {
                                        ingredients.push({ name: text });
                                    }
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

            // 材料が見つからない場合、構造化データから抽出を試みる
            if (ingredients.length === 0) {
                this.extractFromStructuredData(document, ingredients);
            }

            // デバッグ情報
            console.log(`クラシルのレシピ解析: ${ingredients.length}個の材料を検出しました`);
            if (ingredients.length > 0) {
                console.log('検出された材料の例:', ingredients.slice(0, 3));
            }

            return ingredients;
        } catch (error) {
            console.error('クラシル材料抽出エラー:', error);
            throw new ApiError(
                `クラシルのレシピ解析でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.RECIPE_PROCESSING_ERROR,
                'クラシルのレシピ解析に失敗しました。サイトの仕様が変更された可能性があります。',
                400
            );
        }
    }

    /**
     * テーブルから材料を抽出
     */
    private extractIngredientsFromTables(
        document: Document,
        ingredients: { name: string; quantity?: string; unit?: string; group?: string; }[]
    ): void {
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            if (rows.length >= 3) { // 最低3行ある表は材料テーブルの可能性が高い
                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const name = cells[0].textContent?.trim();
                        const quantity = cells[1].textContent?.trim();
                        if (name && !name.includes('function(') && !name.includes('script')) {
                            ingredients.push({
                                name: name,
                                quantity: quantity
                            });
                        }
                    }
                }
                if (ingredients.length > 0) break;
            }
        }
    }

    /**
     * 構造化データから材料を抽出
     */
    private extractFromStructuredData(
        document: Document,
        ingredients: { name: string; quantity?: string; unit?: string; group?: string; }[]
    ): void {
        const scriptElements = document.querySelectorAll('script[type="application/ld+json"]');

        for (const script of scriptElements) {
            try {
                const jsonContent = script.textContent;
                if (jsonContent) {
                    const data = JSON.parse(jsonContent);

                    // Recipe構造化データを探す
                    if (data['@type'] === 'Recipe' && Array.isArray(data.recipeIngredient)) {
                        for (const ingredient of data.recipeIngredient) {
                            if (typeof ingredient === 'string') {
                                // 「材料名：分量」形式を分割
                                const parts = ingredient.split(/：|:|…/);
                                if (parts.length > 1) {
                                    ingredients.push({
                                        name: parts[0].trim(),
                                        quantity: parts.slice(1).join('').trim()
                                    });
                                } else {
                                    ingredients.push({ name: ingredient.trim() });
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('構造化データの解析に失敗:', e);
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
        const h1 = document.querySelector('h1.recipe-title, h1.title');
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
        // OGP画像を優先
        const ogImage = getMetaContent(document, 'og:image');
        if (ogImage) return ogImage;

        // メイン画像の検索
        const mainImage = document.querySelector('.recipe-image img, .main-image img, .hero-image img');
        return mainImage?.getAttribute('src') || undefined;
    }
} 