import { NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/api/middleware';
import { createServerClient } from '@supabase/ssr'; // type CookieOptions を削除
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from "next/headers";
import { z } from 'zod';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { ErrorCode, AppError } from "@/lib/error";
import { createSuccessResponse } from '@/lib/api/response';
import { getJapanDate, calculatePregnancyWeek, getTrimesterNumber, getCurrentSeason } from '@/lib/date-utils';
import { format } from 'date-fns';
import {
    getPastNutritionData,
    identifyDeficientNutrients
} from '@/lib/api/nutrition-advice-helpers';
import { AdviceType } from '@/types/advice';
import { PromptType } from '@/lib/ai/prompts/prompt-service';

// アドバイスタイプのリテラル型 (削除)
// type AdviceType = 'DAILY_INITIAL' | 'AFTER_MEALS' | 'MANUAL_REFRESH';

// リクエストクエリパラメータの検証スキーマ
const QuerySchema = z.object({
    // z.enum に AdviceType の値を使用 (as const でリテラル型の配列に変換)
    type: z.enum(['DAILY_INITIAL', 'AFTER_MEALS', 'MANUAL_REFRESH'] as const).optional().default('DAILY_INITIAL'),
    forceRegenerate: z.boolean().optional().default(false),
});

// Supabaseクライアント型 (仮) -> 削除 (インポートした SupabaseClient を使用)
// type SupabaseClient = any;

// --- 既存APIからコピーするヘルパー関数群 START/END --- (削除)

// 上限制御チェック関数
// 引数の型をインポートした SupabaseClient に変更
async function isAdviceLimitReached(supabase: SupabaseClient, userId: string, type: AdviceType): Promise<boolean> {
    const today = getJapanDate(); // 日本日付を取得
    const todayStr = format(today, 'yyyy-MM-dd');

    const limitMap: Record<AdviceType, number> = {
        'DAILY_INITIAL': 1,
        'AFTER_MEALS': 1,
        'MANUAL_REFRESH': 1 // 設計案では1回
    };
    const limit = limitMap[type] || 1;

    // DBアクセスエラーを考慮
    try {
        const { count, error } = await supabase
            .from('daily_nutri_advice')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('advice_type', type)
            .eq('advice_date', todayStr); // 日付カラムで比較

        if (error) {
            console.error(`[API Limit Check] DB Error checking advice limit for type ${type}:`, error);
            // DBエラー時は安全側に倒し、上限到達とみなすか、エラーを投げるか検討
            // ここではエラーをスローする
            throw new AppError({ code: ErrorCode.Base.API_ERROR, message: 'アドバイス上限の確認中にエラーが発生しました', originalError: error });
        }

        console.log(`[API Limit Check] Type: ${type}, Date: ${todayStr}, Count: ${count}, Limit: ${limit}`);
        return (count ?? 0) >= limit;

    } catch (error) {
        // AppError はそのままスロー
        if (error instanceof AppError) throw error;
        // その他のエラーはラップしてスロー
        throw new AppError({ code: ErrorCode.Base.API_ERROR, message: 'アドバイス上限確認中に予期せぬエラー', originalError: error instanceof Error ? error : undefined });
    }
}

export const GET = withErrorHandling(async (req: NextRequest) => {
    // const supabase = createRouteHandlerClient({ cookies }); // 削除
    const cookieStore = await cookies();

    // @supabase/ssr を使用してクライアントを作成
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                // Route Handlers (GET) では set/remove は通常不要
                // もし必要なら実装する
                /* (略)
                */
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new AppError({ code: ErrorCode.Base.AUTH_ERROR, message: "認証が必要です" });
    }

    // クエリパラメータの解析
    const { searchParams } = new URL(req.url);
    const parsedQuery = QuerySchema.safeParse({
        // type: searchParams.get('type') as AdviceType | undefined, // as AdviceType キャストを削除
        type: searchParams.get('type'), // キャスト削除
        forceRegenerate: searchParams.get('forceRegenerate') === 'true'
    });

    if (!parsedQuery.success) {
        throw new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: '無効なクエリパラメータです', details: parsedQuery.error.flatten() });
    }
    const { type, forceRegenerate } = parsedQuery.data;
    const targetDate = format(getJapanDate(), 'yyyy-MM-dd'); // 今日日付

    console.log(`[API Request] GET /api/v2/nutrition-advice - Type: ${type}, Force: ${forceRegenerate}, Date: ${targetDate}`);

    // ユーザープロファイル取得 (due_date)
    const { data: profile, error: profileError } = await supabase
        .from('profiles') // テーブル名を 'user_profiles' から 'profiles' に変更 (スキーマに合わせて)
        .select('due_date')
        .eq('user_id', user.id) // profiles テーブルの主キーが 'user_id' であることを確認
        .single(); // single() を使用

    if (profileError || !profile) { // profile が null の場合も考慮
        console.error("[API Profile] Error fetching profile or profile not found:", profileError);
        throw new AppError({
            code: ErrorCode.Base.DATA_NOT_FOUND,
            message: 'プロフィール情報が見つかりません。' + (profileError ? 'DBエラー' : ''),
            originalError: profileError
        });
    }
    // profile が null でないことを確認してから due_date をチェック
    if (!profile.due_date) {
        throw new AppError({ code: ErrorCode.Base.DATA_NOT_FOUND, message: '出産予定日が設定されていません' });
    }

    // 上限チェック
    const limitReached = await isAdviceLimitReached(supabase, user.id, type);

    // アドバイス生成要否判断
    const shouldGenerate = forceRegenerate || !limitReached;

    if (!shouldGenerate) {
        console.log(`[API Logic] Limit reached or forceRegenerate is false. Fetching latest existing advice for type: ${type}`);
        // 上限到達 or 強制再生成なし -> DBから最新の同タイプ・今日のアドバイスを取得して返す
        const { data: existingAdvice, error: fetchError } = await supabase
            .from('daily_nutri_advice')
            .select('*')
            .eq('user_id', user.id)
            .eq('advice_type', type)
            .eq('advice_date', targetDate)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(); // maybeSingleで結果がなくてもエラーにしない

        if (fetchError) {
            console.error(`[API DB Fetch Error] Error fetching existing advice for type ${type}:`, fetchError);
            throw new AppError({ code: ErrorCode.Base.API_ERROR, message: '既存アドバイスの取得中にエラーが発生しました', originalError: fetchError });
        }

        if (existingAdvice) {
            console.log(`[API Logic] Found existing advice (ID: ${existingAdvice.id}). Returning it.`);
            return createSuccessResponse({
                id: existingAdvice.id,
                advice_date: existingAdvice.advice_date,
                advice_type: existingAdvice.advice_type,
                advice_summary: existingAdvice.advice_summary,
                advice_detail: existingAdvice.advice_detail,
                recommended_foods: existingAdvice.recommended_foods || [],
                is_read: existingAdvice.is_read,
                generated_at: existingAdvice.created_at,
                source: 'database' // 取得元を示す情報
            }, {});
        } else {
            // 設計上、!shouldGenerate かつ DB にもない場合は通常発生しないはずだが、念のため
            console.log(`[API Logic] Limit reached but no existing advice found for type ${type}. Generating new one.`);
            // この場合、フォールバックして AI 生成に進む（次のステップで実装）
        }
    }

    // --- AI生成ロジック --- 
    console.log(`[API Logic] Proceeding to generate new advice via AI for type: ${type}`);

    // ユーザー情報と過去の栄養データを準備
    let pregnancyWeek = 0;
    if (profile && profile.due_date) {
        // calculatePregnancyWeek の戻り値から .week を取得
        pregnancyWeek = calculatePregnancyWeek(profile.due_date).week;
    }

    // getTrimesterNumber に週数を渡す
    const trimester = getTrimesterNumber(pregnancyWeek);
    const season = getCurrentSeason();
    const pastNutrition = await getPastNutritionData(supabase, user.id);
    // Assuming identifyDeficientNutrients returns the list directly
    const deficientNutrients = identifyDeficientNutrients(pastNutrition); // Assign directly
    // recentMeals は promptContext から削除 (あるいは別の方法で取得)

    // プロンプトコンテキストを作成
    const promptContext = {
        type,
        pregnancyWeek,
        trimester,
        season,
        deficientNutrients,
        // recentMeals, // Still removed for now
    };

    // --- Add Logging for Prompt Context --- 
    console.log("[API AI Request] Prompt Context:", JSON.stringify(promptContext, null, 2));
    // ---------------------------------------

    // AIサービスを初期化
    const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

    // プロンプトタイプを選択
    const promptType = PromptType.NUTRITION_ADVICE;

    // アドバイス生成
    const adviceResult = await aiService.getNutritionAdvice(promptContext, promptType);

    console.log("[API AI Response] Raw adviceResult:", JSON.stringify(adviceResult, null, 2));

    // Check if essential data is present, using detailedAdvice from AI result type
    if (!adviceResult || !adviceResult.summary || !adviceResult.detailedAdvice) { // Check detailedAdvice
        console.error("[API AI Error] Failed to generate AI advice or result is missing fields:", adviceResult);
        throw new AppError({ code: ErrorCode.AI.MODEL_ERROR, message: 'AIアドバイスの生成に失敗しました', details: 'AI service returned invalid or incomplete data' });
    }

    // Prepare data for DB upsert - Use description directly
    const dataToUpsert = {
        user_id: user.id,
        advice_date: targetDate,
        advice_type: type,
        advice_summary: adviceResult.summary,
        advice_detail: adviceResult.detailedAdvice,
        // Remove mapping, save recommendedFoods with description directly
        recommended_foods: adviceResult.recommendedFoods?.map(food => ({
            name: food.name,
            description: food.description || "" // Use description
        })) || null,
        is_read: false
    };

    console.log("[API DB Upsert] Data to upsert:", JSON.stringify(dataToUpsert, null, 2));

    // 結果をDBに Upsert
    const { data: savedOrUpdatedAdvice, error: upsertError } = await supabase
        .from('daily_nutri_advice')
        .upsert(dataToUpsert, {
            onConflict: 'user_id, advice_date, advice_type'
        })
        .select()
        .single();

    if (upsertError) {
        console.error('[API DB Upsert Error] Error upserting generated advice:', upsertError);
        // Use API_ERROR as fallback for DB_ERROR
        throw new AppError({ code: ErrorCode.Base.API_ERROR, message: 'アドバイスの保存/更新に失敗しました', originalError: upsertError });
    }

    console.log("[API DB Upsert] Upsert successful, returned data:", savedOrUpdatedAdvice);

    // レスポンスを作成 (Use the data returned from upsert)
    const responseData = {
        id: savedOrUpdatedAdvice.id,
        advice_date: savedOrUpdatedAdvice.advice_date,
        advice_type: savedOrUpdatedAdvice.advice_type,
        advice_summary: savedOrUpdatedAdvice.advice_summary,
        advice_detail: savedOrUpdatedAdvice.advice_detail,
        recommended_foods: savedOrUpdatedAdvice.recommended_foods, // This should now contain {name, description}
        is_read: savedOrUpdatedAdvice.is_read,
        generated_at: savedOrUpdatedAdvice.created_at,
        source: 'ai'
    };

    console.log("[API Response] Data to return:", JSON.stringify(responseData, null, 2));

    return createSuccessResponse(responseData, {});

});

export const OPTIONS = withErrorHandling(async () => {
    return createSuccessResponse({ message: 'OK' }, {});
}); 