import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { MealService, SaveMealRequest, SaveMealNutritionRequest } from '@/lib/services/meal-service';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { StandardizedMealNutrition, NutritionData } from '@/types/nutrition';
import { convertToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';

// SaveMealRequest の型定義をオーバーライド（nutrition_dataをオプショナルに）
interface UpdatedSaveMealRequest extends Omit<SaveMealRequest, 'nutrition_data'> {
    nutrition_data?: StandardizedMealNutrition; // nutrition_dataをオプショナルに変更
}

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
                standardizedNutritionData = convertToStandardizedNutrition(requestData.nutrition_data as NutritionData);
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
        // mealData に変換後のデータを設定
        // mealData.nutrition_data = standardizedNutritionData; // 直接代入は型エラーの可能性

        // 栄養データの構築（meal_nutrients テーブル用）
        let nutritionDataForMealNutrients: SaveMealNutritionRequest | undefined;
        if (requestData.nutrition) {
            nutritionDataForMealNutrients = {
                calories: parseFloat(requestData.nutrition.calories || '0'),
                protein: parseFloat(requestData.nutrition.protein || '0'),
                iron: parseFloat(requestData.nutrition.iron || '0'),
                folic_acid: parseFloat(requestData.nutrition.folic_acid || '0'),
                calcium: parseFloat(requestData.nutrition.calcium || '0'),
                vitamin_d: parseFloat(requestData.nutrition.vitamin_d || '0'),
                confidence_score: parseFloat(requestData.nutrition.confidence_score || '0.8')
            };
        }

        // SaveMealRequest型に合わせる
        const dataToSave: SaveMealRequest = {
            // mealDataから必須プロパティをコピー
            user_id: mealData.user_id,
            meal_type: mealData.meal_type,
            meal_date: mealData.meal_date,
            // food_description と servings はデフォルト値を設定
            food_description: mealData.food_description ?? '',
            servings: mealData.servings ?? 1,
            // photo_url が存在する場合のみ含める
            ...(mealData.photo_url && { photo_url: mealData.photo_url }),
            // nutrition_data が undefined でない場合のみ含める
            ...(standardizedNutritionData && { nutrition_data: standardizedNutritionData }),
        };

        const result = await MealService.saveMealWithNutrition(
            supabase,
            dataToSave, // SaveMealRequest型に合わせたデータを渡す
            nutritionDataForMealNutrients
        );

        return NextResponse.json(
            {
                message: '食事データが正常に保存されました',
                data: result
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            // AppErrorのstatusCodeプロパティがないため、適切なステータスコードを決定するロジックが必要
            // ここでは例として、認証エラーなら401、バリデーションエラーなら400、それ以外は500とする
            let statusCode = 500;
            if (error.code === ErrorCode.Base.AUTH_ERROR) {
                statusCode = 401;
            } else if (error.code === ErrorCode.Base.DATA_VALIDATION_ERROR) {
                statusCode = 400;
            } else if (error.code === ErrorCode.Base.DATA_PROCESSING_ERROR) {
                statusCode = 500; // または422 (Unprocessable Entity) など
            }

            return NextResponse.json(
                {
                    error: error.userMessage || 'エラーが発生しました。',
                    code: error.code,
                    // 開発環境でのみ詳細を表示するなどの考慮を追加しても良い
                    details: process.env.NODE_ENV === 'development' ? error.details : undefined
                },
                { status: statusCode }
            );
        }

        console.error('POST /api/meals Unhandled Error:', error);
        return NextResponse.json(
            {
                error: '予期せぬエラーが発生しました。',
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