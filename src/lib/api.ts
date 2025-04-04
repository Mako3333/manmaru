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
                image: base64Image,
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

        // 栄養計算を含むv2エンドポイントを使用
        const response = await fetch('/api/v2/meal/text-analyze', {
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
 * @param data API応答データ ({ success: boolean, data?: ..., error?: ... })
 * @returns 検証結果（true: 有効、false: 無効）
 */
const validateApiResponse = (responseData: any): boolean => {
    // responseData は fetch().json() の結果、つまり { success: boolean, data: ..., meta: ... } または { success: false, error: ... } の形式を想定
    if (!responseData || typeof responseData !== 'object') {
        console.error('APIレスポンス自体が不正です');
        return false;
    }

    // 成功応答でなければバリデーション不要（あるいはエラー内容をチェックする？）
    if (responseData.success !== true) {
        console.warn('API応答が成功ではありませんでした。バリデーションスキップ。', responseData);
        // 成功応答のみを厳密にチェックする場合は true を返すか、あるいは false を返すかは設計次第
        return true; // ここでは成功応答のみをチェック対象とする
    }

    const data = responseData?.data; // data フィールドを取得

    if (!data) {
        console.error('APIレスポンスの data フィールドが空です', responseData);
        return false;
    }

    // data.foods 配列 (FoodInputParseResult[]) のチェック
    if (!Array.isArray(data.foods)) {
        console.error('data.foods 配列が不正:', data.foods);
        return false;
    }

    for (const food of data.foods) {
        // FoodInputParseResult の形式をチェック
        if (typeof food.foodName !== 'string') { // foodName をチェック
            console.error('foodName が不正:', food);
            return false;
        }
        // quantityText は null の可能性もあるので、存在チェックは必須ではないかも
        if (food.quantityText !== null && typeof food.quantityText !== 'string') {
            console.error('quantityText が不正:', food);
            return false;
        }
        if (typeof food.confidence !== 'number') {
            console.error('food.confidence が不正:', food);
            return false;
        }
        // 英語名チェックは維持
        if (/^[a-zA-Z]/.test(food.foodName)) {
            console.warn('英語の食品名が検出されました:', food.foodName);
        }
    }

    // data.nutritionResult.nutrition (StandardizedMealNutrition) のチェック
    const nutritionResult = data.nutritionResult;
    const nutrition = nutritionResult?.nutrition; // ネストされた nutrition を取得

    if (!nutrition || typeof nutrition !== 'object') {
        console.error('data.nutritionResult.nutrition オブジェクトが不正:', nutritionResult);
        return false;
    }

    // StandardizedMealNutrition の基本的なプロパティをチェック
    if (typeof nutrition.totalCalories !== 'number') {
        console.error('nutrition.totalCalories が不正:', nutrition);
        return false;
    }
    if (!Array.isArray(nutrition.totalNutrients)) {
        console.error('nutrition.totalNutrients 配列が不正:', nutrition);
        return false;
    }
    // 必要であれば totalNutrients の中身もチェック
    // 例: 最初の要素が存在し、期待するプロパティを持つか
    if (nutrition.totalNutrients.length > 0) {
        const firstNutrient = nutrition.totalNutrients[0];
        if (typeof firstNutrient?.name !== 'string' || typeof firstNutrient?.value !== 'number' || typeof firstNutrient?.unit !== 'string') {
            console.error('nutrition.totalNutrients の要素形式が不正:', firstNutrient);
            return false;
        }
    }
    // foodItems 配列の存在チェック (任意)
    if (nutrition.foodItems && !Array.isArray(nutrition.foodItems)) {
        console.error('nutrition.foodItems が配列ではありません:', nutrition);
        return false;
    }


    // 他に必要なチェックがあればここに追加

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