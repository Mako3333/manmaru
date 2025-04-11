import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { MealService, SaveMealRequest, SaveMealNutritionRequest } from '@/lib/services/meal-service';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { StandardizedMealNutrition, NutritionData } from '@/types/nutrition';
import { convertToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';
import { withErrorHandling } from '@/lib/api/middleware';

// SaveMealRequest の型定義をオーバーライド（nutrition_dataをオプショナルに）
interface UpdatedSaveMealRequest extends Omit<SaveMealRequest, 'nutrition_data'> {
    nutrition_data?: StandardizedMealNutrition; // nutrition_dataをオプショナルに変更
}

/**
 * 食事データを登録するAPI
 * POST /api/meals
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
    const cookieStore = await cookies(); // await を追加して Promise を解決
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    // cookieStore.set({ name, value, ...options }); // 変更前: ガイドライン違反
                    // Route Handler 内の cookieStore は読み取り専用のため no-op にする
                },
                remove(name: string, options: CookieOptions) {
                    // cookieStore.delete({ name, ...options }); // 変更前: ガイドライン違反
                    // Route Handler 内の cookieStore は読み取り専用のため no-op にする
                },
            },
        }
    );

    // セッション確認 (withErrorHandlingでは認証チェックがないため、ハンドラ内で行う)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        throw new AppError({
            code: ErrorCode.Base.AUTH_ERROR,
            message: 'ログインしていないか、セッションが無効です。',
            userMessage: '認証情報が無効です。再度ログインしてください。'
            // ここで 401 を返したいが、ミドルウェアに任せる
        });
    }

    const userId = session.user.id;
    const requestData = await req.json();

    // リクエストデータの基本検証
    if (!requestData || typeof requestData !== 'object') {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: '無効なリクエストデータです。'
        });
    }

    // 食事データ構築 (UpdateSaveMealRequestを使用)
    const mealData: UpdatedSaveMealRequest = {
        user_id: userId,
        meal_type: requestData.meal_type,
        meal_date: requestData.meal_date,
        photo_url: requestData.photo_url,
        food_description: requestData.food_description,
        // nutrition_data は後で設定
        servings: requestData.servings || 1
    };

    // リクエストの nutrition_data (旧形式) を StandardizedMealNutrition に変換
    let standardizedNutritionData: StandardizedMealNutrition | undefined = undefined;
    if (requestData.nutrition_data) {
        try {
            // requestData.nutrition_data がすでに StandardizedMealNutrition 型かをチェック
            if (
                typeof requestData.nutrition_data === 'object' &&
                requestData.nutrition_data !== null &&
                'totalCalories' in requestData.nutrition_data &&
                'totalNutrients' in requestData.nutrition_data &&
                'foodItems' in requestData.nutrition_data
            ) {
                standardizedNutritionData = requestData.nutrition_data as StandardizedMealNutrition;
            } else {
                // 旧形式から変換
                standardizedNutritionData = convertToStandardizedNutrition(requestData.nutrition_data as NutritionData);
            }
        } catch (conversionError) {
            console.error('POST /api/meals: 旧形式の栄養データをStandardizedに変換中にエラー:', conversionError);
            throw new AppError({
                code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                message: 'リクエスト内の栄養データの形式変換に失敗しました',
                originalError: conversionError instanceof Error ? conversionError : undefined,
                details: { requestNutritionData: requestData.nutrition_data }
            });
        }
    }

    // SaveMealRequest型に合わせる
    const dataToSave: SaveMealRequest = {
        user_id: mealData.user_id,
        meal_type: mealData.meal_type,
        meal_date: mealData.meal_date,
        food_description: mealData.food_description ?? '',
        servings: mealData.servings ?? 1,
        ...(mealData.photo_url && { photo_url: mealData.photo_url }),
        ...(standardizedNutritionData && { nutrition_data: standardizedNutritionData }),
    };

    const result = await MealService.saveMealWithNutrition(
        supabase,
        dataToSave
    );

    // 成功レスポンスを返す (try...catch はミドルウェアが行う)
    return NextResponse.json(
        {
            message: '食事データが正常に保存されました',
            data: result
        },
        { status: 201 }
    );
});

/**
 * 食事データを取得するAPI
 * GET /api/meals?date=YYYY-MM-DD
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
    const cookieStore = await cookies(); // await を追加して Promise を解決
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    // cookieStore.set({ name, value, ...options }); // 変更前: ガイドライン違反
                    // Route Handler 内の cookieStore は読み取り専用のため no-op にする
                },
                remove(name: string, options: CookieOptions) {
                    // cookieStore.delete({ name, ...options }); // 変更前: ガイドライン違反
                    // Route Handler 内の cookieStore は読み取り専用のため no-op にする
                },
            },
        }
    );

    // セッション確認 (withErrorHandlingでは認証チェックがないため、ハンドラ内で行う)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        throw new AppError({
            code: ErrorCode.Base.AUTH_ERROR,
            message: 'ログインしていないか、セッションが無効です。',
            userMessage: '認証情報が無効です。再度ログインしてください。'
        });
    }

    const userId = session.user.id;

    // URLパラメータから日付を取得
    const url = new URL(req.url);
    const date = url.searchParams.get('date');

    if (!date) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: '日付パラメータ(date)が必要です。'
        });
    }

    // 日付形式の検証
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: '日付はYYYY-MM-DD形式である必要があります。'
        });
    }

    // 指定日の食事データ取得
    const meals = await MealService.getMealsByDate(supabase, userId, date);

    // 成功レスポンスを返す
    return NextResponse.json({ data: meals }, { status: 200 });
});

/**
 * エラーコードに基づいて適切なHTTPステータスコードを返すヘルパー関数
 * @param error AppErrorインスタンス
 * @returns HTTPステータスコード
 */
// function getStatusCodeFromAppError(error: AppError): number {
//     switch (error.code) {
//         case ErrorCode.Base.AUTH_ERROR:
//             return 401;
//         case ErrorCode.Base.DATA_VALIDATION_ERROR:
//         case ErrorCode.Base.DATA_PROCESSING_ERROR:
//             return 400;
//         case ErrorCode.Base.DATA_NOT_FOUND:
//             return 404;
//         default:
//             return 500;
//     }
// } 