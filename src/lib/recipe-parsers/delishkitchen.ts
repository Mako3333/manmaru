import { RecipeParser, getMetaContent } from './parser-interface';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';

export class DelishKitchenParser implements RecipeParser {
    /**
     * デリッシュキッチンのレシピから材料情報を抽出する
     */
    extractIngredients(document: Document): { name: string; quantity?: string; unit?: string; group?: string; }[] {
        const ingredients: { name: string; quantity?: string; unit?: string; group?: string; }[] = [];

        try {
            console.log('デリッシュキッチンのレシピを解析中...');

            // 正確なセレクタを使用
            const ingredientElements = document.querySelectorAll('li.ingredient');
            console.log(`${ingredientElements.length}個の材料要素が見つかりました`);

            // グループ名を追跡
            let currentGroup = '';

            // 各材料要素を処理
            Array.from(document.querySelectorAll('li.ingredient, li.ingredient-group_header')).forEach(element => {
                // グループヘッダーの場合
                if (element.classList.contains('ingredient-group_header')) {
                    currentGroup = element.textContent?.trim() || '';
                    console.log(`材料グループ: ${currentGroup}`);
                    return;
                }

                // 材料の場合
                const nameElement = element.querySelector('.ingredient-name');
                const quantityElement = element.querySelector('.ingredient-serving');

                if (nameElement) {
                    ingredients.push({
                        name: nameElement.textContent?.trim() || '',
                        quantity: quantityElement?.textContent?.trim(),
                        group: currentGroup || undefined
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
                                if (parts.length > 1) {
                                    ingredients.push({
                                        name: parts[0].trim(),
                                        quantity: parts[1].trim()
                                    });
                                } else {
                                    ingredients.push({ name: text });
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
            console.log(`デリッシュキッチンのレシピ解析: ${ingredients.length}個の材料を検出しました`);
            if (ingredients.length > 0) {
                console.log('検出された材料の例:', ingredients.slice(0, 3));
            }

            return ingredients;
        } catch (error) {
            console.error('デリッシュキッチン材料抽出エラー:', error);
            throw new ApiError(
                `デリッシュキッチンのレシピ解析でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.RECIPE_PROCESSING_ERROR,
                'デリッシュキッチンのレシピ解析に失敗しました。サイトの仕様が変更された可能性があります。',
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
        // OGP画像を優先
        const ogImage = getMetaContent(document, 'og:image');
        if (ogImage) return ogImage;

        // メイン画像の検索
        const mainImage = document.querySelector('.recipe-thumbnail img, .recipe-main-image img');
        return mainImage?.getAttribute('src') || undefined;
    }
} 