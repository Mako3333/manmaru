import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import RecipesClient from './recipes-client';

// レシピデータの型定義
interface Recipe {
    id: string;
    title: string;
    description: string;
    ingredients: string[];
    instructions: string[];
    image_url?: string;
    nutrition_info?: {
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
    };
}

export default async function RecipesPage() {
    const supabase = createServerComponentClient({ cookies });

    // ユーザー情報を取得
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return <div>ログインが必要です</div>;
    }

    // レシピデータを取得（実際のデータ取得ロジックに置き換えてください）
    // 例: const { data: recipes } = await supabase.from('recipes').select('*');

    // サンプルデータ（実際の実装では削除してください）
    const recipes: Recipe[] = [
        {
            id: '1',
            title: '鉄分たっぷり ほうれん草と豆腐のサラダ',
            description: '妊婦さんに必要な鉄分が豊富なほうれん草を使ったサラダです。',
            ingredients: ['ほうれん草', '豆腐', 'ごま', 'ポン酢'],
            instructions: ['ほうれん草を茹でる', '豆腐を一口大に切る', '材料を混ぜ合わせる', 'ポン酢をかける'],
            image_url: 'https://example.com/spinach-salad.jpg',
            nutrition_info: {
                calories: 180,
                protein: 12,
                fat: 8,
                carbs: 10
            }
        },
        {
            id: '2',
            title: 'カルシウム補給 サーモンとブロッコリーのパスタ',
            description: 'カルシウムが豊富なサーモンとブロッコリーを使ったパスタです。',
            ingredients: ['パスタ', 'サーモン', 'ブロッコリー', 'オリーブオイル', 'にんにく'],
            instructions: ['パスタを茹でる', 'サーモンとブロッコリーを炒める', '茹でたパスタと和える'],
            image_url: 'https://example.com/salmon-pasta.jpg',
            nutrition_info: {
                calories: 450,
                protein: 25,
                fat: 15,
                carbs: 50
            }
        }
    ];

    return <RecipesClient initialData={recipes} />;
} 