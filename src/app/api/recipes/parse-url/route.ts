import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RecipeUrlClipRequest, RecipeUrlClipResponse } from '@/types/recipe';
import { JSDOM } from 'jsdom';
import { AIService } from '@/lib/ai/ai-service';

// AIサービスのインスタンス化
const aiService = AIService.getInstance();

export async function POST(req: Request) {
    try {
        // ユーザー認証確認
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            );
        }

        // リクエストボディからURLを取得
        const { url } = await req.json() as RecipeUrlClipRequest;

        if (!url) {
            return NextResponse.json(
                { error: 'URLを指定してください' },
                { status: 400 }
            );
        }

        // URLからHTMLを取得
        try {
            const htmlResponse = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            });

            if (!htmlResponse.ok) {
                return NextResponse.json(
                    { error: `URLからのデータ取得に失敗しました (${htmlResponse.status})` },
                    { status: 400 }
                );
            }

            const html = await htmlResponse.text();
            const dom = new JSDOM(html);
            const document = dom.window.document;

            // メタデータ取得
            const title = getMetaContent(document, 'og:title') ||
                document.querySelector('title')?.textContent ||
                '無題のレシピ';

            const imageUrl = getMetaContent(document, 'og:image');

            // サイト名判別
            const hostname = new URL(url).hostname;
            let sourcePlatform = '';

            if (hostname.includes('cookpad.com')) {
                sourcePlatform = 'クックパッド';
            } else if (hostname.includes('delishkitchen.tv')) {
                sourcePlatform = 'デリッシュキッチン';
            } else if (hostname.includes('kurashiru.com')) {
                sourcePlatform = 'クラシル';
            } else if (hostname.includes('shirogoghan.com') || hostname.includes('shirogohan.com')) {
                sourcePlatform = '白ごはん.com';
            } else {
                sourcePlatform = hostname.replace('www.', '');
            }

            // 材料情報抽出（サイトごとに異なる可能性がある）
            let ingredients = extractIngredients(document, hostname);

            // 材料が見つからなかった場合のエラーハンドリング
            if (ingredients.length === 0) {
                return NextResponse.json(
                    { error: `レシピの材料が見つかりませんでした。このサイト(${sourcePlatform})はまだ対応していない可能性があります。` },
                    { status: 400 }
                );
            }

            // 栄養情報の計算
            const nutritionResult = await aiService.analyzeTextInput(
                ingredients.map(ing => ({
                    name: ing.name,
                    amount: ing.quantity || '1人前'
                }))
            );

            // 注意食材チェック
            const { data: cautionFoods } = await supabase
                .from('caution_foods')
                .select('food_name, caution_level')
                .order('caution_level', { ascending: false });

            // 材料と注意食材のマッチング
            const matchedCautionFoods: string[] = [];
            let highestCautionLevel: 'low' | 'medium' | 'high' | undefined = undefined;

            if (cautionFoods) {
                for (const ingredient of ingredients) {
                    for (const cautionFood of cautionFoods) {
                        if (ingredient.name.includes(cautionFood.food_name)) {
                            matchedCautionFoods.push(cautionFood.food_name);

                            // 最も高い注意レベルを記録
                            if (cautionFood.caution_level === 'high') {
                                highestCautionLevel = 'high';
                            } else if (cautionFood.caution_level === 'medium' && highestCautionLevel !== 'high') {
                                highestCautionLevel = 'medium';
                            } else if (cautionFood.caution_level === 'low' && !highestCautionLevel) {
                                highestCautionLevel = 'low';
                            }
                        }
                    }
                }
            }

            // レスポンスデータ構築
            const response: RecipeUrlClipResponse = {
                title,
                image_url: imageUrl,
                source_url: url,
                source_platform: sourcePlatform,
                ingredients,
                nutrition_per_serving: nutritionResult.nutrition,
                caution_foods: matchedCautionFoods,
                caution_level: highestCautionLevel,
            };

            return NextResponse.json(response);
        } catch (fetchError: any) {
            console.error('URL取得エラー:', fetchError);

            // サイト別のエラーメッセージ
            const fetchErrorHostname = new URL(url).hostname;
            let errorMessage = `URLからのデータ取得中にエラーが発生しました: ${fetchError.message}`;

            if (fetchErrorHostname.includes('cookpad.com')) {
                errorMessage = `クックパッドのレシピ解析でエラーが発生しました: ${fetchError.message}。サイトの仕様が変更された可能性があります。他のレシピURLを試すか、しばらく時間をおいてからお試しください。`;
            } else if (fetchErrorHostname.includes('delishkitchen.tv')) {
                errorMessage = `デリッシュキッチンのレシピ取得に失敗しました。サイトの仕様が変更された可能性があります。他のレシピURLを試すか、別のサイト（クックパッドなど）をお試しください。詳細: ${fetchError.message}`;
            } else if (fetchErrorHostname.includes('shirogoghan.com') || fetchErrorHostname.includes('shirogohan.com')) {
                errorMessage = `白ごはん.comのレシピ取得に失敗しました。サイトの仕様が変更された可能性があります。他のレシピURLを試すか、別のサイト（クックパッドなど）をお試しください。詳細: ${fetchError.message}`;
            }

            return NextResponse.json(
                { error: errorMessage },
                { status: 400 }
            );
        }
    } catch (error: any) {
        console.error('Recipe URL parsing error:', error);
        return NextResponse.json(
            { error: `レシピの解析中にエラーが発生しました: ${error.message || '不明なエラー'}` },
            { status: 500 }
        );
    }
}

// メタタグからコンテンツを取得
function getMetaContent(document: Document, property: string): string | undefined {
    const metaTag = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
    return metaTag?.getAttribute('content') || undefined;
}

// 材料情報の抽出（サイト別）
function extractIngredients(document: Document, hostname: string): { name: string; quantity?: string; unit?: string; group?: string; }[] {
    let ingredients: { name: string; quantity?: string; unit?: string; group?: string; }[] = [];

    try {
        if (hostname.includes('cookpad.com')) {
            // クックパッド用パーサー - 修正版（2024年5月24日更新）
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

            // 材料が見つからない場合、テーブルを探す
            if (ingredients.length === 0) {
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

            // テキスト全体から材料を抽出する最終手段
            if (ingredients.length === 0) {
                console.log('構造化要素から材料が見つからないため、テキスト全体から抽出を試みます');
                const bodyText = document.body.textContent || '';

                // 「材料」セクションを抽出
                const materialsPattern = /材料(?:\s*[\(（][^）\)]*[\)）])?[\s\n]*?([\s\S]*?)(?:作り方|手順|レシピ|調理|準備|下準備|つくり方)/i;
                const materialsMatch = bodyText.match(materialsPattern);

                if (materialsMatch && materialsMatch[1]) {
                    const materialsText = materialsMatch[1].trim();

                    // 材料の塊が抽出できた場合、それを正しく個別の材料に分解する処理
                    // 「材料 2人分」などの見出し行を除外
                    if (materialsText.includes('にんじん') || materialsText.includes('ごぼう') ||
                        materialsText.includes('玉ねぎ') || materialsText.includes('肉') ||
                        materialsText.includes('じゃがいも')) {

                        // 材料リストの塊を行単位で分解
                        const rawLines = materialsText.split(/\n|<br>/).map(line => line.trim())
                            .filter(line => line.length > 0);

                        // 「材料 2人分」などの見出し行を判定し除外する関数
                        const isHeaderLine = (line: string) => {
                            return line.match(/^材料(\s|$)|^材料一覧|^材料（|^分量|^\d+人分|だし|つゆ/i) !== null;
                        };

                        // 材料名と分量の個別抽出を試みる
                        // まず材料らしき行だけを抽出
                        const ingredientLines = rawLines.filter(line => !isHeaderLine(line));

                        // すでに一塊の材料が抽出されている場合は、それを分解する
                        // @ts-ignore - 長さをチェックした後のアクセスは安全
                        if (ingredients.length === 1) {
                            const [item] = ingredients;
                            if (item.name === '材料' || (item.quantity && item.quantity.includes('にんじん'))) {
                                // 既存の材料をクリア
                                ingredients = [];

                                // 材料と分量のマッチングを試みる
                                const fullText = rawLines.join(' ');

                                // 「材料名 分量」のパターンを検出
                                const ingredientPattern = /([^\s]+)\s+([^　\s][^　\s]*g|大さじ\d+|小さじ\d+|カップ\d*|適量|少々|(?:\d+)[^\s]*本|(?:\d+)[^\s]*個|(?:\d+)[^\s]*片|(?:\d+)[^\s]*枚)/g;
                                let match;

                                while ((match = ingredientPattern.exec(fullText)) !== null) {
                                    const name = match[1].trim();
                                    const quantity = match[2].trim();

                                    // 単位や数字だけの名前、または不適切な名前は除外
                                    if (name.length > 1 && !name.match(/^(大さじ|小さじ|カップ|\d+|適量|少々|本|個|片|枚)$/)) {
                                        ingredients.push({
                                            name: name,
                                            quantity: quantity
                                        });
                                    }
                                }

                                // パターンマッチで十分な材料が抽出できなかった場合、行ごとに処理
                                if (ingredients.length < 3) {
                                    ingredients = []; // リセット

                                    for (const line of ingredientLines) {
                                        if (line.length > 2 && line.length < 50) {
                                            // 材料名と分量を分ける試み
                                            const parts = line.split(/[：:]|\s{2,}/);
                                            if (parts.length > 1) {
                                                ingredients.push({
                                                    name: parts[0].trim(),
                                                    quantity: parts.slice(1).join(' ').trim()
                                                });
                                            } else {
                                                // 単一の材料行を個別の材料に分解
                                                const items = line.split(/\s+/).filter(item => item.length > 0);

                                                for (let i = 0; i < items.length; i += 2) {
                                                    if (i + 1 < items.length && !items[i].match(/^(大さじ|小さじ|カップ|\d+|g|適量|少々)$/)) {
                                                        ingredients.push({
                                                            name: items[i],
                                                            quantity: items[i + 1]
                                                        });
                                                    } else if (!items[i].match(/^(大さじ|小さじ|カップ|\d+|g|適量|少々)$/)) {
                                                        ingredients.push({ name: items[i] });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            // 通常の処理 - 各行を材料として処理
                            for (const line of ingredientLines) {
                                if (line.length > 2 && line.length < 50 && !isHeaderLine(line)) {
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

            // 不適切な材料の除外
            ingredients = ingredients.filter(item => {
                // '材料'という名前の要素や、明らかに材料でない要素を除外
                return item.name !== '材料' &&
                    item.name !== '2人分' &&
                    item.name !== '4人分' &&
                    !/^\d+人分$/.test(item.name) &&
                    item.name.length > 1;
            });

            // 重複の除去
            const uniqueIngredients: { [key: string]: { name: string; quantity?: string; unit?: string; group?: string; } } = {};
            ingredients.forEach(item => {
                if (!uniqueIngredients[item.name]) {
                    uniqueIngredients[item.name] = item;
                }
            });
            ingredients = Object.values(uniqueIngredients);

            // デバッグ情報
            console.log(`クックパッドのレシピ解析: ${ingredients.length}個の材料を検出しました`);
            if (ingredients.length > 0) {
                console.log('検出された材料の例:', ingredients.slice(0, 3));
            }
        } else if (hostname.includes('delishkitchen.tv')) {
            // デリッシュキッチン用パーサー - 修正版
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

            // デバッグ情報
            console.log(`デリッシュキッチンのレシピ解析: ${ingredients.length}個の材料を検出しました`);
            if (ingredients.length > 0) {
                console.log('検出された材料の例:', ingredients.slice(0, 3));
            }
        } else if (hostname.includes('kurashiru.com')) {
            // クラシル用パーサー
            const ingredientElements = document.querySelectorAll('.ingredient-list__item');
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
        } else if (hostname.includes('shirogoghan.com') || hostname.includes('shirogohan.com')) {
            // 白ごはん.com用パーサー
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
                            if (parts.length > 1) {
                                ingredients.push({
                                    name: parts[0].trim(),
                                    quantity: parts[1].trim()
                                });
                            } else {
                                // スペースで分割を試みる
                                const spaceParts = text.split(/\s{2,}|\t/);
                                if (spaceParts.length > 1) {
                                    ingredients.push({
                                        name: spaceParts[0].trim(),
                                        quantity: spaceParts[1].trim()
                                    });
                                } else {
                                    ingredients.push({ name: text });
                                }
                            }
                        }
                    }
                }
            }

            // 材料が見つからない場合、テーブルを探す
            if (ingredients.length === 0) {
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
        } else {
            // 汎用パーサー
            // 材料らしき要素を探す
            const potentialIngredientLists = document.querySelectorAll('ul, ol');

            for (const list of potentialIngredientLists) {
                const listItems = list.querySelectorAll('li');
                if (listItems.length >= 3) { // 最低3つ以上のアイテムがある場合、材料リストの可能性が高い
                    for (const item of listItems) {
                        const text = item.textContent?.trim();
                        if (text && !text.includes('function(') && !text.includes('script') && text.length < 100) {
                            // 「材料名：分量」または「材料名 分量」形式を分割
                            const parts = text.split(/：|:|\s+/);
                            if (parts.length > 1) {
                                ingredients.push({
                                    name: parts[0].trim(),
                                    quantity: parts.slice(1).join(' ').trim()
                                });
                            } else {
                                ingredients.push({ name: text });
                            }
                        }
                    }
                    if (ingredients.length > 0) break; // 一つのリストを処理したら抜ける
                }
            }

            // 材料が見つからない場合、ページ内のテキストからAIで推測
            if (ingredients.length === 0) {
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

        // JavaScriptコードや長すぎるテキストを除外する最終的なフィルタリング
        return ingredients.filter(ing => {
            const name = ing.name || '';
            return !name.includes('function(') &&
                !name.includes('script') &&
                !name.includes('var ') &&
                !name.includes('window.') &&
                name.length < 100;
        });
    } catch (error) {
        console.error(`材料抽出エラー(${hostname}):`, error);
        return [];
    }
} 