import { RecipeParser, getMetaContent } from './parser-interface';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';

export class ShirogohanParser implements RecipeParser {
    /**
     * 白ごはん.comのレシピから材料情報を抽出する
     */
    extractIngredients(document: Document): FoodInputParseResult[] {
        const ingredients: FoodInputParseResult[] = [];

        try {
            console.log('白ごはん.comのレシピを解析中...');

            // 材料セクションを探す
            const materialSections = document.querySelectorAll('.material-section, .ingredients, .recipe-ingredients');

            if (materialSections.length > 0) {
                // 材料リストを抽出
                for (const section of materialSections) {
                    const items = section.querySelectorAll('li, .ingredient-item');

                    for (const item of items) {
                        const text = item.textContent?.trim();
                        if (text && !text.includes('function(') && !text.includes('script') && text.length < 100) {
                            // JavaScriptコードや長すぎるテキストを除外

                            // 「材料名：分量」形式を分割
                            const parts = text.split(/：|:|…/);
                            if (parts.length > 1 && parts[0]) {
                                ingredients.push({
                                    foodName: parts[0].trim() || '',
                                    quantityText: parts.length > 1 && parts[1] ? parts[1].trim() || null : null,
                                    confidence: 0.9
                                });
                            } else {
                                // スペースで分割を試みる
                                const spaceParts = text.split(/\s{2,}|\t/);
                                if (spaceParts.length > 1 && spaceParts[0]) {
                                    ingredients.push({
                                        foodName: spaceParts[0].trim() || '',
                                        quantityText: spaceParts.length > 1 && spaceParts[1] ? spaceParts[1].trim() || null : null,
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
                        }
                    }
                }
            }

            // 材料が見つからない場合、テーブルを探す
            if (ingredients.length === 0) {
                this.extractIngredientsFromTables(document, ingredients);
            }

            // 材料が見つからない場合、構造化データを探す
            if (ingredients.length === 0) {
                this.extractFromStructuredData(document, ingredients);
            }

            // 材料が見つからない場合、より一般的なセレクタを試す
            if (ingredients.length === 0) {
                const altSelectors = [
                    '.recipe-material li',
                    '.recipe-ingredient li',
                    '.ingredients li',
                    '[class*="material"] li',
                    '[class*="ingredient"] li'
                ];

                for (const selector of altSelectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length >= 3) { // 最低3つある場合のみ材料リストとみなす
                        elements.forEach(element => {
                            const text = element.textContent?.trim();
                            if (text && text.length > 0 && text.length < 100) {
                                // 「材料名：分量」形式を分割
                                const parts = text.split(/：|:|…/);
                                if (parts.length > 1 && parts[0]) {
                                    ingredients.push({
                                        foodName: parts[0].trim() || '',
                                        quantityText: parts.length > 1 && parts[1] ? parts[1].trim() || null : null,
                                        confidence: 0.9
                                    });
                                } else {
                                    // スペースで分割を試みる
                                    const spaceParts = text.split(/\s{2,}|\t/);
                                    if (spaceParts.length > 1 && spaceParts[0]) {
                                        ingredients.push({
                                            foodName: spaceParts[0].trim() || '',
                                            quantityText: spaceParts.length > 1 && spaceParts[1] ? spaceParts[1].trim() || null : null,
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
                            }
                        });
                        if (ingredients.length > 0) break;
                    }
                }
            }

            // デバッグ情報
            console.log(`白ごはん.comのレシピ解析: ${ingredients.length}個の材料を検出しました`);
            if (ingredients.length > 0) {
                console.log('検出された材料の例:', ingredients.slice(0, 3));
            }

            return ingredients;
        } catch (error) {
            console.error('白ごはん.com材料抽出エラー:', error);
            throw new AppError({
                code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                message: `白ごはん.comのレシピ解析でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: '白ごはん.comのレシピ解析に失敗しました。サイトの仕様が変更された可能性があります。',
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
     * 構造化データから材料を抽出
     */
    private extractFromStructuredData(
        document: Document,
        ingredients: FoodInputParseResult[]
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
                                if (parts.length > 1 && parts[0]) {
                                    ingredients.push({
                                        foodName: parts[0].trim() || '',
                                        quantityText: parts.slice(1).join('').trim() || null,
                                        confidence: 0.9
                                    });
                                } else {
                                    ingredients.push({
                                        foodName: ingredient.trim(),
                                        quantityText: null,
                                        confidence: 0.8
                                    });
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
        const h1 = document.querySelector('h1.entry-title, h1.recipe-title');
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
        const mainImage = document.querySelector('.entry-content img, .recipe-image img, .main-image img');
        return mainImage?.getAttribute('src') || undefined;
    }
} 