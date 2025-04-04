import { NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/api/middleware';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from "next/headers";
import { z } from 'zod';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { ErrorCode, AppError } from "@/lib/error";
import { createErrorResponse, createSuccessResponse } from '@/lib/api/response';
import { getJapanDate, getCurrentSeason, calculatePregnancyWeek, getTrimesterNumber } from '@/lib/date-utils'; // 日付・週数計算ユーティリティ
import { format } from 'date-fns';
import { ja } from 'date-fns/locale/ja'; // ja ロケールをインポート
import {
    getPastNutritionData,
    identifyDeficientNutrients
} from '@/lib/api/nutrition-advice-helpers';
import { AdviceType } from '@/types/advice'; // AdviceType をインポート
import { PromptType } from '@/lib/ai/prompts/prompt-service'; // PromptType をインポート

// アドバイスタイプのリテラル型 (削除)
// type AdviceType = 'DAILY_INITIAL' | 'AFTER_MEALS' | 'MANUAL_REFRESH';

// リクエストクエリパラメータの検証スキーマ
const QuerySchema = z.object({
    // z.enum に AdviceType の値を使用 (as const でリテラル型の配列に変換)
    type: z.enum(['DAILY_INITIAL', 'AFTER_MEALS', 'MANUAL_REFRESH'] as const).optional().default('DAILY_INITIAL'),
    forceRegenerate: z.boolean().optional().default(false),
});

// Supabaseクライアント型 (仮) - createServerClient の戻り値型を使うのが理想だが、一旦 any のまま
type SupabaseClient = any;

// --- 既存APIからコピーするヘルパー関数群 START ---
// (削除)
// --- 既存APIからコピーするヘルパー関数群 END ---

// 上限制御チェック関数
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
                /*
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch (error) {
                        // The `set` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch (error) {
                        // The `delete` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
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
        type: searchParams.get('type') as AdviceType | undefined, // as AdviceType でキャスト
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
        .from('profiles')
        .select('due_date')
        .eq('user_id', user.id)
        .single(); // single() を使用

    if (profileError || !profile) {
        console.error("[API Profile] Error fetching profile or profile not found:", profileError);
        throw new AppError({
            code: ErrorCode.Base.DATA_NOT_FOUND,
            message: 'プロフィール情報が見つかりません。' + (profileError ? 'DBエラー' : ''),
            originalError: profileError
        });
    }
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

    // --- AI生成ロジック --- (ヘルパー関数を利用)
    console.log(`[API Logic] Proceeding to generate new advice via AI for type: ${type}`);

    // 1. 過去データ取得
    const pastNutritionData = await getPastNutritionData(supabase, user.id);

    // 2. 不足栄養素特定
    const deficientNutrients = identifyDeficientNutrients(pastNutritionData);
    console.log('[API Logic] Deficient nutrients:', deficientNutrients);

    // 3. 週数・季節など計算
    const pregnancyWeek = calculatePregnancyWeek(profile.due_date);
    const trimester = getTrimesterNumber(pregnancyWeek);
    const currentSeason = getCurrentSeason();
    const formattedDate = format(getJapanDate(), 'yyyy年M月d日(E)', { locale: ja });

    // 4. プロンプト選択
    let promptTypeToUse: PromptType;
    let aiServiceParams: any = { // aiService.getNutritionAdvice に渡すパラメータ
        pregnancyWeek,
        trimester,
        deficientNutrients,
        formattedDate,
        currentSeason,
        pastNutritionData
    };

    if (type === 'AFTER_MEALS') {
        console.log('[API Logic] Selecting AFTER_MEALS prompt template (nutrition-tips/v1)');
        // nutrition-tips/v1.ts を使用するように変更
        promptTypeToUse = PromptType.NUTRITION_TIPS;
        // AFTER_MEALS 用に追加のパラメータが必要な場合はここで設定
        // aiServiceParams.someExtraParam = ...;
    } else {
        // DAILY_INITIAL または MANUAL_REFRESH
        promptTypeToUse = PromptType.NUTRITION_ADVICE;
    }

    const aiService = AIServiceFactory.getService(AIServiceType.GEMINI);

    // 5. aiService.getNutritionAdvice 呼び出し (パラメータと選択したプロンプトタイプを渡す)
    const adviceResult = await aiService.getNutritionAdvice(aiServiceParams, promptTypeToUse);

    // 6. 結果をDBに保存
    // adviceResult に error プロパティが存在する場合のハンドリングを追加
    if (adviceResult.error) {
        // エラーをログに出力し、エラーレスポンスを返す
        console.error('[API AI Error] Failed to generate nutrition advice:', adviceResult.error);
        // AppError をスローするか、エラーを含む createErrorResponse を返すか検討
        // ここでは AppError をスローする例
        throw new AppError({
            code: adviceResult.error.code || ErrorCode.AI.ANALYSIS_FAILED,
            message: adviceResult.error.message || 'AIによるアドバイス生成に失敗しました。',
            originalError: adviceResult.error.details
        });
    }

    const { data: savedAdvice, error: saveError } = await supabase
        .from('daily_nutri_advice')
        .insert({
            user_id: user.id,
            advice_date: targetDate,
            advice_type: type, // リクエストされたタイプで保存
            advice_summary: adviceResult.summary,
            advice_detail: adviceResult.detailedAdvice || null,
            // recommendedFoods は {name, benefits} なので name のみ保存
            recommended_foods: adviceResult.recommendedFoods?.map(f => f.name) || [],
            is_read: false,
        })
        .select()
        .single();

    if (saveError) {
        console.error("[API DB Save Error] Error saving generated advice:", saveError);
        throw new AppError({ code: ErrorCode.Base.API_ERROR, message: '生成されたアドバイスの保存に失敗しました', originalError: saveError });
    }

    console.log(`[API Logic] Generated and saved new advice (ID: ${savedAdvice.id}).`);

    // 7. 生成結果を返す
    return createSuccessResponse({
        id: savedAdvice.id,
        advice_date: savedAdvice.advice_date,
        advice_type: savedAdvice.advice_type,
        advice_summary: savedAdvice.advice_summary,
        advice_detail: savedAdvice.advice_detail,
        recommended_foods: savedAdvice.recommended_foods || [],
        is_read: savedAdvice.is_read,
        generated_at: savedAdvice.created_at,
        source: 'ai' // 取得元を示す情報
    }, {});
}); 