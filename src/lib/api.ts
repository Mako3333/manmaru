import { createClient } from '@supabase/supabase-js';

// APIクライアント関数
export async function getRecipes(userId = 'current-user-id') {
    // サーバーサイドでの実行時はフルURLが必要
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/recommend-recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        cache: 'no-store' // SSRで毎回新しいデータを取得
    });

    if (!response.ok) {
        throw new Error('Failed to fetch recipes');
    }

    return response.json();
}

// ユーザープロファイル取得 - Supabaseを使用する場合は不要
export async function getUserProfile(userId: string) {
    // この関数はクライアントコンポーネント内で直接Supabaseを使用するため、
    // 実際のプロジェクトでは使用しない可能性があります
    return {
        id: userId,
        name: 'ユーザー',
        pregnancy_week: 24,
        due_date: '2024-08-15',
        dietary_restrictions: ['アルコール', '生魚']
    };
}

// 栄養サマリー取得
export async function getNutritionSummary(userId: string) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // 実際のAPIエンドポイントが実装されたら、以下のようにAPIを呼び出します
    // const response = await fetch(`${baseUrl}/api/nutrition-summary`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ userId }),
    //   cache: 'no-store'
    // });
    // 
    // if (!response.ok) {
    //   throw new Error('Failed to fetch nutrition summary');
    // }
    // 
    // return response.json();

    // 現時点ではモックデータを返す
    return {
        deficient_nutrients: ['鉄分', '葉酸', 'カルシウム'],
        sufficient_nutrients: ['タンパク質', 'ビタミンC', '食物繊維'],
        overall_score: 75
    };
}

/**
 * 食事画像を解析するAPI呼び出し
 * @param base64Image Base64エンコードされた画像データ
 * @param mealType 食事タイプ（breakfast, lunch, dinner, snack）
 * @returns 解析結果（食品リストと栄養情報）
 */
export async function analyzeMealPhoto(base64Image: string, mealType: string) {
    try {
        // 画像データのバリデーション
        if (!base64Image) {
            console.error('画像データが空です');
            throw new Error('画像データが含まれていません');
        }

        const response = await fetch('/api/analyze-meal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64Image,
                mealType
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: '不明なエラー' }));
            console.error('APIレスポンスエラー:', errorData);
            throw new Error(errorData.error || '画像の分析に失敗しました');
        }

        return await response.json();
    } catch (error) {
        console.error('画像解析エラー:', error);
        throw error;
    }
}

/**
 * Supabase REST APIへのリクエストを実行する関数
 * @param endpoint エンドポイントパス (例: 'daily_nutrition_logs')
 * @param method HTTPメソッド (GET, POST, PUT, DELETE)
 * @param data リクエストボディ (GETでは不要)
 * @param options 追加オプション
 * @returns レスポンスデータまたはエラー
 */
export async function fetchFromSupabase(
    endpoint: string,
    method: string = 'GET',
    data: any = null,
    options: any = {}
) {
    try {
        // Supabase認証情報取得
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        );
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || !session.access_token) {
            console.error('認証状態が無効です。再ログインが必要です。');
            return { error: '認証エラー' };
        }

        // Supabaseリクエスト用のヘッダ設定
        const headers = {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // ベースURLを取得
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

        // fetchリクエストの実行
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
            method: method,
            headers: headers,
            body: method !== 'GET' ? JSON.stringify(data) : undefined,
            ...options
        });

        const result = await response.json();
        return response.ok ? result : { error: result, status: response.status };

    } catch (error) {
        console.error('Supabase API エラー:', error);
        return { error: (error as Error).message || '不明なエラー' };
    }
} 