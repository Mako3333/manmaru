import { RecipeParser, getMetaContent } from './parser-interface';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';

export class CookpadParser implements RecipeParser {
    /**
     * クックパッドのレシピから材料情報を抽出する
     */
    extractIngredients(document: Document): { name: string; quantity?: string; unit?: string; group?: string; }[] {
        let ingredients: { name: string; quantity?: string; unit?: string; group?: string; }[] = [];

        try {
            console.log('クックパッドのレシピを解析中...');

            // 新しいHTML構造に対応したセレクタ
            const selectors = [
                // 新しい構造
                '.ingredient-list li.justified-quantity-and-name',
                'li[id^="ingredient_"]',
                '.ingredients-list li',
                // 旧構造
                '.ingredient_row',
                // 可能性のある代替セレクター
                '.ingredient-list__item',
                '.ingredient',
                '.recipe-ingredients__item',
                '.recipe_ingredient',
                '.ingredients_list_item',
                // より汎用的なセレクター
                '[class*="ingredient"]',
                'ol li'
            ];

            let ingredientElements: NodeListOf<Element> | Element[] = new Array<Element>();

            // セレクタを一つずつ試す
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                console.log(`セレクター ${selector} で ${elements.length}個の要素が見つかりました`);

                if (elements.length > 0) {
                    ingredientElements = elements;
                    break;
                }
            }

            // 材料を抽出
            ingredientElements.forEach(element => {
                try {
                    // 新しい構造: <span>材料名</span> <bdi>分量</bdi>
                    const nameSpan = element.querySelector('span');
                    const quantityBdi = element.querySelector('bdi');

                    if (nameSpan && quantityBdi) {
                        // 新しい構造での抽出
                        const name = nameSpan.textContent?.trim() || '';
                        const quantity = quantityBdi.textContent?.trim() || '';

                        if (name) {
                            ingredients.push({
                                name: name,
                                quantity: quantity
                            });
                        }
                    } else {
                        // 旧構造または代替構造をチェック
                        const nameElement = element.querySelector('.ingredient_name, .name, .ingredient-name');
                        const quantityElement = element.querySelector('.ingredient_quantity, .quantity, .ingredient-quantity');

                        if (nameElement) {
                            ingredients.push({
                                name: nameElement.textContent?.trim() || '',
                                quantity: quantityElement?.textContent?.trim()
                            });
                        } else if (element.textContent) {
                            // セレクターで見つからない場合、テキスト全体から抽出を試みる
                            const text = element.textContent.trim();

                            // 「材料名：分量」または「材料名 分量」の形式を検出
                            const parts = text.split(/：|:|…|\s{2,}/);
                            if (parts.length > 1 && parts[0].length > 0) {
                                ingredients.push({
                                    name: parts[0].trim(),
                                    quantity: parts.slice(1).join(' ').trim()
                                });
                            } else if (text.length > 0 && text.length < 50) {
                                ingredients.push({ name: text });
                            }
                        }
                    }
                } catch (e) {
                    console.error('材料抽出中にエラーが発生しました:', e);
                }
            });

            // テーブルからの材料抽出
            if (ingredients.length === 0) {
                this.extractIngredientsFromTables(document, ingredients);
            }

            // テキスト全体からの材料抽出
            if (ingredients.length === 0) {
                this.extractIngredientsFromBodyText(document, ingredients);
            }

            // 不適切な材料の除外と重複の除去
            return this.cleanIngredients(ingredients);
        } catch (error) {
            console.error('クックパッド材料抽出エラー:', error);
            throw new ApiError(
                `クックパッドのレシピ解析でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.RECIPE_PROCESSING_ERROR,
                'クックパッドのレシピ解析に失敗しました。サイトの仕様が変更された可能性があります。',
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
        console.log('リスト要素から材料が見つからないため、テーブルを検索します');
        const tables = document.querySelectorAll('table');

        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            if (rows.length >= 3) { // 最低3行ある表は材料テーブルの可能性が高い
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const name = cells[0].textContent?.trim();
                        const quantity = cells[1].textContent?.trim();

                        if (name && name.length > 0 && name.length < 50) {
                            ingredients.push({
                                name: name,
                                quantity: quantity
                            });
                        }
                    }
                });
            }
        });
    }

    /**
     * テキスト全体から材料を抽出する
     */
    private extractIngredientsFromBodyText(
        document: Document,
        ingredients: { name: string; quantity?: string; unit?: string; group?: string; }[]
    ): void {
        console.log('構造化要素から材料が見つからないため、テキスト全体から抽出を試みます');
        const bodyText = document.body.textContent || '';

        // 「材料」セクションを抽出
        const materialsPattern = /材料(?:\s*[\(（][^）\)]*[\)）])?[\s\n]*?([\s\S]*?)(?:作り方|手順|レシピ|調理|準備|下準備|つくり方)/i;
        const materialsMatch = bodyText.match(materialsPattern);

        if (materialsMatch && materialsMatch[1]) {
            const materialsText = materialsMatch[1].trim();

            // 「材料 2人分」などの見出し行を判定し除外する関数
            const isHeaderLine = (line: string) => {
                return line.match(/^材料(\s|$)|^材料一覧|^材料（|^分量|^\d+人分|だし|つゆ/i) !== null;
            };

            // 材料の塊が抽出できた場合
            if (materialsText.includes('にんじん') || materialsText.includes('ごぼう') ||
                materialsText.includes('玉ねぎ') || materialsText.includes('肉') ||
                materialsText.includes('じゃがいも')) {

                // 材料リストの塊を行単位で分解
                const rawLines = materialsText.split(/\n|<br>/).map(line => line.trim())
                    .filter(line => line.length > 0);

                // 材料らしき行だけを抽出
                const ingredientLines = rawLines.filter(line => !isHeaderLine(line));

                // 材料と分量のマッチングを試みる
                this.extractLinesAsIngredients(ingredientLines, ingredients);
            } else {
                // 従来の処理（材料キーワードが見つからない場合）
                const lines = materialsText.split(/\n|<br>/).map(line => line.trim()).filter(line => line.length > 0);

                for (const line of lines) {
                    if (line.length > 2 && line.length < 50 && !line.includes('材料') && !line.includes('つくり方')) {
                        // 材料名と分量を分ける試み
                        const parts = line.split(/[：:]|\s{2,}/);
                        if (parts.length > 1) {
                            ingredients.push({
                                name: parts[0].trim(),
                                quantity: parts.slice(1).join(' ').trim()
                            });
                        } else {
                            ingredients.push({ name: line });
                        }
                    }
                }
            }
        }
    }

    /**
     * 行文字列から材料情報を抽出
     */
    private extractLinesAsIngredients(
        lines: string[],
        ingredients: { name: string; quantity?: string; unit?: string; group?: string; }[]
    ): void {
        for (const line of lines) {
            if (line.length > 2 && line.length < 50) {
                // 材料名と分量を分ける試み
                const parts = line.split(/[：:]|\s{2,}/);
                if (parts.length > 1) {
                    ingredients.push({
                        name: parts[0].trim(),
                        quantity: parts.slice(1).join(' ').trim()
                    });
                } else if (!line.match(/^(大さじ|小さじ|カップ|\d+|g|適量|少々)$/)) {
                    ingredients.push({ name: line });
                }
            }
        }
    }

    /**
     * 抽出した材料リストをクリーニング
     */
    private cleanIngredients(
        ingredients: { name: string; quantity?: string; unit?: string; group?: string; }[]
    ): { name: string; quantity?: string; unit?: string; group?: string; }[] {
        // 不適切な材料の除外
        let cleaned = ingredients.filter(item => {
            // '材料'という名前の要素や、明らかに材料でない要素を除外
            return item.name !== '材料' &&
                item.name !== '2人分' &&
                item.name !== '4人分' &&
                !/^\d+人分$/.test(item.name) &&
                item.name.length > 1;
        });

        // 重複の除去
        const uniqueIngredients: { [key: string]: { name: string; quantity?: string; unit?: string; group?: string; } } = {};
        cleaned.forEach(item => {
            if (!uniqueIngredients[item.name]) {
                uniqueIngredients[item.name] = item;
            }
        });
        cleaned = Object.values(uniqueIngredients);

        // デバッグ情報
        console.log(`クックパッドのレシピ解析: ${cleaned.length}個の材料を検出しました`);
        if (cleaned.length > 0) {
            console.log('検出された材料の例:', cleaned.slice(0, 3));
        }

        return cleaned;
    }

    /**
     * レシピのタイトルを抽出
     */
    extractTitle(document: Document): string {
        // OGPタイトルを優先
        const ogTitle = getMetaContent(document, 'og:title');
        if (ogTitle) return ogTitle;

        // titleタグをチェック
        const titleTag = document.querySelector('title');
        if (titleTag?.textContent) return titleTag.textContent.trim();

        // h1タグをチェック
        const h1 = document.querySelector('h1');
        if (h1?.textContent) return h1.textContent.trim();

        return '無題のレシピ';
    }

    /**
     * レシピの画像URLを抽出
     */
    extractImage(document: Document): string | undefined {
        return getMetaContent(document, 'og:image');
    }
} 