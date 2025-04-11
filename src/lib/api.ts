import { createClient } from '@supabase/supabase-js';
import { AppError, ErrorCode } from '@/lib/error';

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
        throw new AppError({
            code: ErrorCode.Base.API_ERROR,
            message: `レシピ取得APIリクエスト失敗: ${response.status}`,
            userMessage: 'レシピの取得に失敗しました。時間をおいて再度お試しください。'
        });
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
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '画像データが空です',
                userMessage: '画像が選択されていません。'
            });
        }

        console.log('APIエンドポイント呼び出し: 新システム使用');
        // 修正: 正しいv2エンドポイントを使用
        const response = await fetch('/api/v2/meal/analyze', {
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
            throw new AppError({
                code: ErrorCode.AI.IMAGE_PROCESSING_ERROR,
                message: errorData.error || '画像の分析に失敗しました',
                userMessage: errorData.userMessage || '画像の分析中にエラーが発生しました。別の画像で試すか、テキスト入力をご利用ください。',
                details: errorData
            });
        }

        const result = await response.json();
        console.log('API結果構造:', Object.keys(result));

        // 結果の検証
        if (!validateApiResponse(result)) {
            throw new AppError({
                code: ErrorCode.Base.API_ERROR,
                message: '画像解析APIの応答形式が不正です',
                userMessage: 'サーバーからの応答形式が正しくありませんでした。',
                details: result
            });
        }

        return result;
    } catch (error) {
        console.error('画像解析エラー:', error instanceof Error ? error.message : String(error));
        // エラーオブジェクトを適切に文字列化して投げる
        if (error instanceof AppError) {
            throw error;
        } else if (error instanceof Error) {
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: error.message,
                userMessage: '画像解析中に予期せぬエラーが発生しました。',
                originalError: error
            });
        } else {
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: String(error),
                userMessage: '画像解析中に予期せぬエラーが発生しました。'
            });
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
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'テキストデータが空です',
                userMessage: 'テキストが入力されていません。'
            });
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
            throw new AppError({
                code: ErrorCode.AI.ANALYSIS_ERROR,
                message: errorData.error || 'テキストの分析に失敗しました',
                userMessage: errorData.userMessage || 'テキストの分析中にエラーが発生しました。',
                details: errorData
            });
        }

        const result = await response.json();
        console.log('テキスト解析API結果構造:', Object.keys(result));

        // 結果の検証
        if (!validateApiResponse(result)) {
            throw new AppError({
                code: ErrorCode.Base.API_ERROR,
                message: 'テキスト解析APIの応答形式が不正です',
                userMessage: 'サーバーからの応答形式が正しくありませんでした。',
                details: result
            });
        }

        return result;
    } catch (error) {
        console.error('テキスト解析エラー:', error instanceof Error ? error.message : String(error));
        if (error instanceof AppError) {
            throw error;
        } else if (error instanceof Error) {
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: error.message,
                userMessage: 'テキスト解析中に予期せぬエラーが発生しました。',
                originalError: error
            });
        } else {
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: String(error),
                userMessage: 'テキスト解析中に予期せぬエラーが発生しました。'
            });
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
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'URLが空です',
                userMessage: 'URLが入力されていません。'
            });
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
            throw new AppError({
                code: ErrorCode.AI.PARSING_ERROR,
                message: errorData.error || 'レシピURLの解析に失敗しました',
                userMessage: errorData.userMessage || 'レシピURLの解析中にエラーが発生しました。',
                details: errorData
            });
        }

        const result = await response.json();
        console.log('レシピURL解析API結果構造:', Object.keys(result));

        return result;
    } catch (error) {
        console.error('レシピURL解析エラー:', error instanceof Error ? error.message : String(error));
        if (error instanceof AppError) {
            throw error;
        } else if (error instanceof Error) {
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: error.message,
                userMessage: 'レシピURL解析中に予期せぬエラーが発生しました。',
                originalError: error
            });
        } else {
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: String(error),
                userMessage: 'レシピURL解析中に予期せぬエラーが発生しました。'
            });
        }
    }
}

/**
 * API応答の構造を検証する
 * @param data API応答データ ({ success: boolean, data?: ..., error?: ... })
 * @returns 検証結果（true: 有効、false: 無効）
 */
const validateApiResponse = (responseData: unknown): boolean => {
    // responseData が object で null でないことを確認
    if (typeof responseData !== 'object' || responseData === null) {
        console.error('APIレスポンス自体が不正です（オブジェクトではありません）');
        return false;
    }

    // 'success' プロパティの存在と型を確認
    if (!('success' in responseData) || typeof (responseData as { success: unknown }).success !== 'boolean') {
        console.error('APIレスポンスに success プロパティが存在しないか、boolean 型ではありません。');
        return false;
    }

    // 成功応答の場合
    if ((responseData as { success: boolean }).success === true) {
        // 'data' プロパティの存在を確認 (必須ではない場合もある)
        // if (!('data' in responseData)) {
        //     console.warn('API成功応答に data プロパティが存在しません。');
        //     // data が必須でない場合は true を返しても良い
        // }
        // ここでは data の存在有無まではチェックしない
        return true;
    }
    // 失敗応答の場合
    else {
        // 'error' プロパティの存在を確認
        if (!('error' in responseData)) {
            console.error('API失敗応答に error プロパティが存在しません。');
            return false;
        }
        // error の内部構造（message など）をチェックすることも可能
        return true; // error プロパティがあれば 일단 OK とする
    }
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
    data: unknown = null,
    options: unknown = {}
) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Supabase URL または Anon Key が未設定です。');
        throw new AppError({
            code: ErrorCode.Base.CONFIG_ERROR,
            message: 'Supabase URL or Anon Key is not configured.',
            userMessage: 'サーバー設定が不完全です。'
        });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // options が object であることを確認
    const fetchOptions: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}` // Supabase推奨ヘッダー
        },
        ...(typeof options === 'object' && options !== null ? options : {}) // スプレッド構文の前に型チェック
    };

    // data が null でなく、GET/HEAD メソッドでない場合に body を設定
    if (data !== null && method !== 'GET' && method !== 'HEAD') {
        try {
            fetchOptions.body = JSON.stringify(data);
        } catch (error) {
            console.error('リクエストデータのJSON文字列化に失敗:', error);
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'リクエストデータの形式が無効です。',
                userMessage: 'リクエストの形式が正しくありません。'
            });
        }
    }

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, fetchOptions);

        if (!response.ok) {
            let errorDetails = { message: 'Supabase APIリクエストエラー' };
            try {
                errorDetails = await response.json();
            } catch (e) {
                console.error('Supabase API エラー応答の解析失敗', e);
            }

            if (!errorDetails.message) {
                throw new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: 'リクエストデータの形式が無効です。',
                    userMessage: 'リクエストの形式が正しくありません。'
                });
            }

            console.error('Supabase API リクエスト失敗:', errorDetails);
            throw new AppError({
                code: ErrorCode.Base.API_ERROR,
                message: errorDetails.message || `Supabase API request failed: ${response.status}`,
                userMessage: 'データの取得または更新に失敗しました。',
                details: errorDetails
            });
        }

        // Content-Type が application/json でない場合や、No Content (204) の場合がある
        const contentType = response.headers.get('content-type');
        if (response.status === 204 || !contentType || !contentType.includes('application/json')) {
            return null; // JSON データがない場合は null を返す
        }

        return await response.json();
    } catch (error) {
        console.error('Supabase API 呼び出しエラー:', error);
        throw new AppError({
            code: ErrorCode.Base.UNKNOWN_ERROR,
            message: error instanceof Error ? error.message : 'Supabase API call failed with an unknown error.',
            userMessage: 'サーバーとの通信中に予期せぬエラーが発生しました。',
            originalError: error instanceof Error ? error : undefined
        });
    }
} 