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
        const htmlResponse = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });

        if (!htmlResponse.ok) {
            return NextResponse.json(
                { error: 'URLからのデータ取得に失敗しました' },
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
        } else {
            sourcePlatform = hostname.replace('www.', '');
        }

        // 材料情報抽出（サイトごとに異なる可能性がある）
        let ingredients = extractIngredients(document, hostname);

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

    } catch (error) {
        console.error('Recipe URL parsing error:', error);
        return NextResponse.json(
            { error: 'レシピの解析中にエラーが発生しました' },
            { status: 500 }
        );
    }
}

// メタタグからコンテンツ取得
function getMetaContent(document: Document, property: string): string | undefined {
    const meta = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
    const content = meta?.getAttribute('content');
    return content ?? undefined;
}

// 材料情報の抽出（サイト別）
function extractIngredients(document: Document, hostname: string): { name: string; quantity?: string; unit?: string; }[] {
    const ingredients: { name: string; quantity?: string; unit?: string; }[] = [];

    if (hostname.includes('cookpad.com')) {
        // クックパッド用パーサー
        const ingredientElements = document.querySelectorAll('.ingredient_row');
        ingredientElements.forEach(element => {
            const nameElement = element.querySelector('.ingredient_name');
            const quantityElement = element.querySelector('.ingredient_quantity');

            if (nameElement) {
                ingredients.push({
                    name: nameElement.textContent?.trim() || '',
                    quantity: quantityElement?.textContent?.trim()
                });
            }
        });
    } else if (hostname.includes('delishkitchen.tv')) {
        // デリッシュキッチン用パーサー
        const ingredientElements = document.querySelectorAll('.ingredient-list__item');
        ingredientElements.forEach(element => {
            const nameElement = element.querySelector('.ingredient-list__item-name');
            const quantityElement = element.querySelector('.ingredient-list__item-serving');

            if (nameElement) {
                ingredients.push({
                    name: nameElement.textContent?.trim() || '',
                    quantity: quantityElement?.textContent?.trim()
                });
            }
        });
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
    } else {
        // 汎用パーサー
        // 材料らしき要素を探す
        const potentialIngredientLists = document.querySelectorAll('ul, ol');

        for (const list of potentialIngredientLists) {
            const listItems = list.querySelectorAll('li');
            if (listItems.length >= 3) { // 最低3つ以上のアイテムがある場合、材料リストの可能性が高い
                for (const item of listItems) {
                    const text = item.textContent?.trim();
                    if (text) {
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

    return ingredients;
} 