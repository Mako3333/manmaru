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
        console.log('API呼び出し開始: mealType=', mealType);

        // 画像データのバリデーション
        if (!base64Image) {
            console.error('画像データが空です');
            throw new Error('画像データが含まれていません');
        }

        console.log('APIエンドポイント呼び出し: 新システム使用');
        // 新しいv2エンドポイントを使用
        const response = await fetch('/api/v2/image/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageData: base64Image,
                mealType
            }),
        });

        console.log('APIレスポンス受信: ステータス', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: errorText || '不明なエラー' };
            }
            console.error('APIレスポンスエラー:', errorData);
            throw new Error(errorData.error || '画像の分析に失敗しました');
        }

        const result = await response.json();
        console.log('API結果構造:', Object.keys(result));

        // 結果の検証
        if (!validateApiResponse(result)) {
            throw new Error('APIからの応答形式が不正です');
        }

        return result;
    } catch (error) {
        console.error('画像解析エラー:', error instanceof Error ? error.message : String(error));
        // エラーオブジェクトを適切に文字列化して投げる
        if (error instanceof Error) {
            throw error;
        } else {
            throw new Error(String(error));
        }
    }
}

/**
 * テキスト入力を解析するAPI呼び出し
 * @param text 食品テキスト（例: "ご飯 茶碗1杯、味噌汁 1杯"）
 * @returns 解析結果（食品リストと栄養情報）
 */
export async function analyzeTextInput(text: string) {
    try {
        console.log('テキスト解析API呼び出し開始:', text);

        // テキストデータのバリデーション
        if (!text || text.trim() === '') {
            console.error('テキストデータが空です');
            throw new Error('テキストデータが含まれていません');
        }

        // 新しいv2エンドポイントを使用
        const response = await fetch('/api/v2/food/parse', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text.trim()
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: errorText || '不明なエラー' };
            }
            console.error('APIレスポンスエラー:', errorData);
            throw new Error(errorData.error || 'テキストの分析に失敗しました');
        }

        const result = await response.json();
        console.log('テキスト解析API結果構造:', Object.keys(result));

        // 結果の検証
        if (!validateApiResponse(result)) {
            throw new Error('APIからの応答形式が不正です');
        }

        return result;
    } catch (error) {
        console.error('テキスト解析エラー:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error) {
            throw error;
        } else {
            throw new Error(String(error));
        }
    }
}

/**
 * レシピURLを解析するAPI呼び出し
 * @param url レシピのURL
 * @returns 解析結果（レシピ情報と栄養情報）
 */
export async function analyzeRecipeUrl(url: string) {
    try {
        console.log('レシピURL解析API呼び出し開始:', url);

        // URLのバリデーション
        if (!url || url.trim() === '') {
            console.error('URLが空です');
            throw new Error('URLが含まれていません');
        }

        // 新しいv2エンドポイントを使用
        const response = await fetch('/api/v2/recipe/parse', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url.trim()
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: errorText || '不明なエラー' };
            }
            console.error('APIレスポンスエラー:', errorData);
            throw new Error(errorData.error || 'レシピURLの解析に失敗しました');
        }

        const result = await response.json();
        console.log('レシピURL解析API結果構造:', Object.keys(result));

        return result;
    } catch (error) {
        console.error('レシピURL解析エラー:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error) {
            throw error;
        } else {
            throw new Error(String(error));
        }
    }
}

/**
 * API応答の構造を検証する
 * @param data API応答データ
 * @returns 検証結果（true: 有効、false: 無効）
 */
const validateApiResponse = (data: any): boolean => {
    if (!data) {
        console.error('APIレスポンスが空です');
        return false;
    }

    // foods配列のチェック
    if (!Array.isArray(data.foods)) {
        console.error('foods配列が不正:', data.foods);
        return false;
    }

    // 各食品アイテムの構造チェック
    for (const food of data.foods) {
        if (!food.name || typeof food.name !== 'string') {
            console.error('食品名が不正:', food);
            return false;
        }

        if (!food.quantity || typeof food.quantity !== 'string') {
            console.error('食品量が不正:', food);
            return false;
        }

        if (typeof food.confidence !== 'number') {
            console.error('信頼度が不正:', food);
            return false;
        }

        // 英語の食品名をログに記録（エラーにはしない）
        if (/^[a-zA-Z]/.test(food.name)) {
            console.warn('英語の食品名が検出されました:', food.name);
        }
    }

    // nutrition オブジェクトのチェック
    const nutrition = data.nutrition;
    if (!nutrition ||
        typeof nutrition.calories !== 'number' ||
        typeof nutrition.protein !== 'number' ||
        typeof nutrition.iron !== 'number' ||
        typeof nutrition.folic_acid !== 'number' ||
        typeof nutrition.calcium !== 'number' ||
        typeof nutrition.vitamin_d !== 'number') {
        console.error('nutrition構造が不正:', nutrition);
        return false;
    }

    return true;
};

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