import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RecipeUrlClipRequest, RecipeUrlClipResponse } from '@/types/recipe';

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

        // URLのプラットフォーム判定
        let platform = '';
        let contentId = '';

        if (url.includes('instagram.com')) {
            platform = 'instagram';
            // Instagram IDの抽出
            const match = url.match(/instagram\.com\/(?:p|reel)\/([^\/\?]+)/);
            contentId = match ? match[1] : '';
        } else if (url.includes('tiktok.com')) {
            platform = 'tiktok';
            // TikTok IDの抽出
            const match = url.match(/tiktok\.com\/@[^\/]+\/video\/(\d+)/);
            contentId = match ? match[1] : '';
        } else {
            return NextResponse.json(
                { error: 'サポートされていないURLです。InstagramまたはTikTokのURLを入力してください。' },
                { status: 400 }
            );
        }

        if (!contentId) {
            return NextResponse.json(
                { error: 'URLからコンテンツIDを抽出できませんでした。正しいInstagramまたはTikTokの投稿URLを入力してください。' },
                { status: 400 }
            );
        }

        // OGPデータの取得
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `URLからのデータ取得に失敗しました (${response.status})` },
                { status: 400 }
            );
        }

        const html = await response.text();

        // 簡易HTMLパーサー関数
        const getMetaContent = (name: string) => {
            const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']|<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, 'i');
            const match = html.match(regex);
            return match ? match[1] || match[2] : null;
        };

        // メタデータ取得
        const title = getMetaContent('og:title') ||
            getMetaContent('twitter:title') ||
            `${platform === 'instagram' ? 'Instagram' : 'TikTok'}のレシピ`;

        const imageUrl = getMetaContent('og:image') ||
            getMetaContent('twitter:image');

        const description = getMetaContent('og:description') ||
            getMetaContent('twitter:description') ||
            '';

        // 警告食材チェック（空の配列として初期化）
        const matchedCautionFoods: string[] = [];
        let highestCautionLevel: 'low' | 'medium' | 'high' | undefined = undefined;

        return NextResponse.json({
            title,
            image_url: imageUrl,
            source_url: url,
            source_platform: platform === 'instagram' ? 'Instagram' : 'TikTok',
            content_id: contentId,
            ingredients: [], // 手動入力用の空配列
            nutrition_per_serving: {
                calories: 0,
                protein: 0,
                iron: 0,
                folic_acid: 0,
                calcium: 0,
                vitamin_d: 0
            }, // 初期値
            is_social_media: true,
            caution_foods: matchedCautionFoods,
            caution_level: highestCautionLevel,
            description
        } as RecipeUrlClipResponse);
    } catch (error: any) {
        console.error('Social URL parsing error:', error);
        return NextResponse.json(
            { error: `URLの解析中にエラーが発生しました: ${error.message || '不明なエラー'}` },
            { status: 500 }
        );
    }
} 