import { RecipeParser, getMetaContent } from './parser-interface';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';

export class CookpadParser implements RecipeParser {
    /**
     * クックパッドのレシピから材料情報を抽出する
     */
    extractIngredients(document: Document): FoodInputParseResult[] {
        const ingredients: FoodInputParseResult[] = [];
        const ingredientSections = document.querySelectorAll('.ingredient_group');

        if (ingredientSections.length > 0) {
            // 材料グループがある場合 (.ingredient_group)
            ingredientSections.forEach((section) => {
                const groupNameElement = section.querySelector('.ingredient_group_name');
                // 現在は使用していないが、将来的にグループ情報を活用する可能性があるため保持
                // 未使用であることを示す命名規則（アンダースコア）を使用
                // 将来使用する際にコードで活用できるよう、コメントで残す
                // const groupName = groupNameElement?.textContent?.trim() || undefined;

                const items = section.querySelectorAll('.ingredient');
                items.forEach((item) => {
                    const nameElement = item.querySelector('.ingredient_name .name');
                    const quantityElement = item.querySelector('.ingredient_quantity');

                    if (nameElement) { // nameElement の存在チェック
                        const name = nameElement.textContent?.trim();
                        const quantity = quantityElement?.textContent?.trim() || null; // null にフォールバック

                        if (name) { // 名前がある場合のみ追加
                            ingredients.push({
                                foodName: name,
                                quantityText: quantity,
                                confidence: 0.9
                            });
                        }
                    }
                });
            });
        } else {
            // 材料グループがない場合 (#ingredients_list .ingredient)
            const ingredientList = document.querySelector('#ingredients_list');
            if (ingredientList) {
                const items = ingredientList.querySelectorAll('.ingredient');
                items.forEach((item) => {
                    const nameElement = item.querySelector('.ingredient_name');
                    const quantityElement = item.querySelector('.ingredient_quantity');

                    if (nameElement) { // nameElement の存在チェック
                        const name = nameElement.textContent?.trim();
                        const quantity = quantityElement?.textContent?.trim() || null; // null にフォールバック

                        if (name) { // 名前がある場合のみ追加
                            ingredients.push({
                                foodName: name,
                                quantityText: quantity,
                                confidence: 0.9
                            });
                        }
                    }
                });
            }
        }

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
    }

    /**
     * テーブルから材料を抽出
     */
    private extractIngredientsFromTables(
        document: Document,
        ingredients: FoodInputParseResult[]
    ): void {
        console.log('リスト要素から材料が見つからないため、テーブルを検索します');
        const tables = document.querySelectorAll('table');

        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            if (rows.length >= 3) { // 最低3行ある表は材料テーブルの可能性が高い
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2 && cells[0]?.textContent && cells[1]?.textContent) {
                        const name = cells[0].textContent.trim() || '';
                        const quantity = cells[1].textContent.trim() || null;

                        if (name && name.length > 0 && name.length < 50) {
                            ingredients.push({
                                foodName: name,
                                quantityText: quantity,
                                confidence: 0.8
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
        ingredients: FoodInputParseResult[]
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
                        if (parts.length > 1 && parts[0]) {
                            ingredients.push({
                                foodName: parts[0].trim() || '',
                                quantityText: parts.slice(1).join(' ').trim() || null,
                                confidence: 0.7
                            });
                        } else {
                            ingredients.push({
                                foodName: line,
                                quantityText: null,
                                confidence: 0.6
                            });
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
        ingredients: FoodInputParseResult[]
    ): void {
        for (const line of lines) {
            if (line.length > 2 && line.length < 50) {
                // 材料名と分量を分ける試み
                const parts = line.split(/[：:]|\s{2,}/);
                if (parts.length > 1 && parts[0]) {
                    ingredients.push({
                        foodName: parts[0].trim() || '',
                        quantityText: parts.slice(1).join(' ').trim() || null,
                        confidence: 0.7
                    });
                } else if (!line.match(/^(大さじ|小さじ|カップ|\d+|g|ml|cc|適量|少々|手順|作り方|ポイント)/) && line.length < 30) {
                    ingredients.push({
                        foodName: line,
                        quantityText: null,
                        confidence: 0.6
                    });
                }
            }
        }
    }

    /**
     * 抽出した材料リストをクリーニング
     */
    private cleanIngredients(
        ingredients: FoodInputParseResult[]
    ): FoodInputParseResult[] {
        // 不適切な材料の除外
        let cleaned = ingredients.filter(item => {
            const name = item.foodName.toLowerCase();
            return !name.includes('作り方') && !name.includes('手順') && !name.includes('ポイント') && name.length < 50;
        });

        // 重複の除去
        const uniqueIngredients: { [key: string]: FoodInputParseResult } = {};
        cleaned.forEach(item => {
            if (!uniqueIngredients[item.foodName]) {
                uniqueIngredients[item.foodName] = item;
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

    // 他のヘルパーメソッド（例: normalizeQuantity）は変更なし

    // 例外処理を更新
    private handleError(error: unknown, context: string): never {
        console.error(`Cookpad Parser Error (${context}):`, error);
        const message = `クックパッドのレシピ解析中にエラーが発生しました (${context})`;
        throw new AppError({ // AppError の呼び出し形式を修正
            code: ErrorCode.Base.DATA_PROCESSING_ERROR, // 適切なエラーコードに変更
            message: message,
            originalError: error instanceof Error ? error : new Error(String(error))
        });
    }
} 