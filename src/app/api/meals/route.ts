import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { MealService, SaveMealRequest, SaveMealNutritionRequest } from '@/lib/services/meal-service';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';

/**
 * 食事データを登録するAPI
 * POST /api/meals
 */
export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.delete({ name, ...options });
                },
            },
        }
    );

    try {
        // セッション確認
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            return NextResponse.json(
                {
                    error: 'ログインしていないか、セッションが無効です。',
                    code: ErrorCode.Base.AUTH_ERROR
                },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const requestData = await req.json();

        // リクエストデータの基本検証
        if (!requestData || typeof requestData !== 'object') {
            return NextResponse.json(
                {
                    error: '無効なリクエストデータです。',
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR
                },
                { status: 400 }
            );
        }

        // 食事データ構築
        const mealData: SaveMealRequest = {
            user_id: userId,
            meal_type: requestData.meal_type,
            meal_date: requestData.meal_date,
            photo_url: requestData.photo_url,
            food_description: requestData.food_description,
            nutrition_data: requestData.nutrition_data,
            servings: requestData.servings || 1
        };

        // 栄養データの構築（存在する場合）
        let nutritionData: SaveMealNutritionRequest | undefined;
        if (requestData.nutrition) {
            nutritionData = {
                calories: parseFloat(requestData.nutrition.calories || '0'),
                protein: parseFloat(requestData.nutrition.protein || '0'),
                iron: parseFloat(requestData.nutrition.iron || '0'),
                folic_acid: parseFloat(requestData.nutrition.folic_acid || '0'),
                calcium: parseFloat(requestData.nutrition.calcium || '0'),
                vitamin_d: parseFloat(requestData.nutrition.vitamin_d || '0'),
                confidence_score: parseFloat(requestData.nutrition.confidence_score || '0.8')
            };
        }

        // MealServiceを使用して食事データを保存
        const result = await MealService.saveMealWithNutrition(
            supabase,
            mealData,
            nutritionData
        );

        return NextResponse.json(
            {
                message: '食事データが正常に保存されました',
                data: result
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('食事保存エラー:', error);

        // AppErrorの場合はそのメッセージとコードを使用
        if (error instanceof AppError) {
            const statusCode = getStatusCodeFromAppError(error);
            return NextResponse.json(
                {
                    error: error.userMessage || '食事データの保存中にエラーが発生しました。',
                    code: error.code,
                    details: process.env.NODE_ENV === 'development' ? error.details : undefined
                },
                { status: statusCode }
            );
        }

        // その他のエラー
        return NextResponse.json(
            {
                error: '食事データの保存中に予期しないエラーが発生しました。',
                code: ErrorCode.Base.UNKNOWN_ERROR
            },
            { status: 500 }
        );
    }
}

/**
 * 食事データを取得するAPI
 * GET /api/meals?date=YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.delete({ name, ...options });
                },
            },
        }
    );

    try {
        // セッション確認
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            return NextResponse.json(
                {
                    error: 'ログインしていないか、セッションが無効です。',
                    code: ErrorCode.Base.AUTH_ERROR
                },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // URLパラメータから日付を取得
        const url = new URL(req.url);
        const date = url.searchParams.get('date');

        if (!date) {
            return NextResponse.json(
                {
                    error: '日付パラメータ(date)が必要です。',
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR
                },
                { status: 400 }
            );
        }

        // 日付形式の検証
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return NextResponse.json(
                {
                    error: '日付はYYYY-MM-DD形式である必要があります。',
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR
                },
                { status: 400 }
            );
        }

        // 指定日の食事データ取得
        const meals = await MealService.getMealsByDate(supabase, userId, date);

        return NextResponse.json({ data: meals }, { status: 200 });
    } catch (error) {
        console.error('食事データ取得エラー:', error);

        // AppErrorの場合はそのメッセージとコードを使用
        if (error instanceof AppError) {
            const statusCode = getStatusCodeFromAppError(error);
            return NextResponse.json(
                {
                    error: error.userMessage || '食事データの取得中にエラーが発生しました。',
                    code: error.code,
                    details: process.env.NODE_ENV === 'development' ? error.details : undefined
                },
                { status: statusCode }
            );
        }

        // その他のエラー
        return NextResponse.json(
            {
                error: '食事データの取得中に予期しないエラーが発生しました。',
                code: ErrorCode.Base.UNKNOWN_ERROR
            },
            { status: 500 }
        );
    }
}

// ヘルパー関数: エラーコードからステータスコードを取得 (必要なら別ファイルからインポート)
function getStatusCodeFromAppError(error: AppError): number {
    const errorCode = error.code;
    if (errorCode === ErrorCode.Base.AUTH_ERROR) return 401;
    if (errorCode === ErrorCode.Base.DATA_VALIDATION_ERROR) return 400;
    if (errorCode === ErrorCode.Base.DATA_NOT_FOUND) return 404;
    // 必要に応じて他のエラーコードのマッピングを追加
    return 500;
} 