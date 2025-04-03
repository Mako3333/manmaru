import { RecipeParser, getMetaContent } from './parser-interface';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';

export class GenericParser implements RecipeParser {
    /**
     * 汎用パーサー: 様々なレシピサイトから材料情報を抽出する
     */
    extractIngredients(document: Document): FoodInputParseResult[] {
        const ingredients: FoodInputParseResult[] = [];

        try {
            console.log('汎用パーサーでレシピを解析中...');

            // 1. 構造化データから抽出を試みる（最も信頼性が高い）
            this.extractFromStructuredData(document, ingredients);

            // 2. 材料らしき要素を探す
            if (ingredients.length === 0) {
                this.extractFromPotentialLists(document, ingredients);
            }

            // 3. テーブルから抽出を試みる
            if (ingredients.length === 0) {
                this.extractIngredientsFromTables(document, ingredients);
            }

            // 4. ページ内のテキストからAIで推測
            if (ingredients.length === 0) {
                this.extractFromBodyText(document, ingredients);
            }

            // JavaScriptコードや長すぎるテキストを除外する最終的なフィルタリング
            const filteredIngredients = ingredients.filter(ing => {
                const name = ing.foodName || '';
                return !name.includes('function(') &&
                    !name.includes('script') &&
                    !name.includes('var ') &&
                    !name.includes('window.') &&
                    name.length < 100;
            });

            // デバッグ情報
            console.log(`汎用パーサーでのレシピ解析: ${filteredIngredients.length}個の材料を検出しました`);
            if (filteredIngredients.length > 0) {
                console.log('検出された材料の例:', filteredIngredients.slice(0, 3));
            }

            return filteredIngredients;
        } catch (error) {
            console.error('汎用パーサー材料抽出エラー:', error);
            throw new AppError({
                code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                message: `レシピの解析でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: 'レシピの解析に失敗しました。別のレシピURLを試してください。',
                originalError: error instanceof Error ? error : new Error(String(error))
            });
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

                    // Recipe構造化データを探す（配列の場合もある）
                    const recipeData = Array.isArray(data)
                        ? data.find(item => item['@type'] === 'Recipe')
                        : data['@type'] === 'Recipe' ? data : null;

                    if (recipeData && Array.isArray(recipeData.recipeIngredient)) {
                        for (const ingredient of recipeData.recipeIngredient) {
                            if (typeof ingredient === 'string') {
                                // 「材料名：分量」または「材料名 分量」形式を分割
                                const parts = ingredient.split(/：|:|\s{2,}/);
                                if (parts.length > 1 && parts[0]) {
                                    ingredients.push({
                                        foodName: parts[0].trim() || '',
                                        quantityText: parts.slice(1).join(' ').trim() || null,
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
     * 材料らしき要素を探す
     */
    private extractFromPotentialLists(
        document: Document,
        ingredients: FoodInputParseResult[]
    ): void {
        // 材料らしい要素を探す条件
        const potentialClasses = [
            'ingredient', 'ingredients', 'recipe-ingredient', 'material',
            'recipe-materials', 'food-list', 'recipe-ingredients', 'zairyou'
        ];

        // クラス名で探す
        for (const className of potentialClasses) {
            const elements = document.querySelectorAll(`[class*="${className}"] li, .${className}`);
            if (elements.length >= 3) {
                // 材料リストの可能性が高い要素を見つけた
                for (const element of elements) {
                    const text = element.textContent?.trim();
                    if (text && text.length > 0 && text.length < 100) {
                        // 「材料名：分量」または「材料名 分量」形式を分割
                        const parts = text.split(/：|:|\s{2,}/);
                        if (parts.length > 1 && parts[0]) {
                            ingredients.push({
                                foodName: parts[0].trim() || '',
                                quantityText: parts.slice(1).join(' ').trim() || null,
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
                if (ingredients.length > 0) break;
            }
        }

        // クラスで見つからない場合、一般的なリストを探す
        if (ingredients.length === 0) {
            const potentialIngredientLists = document.querySelectorAll('ul, ol');

            for (const list of potentialIngredientLists) {
                const listItems = list.querySelectorAll('li');
                if (listItems.length >= 3) { // 最低3つ以上のアイテムがある場合、材料リストの可能性が高い
                    for (const item of listItems) {
                        const text = item.textContent?.trim();
                        if (text && !text.includes('function(') && !text.includes('script') && text.length < 100) {
                            // 「材料名：分量」または「材料名 分量」形式を分割
                            const parts = text.split(/：|:|\s{2,}/);
                            if (parts.length > 1 && parts[0]) {
                                ingredients.push({
                                    foodName: parts[0].trim() || '',
                                    quantityText: parts.slice(1).join(' ').trim() || null,
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
                    if (ingredients.length > 0) break; // 一つのリストを処理したら抜ける
                }
            }
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
     * ページ内のテキストから材料を抽出
     */
    private extractFromBodyText(
        document: Document,
        ingredients: FoodInputParseResult[]
    ): void {
        const bodyText = document.body.textContent || '';

        // シンプルなヒューリスティック
        // 「材料」という単語の後ろに続く内容を抽出
        const materialsSection = bodyText.match(/材料[\s\S]*?(?=作り方|手順|レシピ|$)/i);

        if (materialsSection && materialsSection[0]) {
            const lines = materialsSection[0].split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.match(/^材料$|^材料一覧$|^材料（.*$/));

            for (const line of lines) {
                if (line.length > 1 && line.length < 30) { // 妥当な長さの行のみ
                    // 「材料名：分量」または「材料名 分量」形式を分割
                    const parts = line.split(/：|:|\s+/);
                    if (parts.length > 1 && parts[0]) {
                        ingredients.push({
                            foodName: parts[0].trim() || '',
                            quantityText: parts.slice(1).join(' ').trim() || null,
                            confidence: 0.8
                        });
                    } else {
                        ingredients.push({
                            foodName: line,
                            quantityText: null,
                            confidence: 0.7
                        });
                    }
                }
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
        const h1 = document.querySelector('h1');
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

        // よく使われる画像セレクタを試す
        const potentialSelectors = [
            '.recipe-image img',
            '.recipe-main-image img',
            '.main-image img',
            '.hero-image img',
            '.thumbnail img',
            '.recipe-thumb img',
            '.recipe-photo img',
            'article img',
            '.content img',
            'main img'
        ];

        for (const selector of potentialSelectors) {
            const img = document.querySelector(selector);
            const src = img?.getAttribute('src');
            if (src) return src;
        }

        return undefined;
    }
} 