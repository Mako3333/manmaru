import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AdviceType } from "@/types/nutrition";
import { z } from 'zod';
import { IAIService } from "@/lib/ai/ai-service.interface";
import { AIServiceFactory } from '@/lib/ai/ai-service-factory';
import { getCurrentSeason, getJapanDate } from '@/lib/date-utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { calculatePregnancyWeek, getTrimesterNumber } from '@/lib/date-utils';
import { NextRequest } from 'next/server';
import { ErrorCode, AppError } from "@/lib/error";
import { createErrorResponse, getHttpStatusCode } from '@/lib/api/response';

// リクエストスキーマ
const RequestSchema = z.object({
    date: z.string().optional(),
    force: z.boolean().optional().default(false),
    detail: z.boolean().optional().default(false)
});

// Supabaseクライアント型定義
type SupabaseClient = any; // 実際の型が利用可能な場合は置き換えてください

// Supabaseクライアント作成関数
async function createClient(): Promise<SupabaseClient> {
    return createRouteHandlerClient({ cookies });
}

// 過去の栄養データを取得する関数（ここに追加）
async function getPastNutritionData(supabase: SupabaseClient, userId: string, days: number = 3) {
    const today = new Date();
    const pastDates = [];

    // 過去n日分の日付を生成
    for (let i = 1; i <= days; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        pastDates.push(format(date, 'yyyy-MM-dd'));
    }

    console.log('過去の栄養データを取得: 対象日付', pastDates);

    // 栄養データを取得
    const { data, error } = await supabase
        .from('nutrition_goal_prog')
        .select('*')
        .eq('user_id', userId)
        .in('meal_date', pastDates)
        .order('meal_date', { ascending: false });

    if (error) {
        console.error('過去の栄養データ取得エラー:', error);
        return [];
    }

    // データがない場合は空配列
    if (!data || data.length === 0) {
        console.log('過去の栄養データが見つかりません');
        return [];
    }

    console.log(`取得した過去の栄養データ: ${data.length}件`);

    // データを整形して返却
    return data.map((record: any) => ({
        date: record.meal_date,
        overallScore: calculateOverallScore(record),
        nutrients: {
            calories: { percentage: record.calories_percent || 0 },
            protein: { percentage: record.protein_percent || 0 },
            iron: { percentage: record.iron_percent || 0 },
            folic_acid: { percentage: record.folic_acid_percent || 0 },
            calcium: { percentage: record.calcium_percent || 0 },
            vitamin_d: { percentage: record.vitamin_d_percent || 0 }
        }
    }));
}
// 総合スコア計算関数
function calculateOverallScore(record: any): number {
    const percentages = [
        record.calories_percent || 0,
        record.protein_percent || 0,
        record.iron_percent || 0,
        record.folic_acid_percent || 0,
        record.calcium_percent || 0,
        record.vitamin_d_percent || 0
    ];

    return Math.round(percentages.reduce((sum, val) => sum + val, 0) / percentages.length);
}
// 栄養アドバイスAPIエンドポイント
export async function GET(request: NextRequest) {
    try {
        const supabaseClient = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            const error = new AppError({ code: ErrorCode.Base.AUTH_ERROR, message: "認証が必要です" });
            return new Response(JSON.stringify(createErrorResponse(error)), { status: getHttpStatusCode(error) });
        }

        // クエリパラメータをパース
        const searchParams = request.nextUrl.searchParams;
        const parsedQuery = RequestSchema.safeParse({
            date: searchParams.get('date') || undefined,
            force: searchParams.get('force') === 'true',
            detail: searchParams.get('detail') === 'true'
        });

        if (!parsedQuery.success) {
            const error = new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: '無効なクエリパラメータです', details: parsedQuery.error.flatten() });
            return new Response(JSON.stringify(createErrorResponse(error)), { status: getHttpStatusCode(error) });
        }

        const { date, force, detail } = parsedQuery.data;
        const targetDate = date || getJapanDate();

        // プロフィール情報を取得
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('due_date')
            .eq('user_id', user.id)
            .maybeSingle();

        // DBエラーチェック
        if (profileError) {
            console.error("プロファイルDBエラー:", profileError);
            const error = new AppError({ code: ErrorCode.Base.API_ERROR, message: 'プロファイル情報の取得中にエラーが発生しました' });
            return new Response(JSON.stringify(createErrorResponse(error)), { status: getHttpStatusCode(error) });
        }

        // プロフィール存在チェック (maybeSingle で null が返る可能性があるため)
        if (!profile) {
            console.error("プロファイルが見つかりません (user_id: ", user.id, ")");
            const error = new AppError({ code: ErrorCode.Base.DATA_NOT_FOUND, message: 'プロフィール情報が見つかりません。設定してください。', details: { redirect: '/profile/edit' } });
            return new Response(JSON.stringify(createErrorResponse(error)), { status: getHttpStatusCode(error) });
        }

        // 最新のアドバイスをDBから取得 (force=false の場合)
        if (!force) {
            const { data: latestAdvice, error: dbError } = await supabaseClient
                .from('daily_nutri_advice')
                .select('*')
                .eq('user_id', user.id)
                .eq('advice_date', targetDate)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (dbError && dbError.code !== 'PGRST116') {
                console.error("DBからのアドバイス取得エラー:", dbError);
                const error = new AppError({ code: ErrorCode.Base.API_ERROR, message: 'アドバイスの取得に失敗しました' });
                return new Response(JSON.stringify(createErrorResponse(error)), { status: getHttpStatusCode(error) });
            }

            if (latestAdvice) {
                return new Response(JSON.stringify({
                    success: true,
                    id: latestAdvice.id,
                    advice_date: latestAdvice.advice_date,
                    advice_type: latestAdvice.advice_type,
                    advice: detail ? {
                        content: latestAdvice.advice_detail || latestAdvice.advice_summary,
                        recommended_foods: latestAdvice.recommended_foods || []
                    } : undefined,
                    advice_detail: detail ? undefined : (latestAdvice.advice_detail || latestAdvice.advice_summary),
                    recommended_foods: detail ? undefined : (latestAdvice.recommended_foods || []),
                    is_read: latestAdvice.is_read,
                    generated_at: latestAdvice.created_at
                }), { status: 200 });
            }
            // DBにアドバイスがない場合はフォールスルーしてAI生成へ
        }

        // ---- AIによるアドバイス生成ロジック (force=true または DBにデータなし) ----

        if (!profile.due_date) {
            const error = new AppError({ code: ErrorCode.Base.DATA_NOT_FOUND, message: '出産予定日が設定されていません', details: { redirect: '/profile/edit' } });
            return new Response(JSON.stringify(createErrorResponse(error)), { status: getHttpStatusCode(error) });
        }

        // 妊娠週数と期を計算
        const pregnancyWeek = calculatePregnancyWeek(profile.due_date);
        const trimester = getTrimesterNumber(pregnancyWeek);

        // DBから対象日の食事データを取得
        const { data: mealLogs, error: mealLogError } = await supabaseClient
            .from('meal_logs')
            .select(`
                meal_type,
                meal_items: meal_items!inner (
                    food_name,
                    quantity
                )
            `)
            .eq('user_id', user.id)
            .eq('meal_date', targetDate);

        if (mealLogError) {
            console.error("食事ログ取得エラー:", mealLogError);
            const error = new AppError({ code: ErrorCode.Base.API_ERROR, message: '食事ログの取得に失敗しました' });
            return new Response(JSON.stringify(createErrorResponse(error)), { status: getHttpStatusCode(error) });
        }

        if (!mealLogs || mealLogs.length === 0) {
            const error = new AppError({ code: ErrorCode.Base.DATA_NOT_FOUND, message: '対象日の食事記録が見つかりません' });
            return new Response(JSON.stringify(createErrorResponse(error)), { status: getHttpStatusCode(error) });
        }

        // 食事データを整形
        const formattedMeals = mealLogs.map(log => ({
            type: log.meal_type,
            items: log.meal_items.map((item: any) => `${item.food_name} ${item.quantity || ''}`.trim()).join(', ')
        }));

        const mealContent = formattedMeals.map(meal => `${meal.type}: ${meal.items}`).join('\n');

        // AIアドバイス生成
        const aiService = AIServiceFactory.getService();
        const adviceResult = await aiService.getNutritionAdvice({
            userId: user.id,
            date: targetDate,
            pregnancyWeek: pregnancyWeek,
            trimester: trimester,
            mealContent: mealContent,
            previousAdvice: undefined
        });

        // アドバイスをDBに保存
        const { data: savedAdvice, error: saveError } = await supabaseClient
            .from('daily_nutri_advice')
            .insert({
                user_id: user.id,
                advice_date: targetDate,
                advice_type: 'DAILY',
                advice_summary: adviceResult.summary,
                advice_detail: adviceResult.detailedAdvice || null,
                recommended_foods: adviceResult.recommendedFoods?.map(food => food.name) || null,
                is_read: false,
                trimester: trimester
            })
            .select()
            .single();

        if (saveError) {
            console.error("アドバイス保存エラー:", saveError);
            const error = new AppError({ code: ErrorCode.Base.API_ERROR, message: 'アドバイスの保存に失敗しました' });
            return new Response(JSON.stringify(createErrorResponse(error)), { status: getHttpStatusCode(error) });
        }

        // 最新アドバイスを返す
        return new Response(JSON.stringify({
            success: true,
            id: savedAdvice.id,
            advice_date: savedAdvice.advice_date,
            advice_type: savedAdvice.advice_type,
            advice: detail ? {
                content: savedAdvice.advice_detail || savedAdvice.advice_summary,
                recommended_foods: savedAdvice.recommended_foods || []
            } : undefined,
            advice_detail: detail ? undefined : (savedAdvice.advice_detail || savedAdvice.advice_summary),
            recommended_foods: detail ? undefined : (savedAdvice.recommended_foods || []),
            is_read: savedAdvice.is_read,
            generated_at: savedAdvice.created_at
        }), { status: 200 });

    } catch (caughtError: unknown) {
        console.error("アドバイスAPIエラー:", caughtError);
        let appError: AppError | null = null;
        if (caughtError instanceof AppError) {
            appError = caughtError;
        } else if (caughtError instanceof z.ZodError) {
            appError = new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: 'リクエスト形式が無効です', details: caughtError.flatten() });
        } else {
            appError = new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: '予期せぬエラーが発生しました',
                originalError: caughtError instanceof Error ? caughtError : undefined
            });
        }
        if (appError) {
            return new Response(JSON.stringify(createErrorResponse(appError)), { status: getHttpStatusCode(appError) });
        } else {
            const fallbackError = new AppError({ code: ErrorCode.Base.UNKNOWN_ERROR, message: 'エラー処理中に予期せぬ問題が発生しました' });
            return new Response(JSON.stringify(createErrorResponse(fallbackError)), { status: 500 });
        }
    }
}

// PATCH メソッド (既読更新)
export async function PATCH(request: NextRequest) {
    try {
        const supabaseClient = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            const error = new AppError({ code: ErrorCode.Base.AUTH_ERROR, message: "認証が必要です" });
            return new Response(JSON.stringify(createErrorResponse(error)), { status: getHttpStatusCode(error) });
        }

        const body = await request.json();
        const { id } = z.object({ id: z.string() }).parse(body);

        const { error } = await supabaseClient
            .from('daily_nutri_advice')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error("既読更新DBエラー:", error);
            const appError = new AppError({ code: ErrorCode.Base.API_ERROR, message: '既読状態の更新に失敗しました' });
            return new Response(JSON.stringify(createErrorResponse(appError)), { status: getHttpStatusCode(appError) });
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (caughtError: unknown) {
        console.error("既読更新APIエラー:", caughtError);
        let appError: AppError | null = null;
        if (caughtError instanceof z.ZodError) {
            appError = new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: 'リクエスト形式が無効です', details: caughtError.flatten() });
        } else {
            appError = new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: '既読状態の更新中にエラーが発生しました',
                originalError: caughtError instanceof Error ? caughtError : undefined
            });
        }
        if (appError) {
            return new Response(JSON.stringify(createErrorResponse(appError)), { status: getHttpStatusCode(appError) });
        } else {
            const fallbackError = new AppError({ code: ErrorCode.Base.UNKNOWN_ERROR, message: 'エラー処理中に予期せぬ問題が発生しました' });
            return new Response(JSON.stringify(createErrorResponse(fallbackError)), { status: 500 });
        }
    }
} 