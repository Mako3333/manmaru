import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RecipeUrlClipRequest, RecipeUrlClipResponse } from '@/types/recipe';
import { JSDOM } from 'jsdom';
import { AIService } from '@/lib/ai/ai-service';
import { getRecipeParser, getSourcePlatformName } from '@/lib/recipe-parsers/parser-factory';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';

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

            // URLに基づいて適切なパーサーを取得
            const parser = getRecipeParser(url);

            // レシピ情報を抽出
            const ingredients = parser.extractIngredients(document);
            const title = parser.extractTitle(document);
            const imageUrl = parser.extractImage(document);
            const sourcePlatform = getSourcePlatformName(url);

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

            // ApiErrorの場合は専用の処理
            if (fetchError instanceof ApiError) {
                return NextResponse.json(
                    { error: fetchError.userMessage, details: fetchError.details },
                    { status: fetchError.statusCode }
                );
            }

            // サイト別のエラーメッセージ
            try {
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
            } catch (e) {
                // URL解析自体に失敗した場合（不正なURLなど）
                return NextResponse.json(
                    { error: `URLの解析に失敗しました: ${fetchError.message}` },
                    { status: 400 }
                );
            }
        }
    } catch (error: any) {
        console.error('Recipe URL parsing error:', error);

        // ApiErrorの場合は専用の処理
        if (error instanceof ApiError) {
            return NextResponse.json(
                { error: error.userMessage, details: error.details },
                { status: error.statusCode }
            );
        }

        return NextResponse.json(
            { error: `レシピの解析中にエラーが発生しました: ${error.message || '不明なエラー'}` },
            { status: 500 }
        );
    }
} 