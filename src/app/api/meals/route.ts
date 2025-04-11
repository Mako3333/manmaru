import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { MealService, SaveMealRequest } from '@/lib/services/meal-service';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { StandardizedMealNutrition } from '@/types/nutrition';
import { withErrorHandling } from '@/lib/api/middleware';
import { FoodRepositoryFactory, FoodRepositoryType } from '@/lib/food/food-repository-factory';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';

// ★ 編集された食品アイテムの型定義 (フロントエンドと合わせる)
interface EditedFoodItem {
    name: string;
    quantity: string;
}

/**
 * 食事データを登録するAPI (修正版)
 * POST /api/meals
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
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
                    // No-op for Route Handlers
                },
                remove(name: string, options: CookieOptions) {
                    // No-op for Route Handlers
                },
            },
        }
    );

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        throw new AppError({
            code: ErrorCode.Base.AUTH_ERROR,
            message: 'ログインしていないか、セッションが無効です。',
            userMessage: '認証情報が無効です。再度ログインしてください。'
        });
    }

    const userId = session.user.id;
    const requestData = await req.json();

    if (!requestData || typeof requestData !== 'object') {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: '無効なリクエストデータです。'
        });
    }

    // --- ★ 栄養計算ロジックの追加 ---
    let calculatedNutrition: StandardizedMealNutrition | undefined = undefined;

    // 1. リクエストから編集後の食品リストを取得・検証
    const editedItems = requestData.editedFoodItems; // フロントエンドからのキー名に合わせる
    if (!Array.isArray(editedItems) || editedItems.length === 0 || !editedItems.every(item =>
        typeof item === 'object' && item !== null &&
        typeof item.name === 'string' && item.name.trim() !== '' &&
        typeof item.quantity === 'string' // quantity は空でも許容する場合あり
    )) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: 'リクエストに有効な editedFoodItems が含まれていません。',
            userMessage: '編集された食品リストの形式が正しくありません。',
            details: { receivedItems: editedItems }
        });
    }

    // 2. NutritionService の初期化
    try {
        const foodRepo = FoodRepositoryFactory.getRepository(FoodRepositoryType.BASIC);
        const nutritionService = NutritionServiceFactory.getInstance().createService(foodRepo);

        // 3. 栄養計算の実行
        const nameQuantityPairs = editedItems.map((item: EditedFoodItem) => ({
            name: item.name,
            // quantity が存在する場合のみ quantity プロパティを追加
            ...(item.quantity ? { quantity: item.quantity } : {})
        }));
        const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(nameQuantityPairs);
        calculatedNutrition = nutritionResult.nutrition;

    } catch (error) {
        console.error('POST /api/meals: 栄養計算中にエラー:', error);
        // AppError でラップして再スロー
        if (error instanceof AppError) throw error;
        // エラーコードを修正 (CALCULATION_ERROR -> DATA_PROCESSING_ERROR)
        throw new AppError({
            code: ErrorCode.Base.DATA_PROCESSING_ERROR,
            message: `栄養計算中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
            userMessage: '栄養情報の計算処理で問題が発生しました。',
            originalError: error instanceof Error ? error : undefined
        });
    }
    // --- ★ 栄養計算ロジックここまで ---

    // 4. DB保存データの準備 (SaveMealRequest型)
    const dataToSave: SaveMealRequest = {
        user_id: userId,
        meal_type: requestData.meal_type,
        meal_date: requestData.meal_date,
        food_description: requestData.food_description,
        servings: requestData.servings || 1,
        photo_url: requestData.photo_url,
        nutrition_data: calculatedNutrition, // ★ 計算結果をセット
    };

    // 必須フィールドの追加バリデーション
    if (!dataToSave.meal_type || !dataToSave.meal_date) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: 'meal_type と meal_date は必須です。',
        });
    }

    // 5. DB保存
    const result = await MealService.saveMealWithNutrition(
        supabase,
        dataToSave // SaveMealRequest 型のデータを渡す
    );

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