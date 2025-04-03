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
import { createErrorResponse, getHttpStatusCode, createSuccessResponse } from '@/lib/api/response';

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
    return percentages.length > 0 ? Math.round(percentages.reduce((sum, val) => sum + val, 0) / percentages.length) : 0;
}

// 過去の栄養データを取得する関数
interface PastNutritionRecord {
    date: string;
    overallScore: number;
    nutrients: {
        [key: string]: { percentage: number };
        calories: { percentage: number };
        protein: { percentage: number };
        iron: { percentage: number };
        folic_acid: { percentage: number };
        calcium: { percentage: number };
        vitamin_d: { percentage: number };
    };
}

async function getPastNutritionData(supabase: SupabaseClient, userId: string, days: number = 3): Promise<PastNutritionRecord[]> {
    const today = new Date();
    const pastDates = [];
    for (let i = 1; i <= days; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        pastDates.push(format(date, 'yyyy-MM-dd'));
    }
    console.log('過去の栄養データを取得: 対象日付', pastDates);

    const { data, error } = await supabase
        .from('nutrition_goal_prog')
        .select(`
            meal_date,
            calories_percent,
            protein_percent,
            iron_percent,
            folic_acid_percent,
            calcium_percent,
            vitamin_d_percent
        `)
        .eq('user_id', userId)
        .in('meal_date', pastDates)
        .order('meal_date', { ascending: false });

    if (error) {
        console.error('過去の栄養データ取得エラー:', error);
        throw new AppError({ code: ErrorCode.Base.API_ERROR, message: '過去の栄養データの取得に失敗しました', originalError: error });
    }
    if (!data || data.length === 0) {
        console.log('過去の栄養データが見つかりません');
        return [];
    }
    console.log(`取得した過去の栄養データ: ${data.length}件`);

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

// 不足栄養素を特定する関数
const nutrientNameMap: { [key: string]: string } = {
    calories: 'カロリー',
    protein: 'タンパク質',
    iron: '鉄分',
    folic_acid: '葉酸',
    calcium: 'カルシウム',
    vitamin_d: 'ビタミンD'
};

function identifyDeficientNutrients(pastData: PastNutritionRecord[]): string[] {
    if (!pastData || pastData.length === 0) return [];

    const nutrientSums: { [key: string]: number } = {};
    const nutrientCounts: { [key: string]: number } = {};

    pastData.forEach(day => {
        if (day.nutrients) {
            Object.keys(day.nutrients).forEach(key => {
                const percentage = day.nutrients[key]?.percentage;
                if (typeof percentage === 'number') {
                    nutrientSums[key] = (nutrientSums[key] || 0) + percentage;
                    nutrientCounts[key] = (nutrientCounts[key] || 0) + 1;
                }
            });
        }
    });

    const deficientKeys: string[] = [];
    const threshold = 70;

    Object.keys(nutrientSums).forEach(key => {
        const count = nutrientCounts[key] || 0;
        if (count > 0) {
            const sum = nutrientSums[key] || 0;
            const avg = sum / count;
            if (avg < threshold) {
                deficientKeys.push(key);
            }
        }
    });

    return deficientKeys.map(key => nutrientNameMap[key] || key);
}

// 栄養アドバイスAPIエンドポイント
export async function GET(request: NextRequest) {
    try {
        const supabaseClient = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            const error = new AppError({ code: ErrorCode.Base.AUTH_ERROR, message: "認証が必要です" });
            return createErrorResponse(error);
        }

        const searchParams = request.nextUrl.searchParams;
        const parsedQuery = RequestSchema.safeParse({
            date: searchParams.get('date') || undefined,
            force: searchParams.get('force') === 'true',
            detail: searchParams.get('detail') === 'true'
        });

        if (!parsedQuery.success) {
            const error = new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: '無効なクエリパラメータです', details: parsedQuery.error.flatten() });
            return createErrorResponse(error);
        }

        const { date, force, detail } = parsedQuery.data;
        const targetDate = date || getJapanDate();

        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('due_date')
            .eq('user_id', user.id)
            .maybeSingle();

        if (profileError) {
            console.error("プロファイルDBエラー:", profileError);
            const error = new AppError({ code: ErrorCode.Base.API_ERROR, message: 'プロファイル情報の取得中にエラーが発生しました', originalError: profileError });
            return createErrorResponse(error);
        }
        if (!profile) {
            console.error("プロファイルが見つかりません (user_id: ", user.id, ")");
            const error = new AppError({ code: ErrorCode.Base.DATA_NOT_FOUND, message: 'プロフィール情報が見つかりません。設定してください。', details: { redirect: '/profile/edit' } });
            return createErrorResponse(error);
        }
        if (!profile.due_date) {
            const error = new AppError({ code: ErrorCode.Base.DATA_NOT_FOUND, message: '出産予定日が設定されていません', details: { redirect: '/profile/edit' } });
            return createErrorResponse(error);
        }

        let pastNutritionData: PastNutritionRecord[];
        try {
            pastNutritionData = await getPastNutritionData(supabaseClient, user.id);
        } catch (pastDataError: unknown) {
            if (pastDataError instanceof AppError) {
                return createErrorResponse(pastDataError);
            }
            const error = new AppError({ code: ErrorCode.Base.API_ERROR, message: '過去データの取得中にエラーが発生しました', originalError: pastDataError instanceof Error ? pastDataError : undefined });
            return createErrorResponse(error);
        }

        // ---- DBキャッシュ確認 (force=false の場合) ----
        if (!force) {
            const { data: latestAdvice, error: dbError } = await supabaseClient
                .from('daily_nutri_advice')
                .select('*')
                .eq('user_id', user.id)
                .eq('advice_date', targetDate) // 対象日のアドバイスを探す
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (dbError && dbError.code !== 'PGRST116') { // PGRST116: No rows found は無視
                console.error("DBからのアドバイス取得エラー:", dbError);
                // エラー時はフォールスルーしてAI生成を試みることも可能だが、一旦エラーで返す
                const error = new AppError({ code: ErrorCode.Base.API_ERROR, message: '既存アドバイスの取得に失敗しました', originalError: dbError });
                return createErrorResponse(error);
            }

            if (latestAdvice) {
                console.log(`キャッシュされたアドバイスが見つかりました (date: ${targetDate})`);
                // createSuccessResponse を使用 (response.ts で定義想定)
                // Linter Error Fix: 第2引数にメタデータオブジェクトを渡す
                return createSuccessResponse({ // 修正
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
                }, {}); // 修正: メタデータ {} を追加 (status はデフォルトの 200 を期待)
            }
            console.log(`キャッシュされたアドバイスは見つかりませんでした (date: ${targetDate})。AI生成を試みます。`);
        } else {
            console.log(`force=true のため、AIによるアドバイス生成を強制実行します (date: ${targetDate})。`);
        }

        // ---- AIによるアドバイス生成ロジック (force=true または DBキャッシュなし) ----

        const deficientNutrients = identifyDeficientNutrients(pastNutritionData);
        console.log('不足している栄養素:', deficientNutrients);

        const pregnancyWeek = calculatePregnancyWeek(profile.due_date);
        const trimester = getTrimesterNumber(pregnancyWeek);

        const aiService = AIServiceFactory.getService();
        let adviceResult;
        try {
            adviceResult = await aiService.getNutritionAdvice({
                userId: user.id,
                date: targetDate,
                pregnancyWeek: pregnancyWeek,
                trimester: trimester,
                pastNutritionData: pastNutritionData,
                deficientNutrients: deficientNutrients,
                previousAdvice: undefined
            });
            // ★ デバッグログ追加: AIからの返り値を直接確認
            console.log("[DEBUG] AI Service Result:", JSON.stringify(adviceResult, null, 2));

            // ★ 修正: AIサービスの結果チェックを強化 (summary と recommendedFoods を必須とする)
            if (!adviceResult || typeof adviceResult.summary !== 'string' || !Array.isArray(adviceResult.recommendedFoods)) {
                console.error("AIアドバイス生成失敗: AIサービスから有効な結果が得られませんでした。", { adviceResult });
                throw new AppError({
                    code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                    message: 'AIによるアドバイス生成に失敗しました (サービス未実装または無効な応答)',
                });
            }

        } catch (aiError: unknown) {
            console.error("AIアドバイス生成エラー:", aiError);
            // ★ 修正: catchした場合もAppErrorを生成して返す
            const error = aiError instanceof AppError ? aiError : new AppError({
                code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                message: 'AIによるアドバイス生成中にエラーが発生しました',
                originalError: aiError instanceof Error ? aiError : undefined
            });
            return createErrorResponse(error);
        }

        let savedAdvice;
        try {
            const foodsToSave = adviceResult.recommendedFoods?.map(food => food.name) || [];

            const { data, error: saveError } = await supabaseClient
                .from('daily_nutri_advice')
                .insert({
                    user_id: user.id,
                    advice_date: targetDate,
                    advice_type: 'DAILY',
                    advice_summary: adviceResult.summary,
                    advice_detail: adviceResult.detailedAdvice || null,
                    recommended_foods: foodsToSave,
                    is_read: false,
                    // 削除: trimester カラムが存在しないため、一時的に削除
                    // trimester: trimester
                })
                .select()
                .single();

            if (saveError) {
                throw saveError;
            }
            savedAdvice = data;
            console.log(`生成されたアドバイスをDBに保存しました (id: ${savedAdvice.id})`);

        } catch (dbSaveError: unknown) {
            console.error("アドバイス保存DBエラー:", dbSaveError);
            const error = new AppError({
                code: ErrorCode.Base.API_ERROR,
                message: '生成されたアドバイスの保存に失敗しました',
                originalError: dbSaveError instanceof Error ? dbSaveError : undefined
            });
            return createErrorResponse(error);
        }

        return createSuccessResponse({
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
        }, {}); // 修正: メタデータ {} を追加 (status はデフォルトの 200 を期待)

    } catch (caughtError: unknown) {
        // この catch ブロックは予期せぬエラー用
        // ★ デバッグログ追加
        console.error("========== nutrition-advice API 予期せぬエラー ==========");
        console.error("エラータイプ:", typeof caughtError);
        console.error("エラー内容:", caughtError);
        if (caughtError instanceof Error) {
            console.error("エラーメッセージ:", caughtError.message);
            console.error("スタックトレース:", caughtError.stack);
        }
        // --- デバッグログ追加ここまで ---

        console.error("アドバイスAPIの予期せぬエラー:", caughtError); // 元のログも残す
        const appError = caughtError instanceof AppError ? caughtError : new AppError({
            code: ErrorCode.Base.UNKNOWN_ERROR,
            message: 'アドバイスの取得中に予期せぬエラーが発生しました',
            originalError: caughtError instanceof Error ? caughtError : undefined
        });

        // ★ デバッグログ追加
        const errorResponse = createErrorResponse(appError);
        console.log("生成されたエラーレスポンス (最終catch):", errorResponse);
        // --- デバッグログ追加ここまで ---

        return errorResponse; // 修正: createErrorResponse を返す
    }
}

// PATCH メソッド (既読更新)
export async function PATCH(request: NextRequest) {
    try {
        const supabaseClient = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            const error = new AppError({ code: ErrorCode.Base.AUTH_ERROR, message: "認証が必要です" });
            return createErrorResponse(error);
        }

        let id: string;
        try {
            const body = await request.json();
            const parsedBody = z.object({ id: z.string() }).safeParse(body);
            if (!parsedBody.success) {
                throw new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: 'リクエスト形式が無効です', details: parsedBody.error.flatten() });
            }
            id = parsedBody.data.id;
        } catch (parseError: unknown) {
            const error = parseError instanceof AppError ? parseError : new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'リクエストボディの解析に失敗しました',
                originalError: parseError instanceof Error ? parseError : undefined
            });
            return createErrorResponse(error);
        }

        const { error: updateError } = await supabaseClient
            .from('daily_nutri_advice')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', user.id);

        if (updateError) {
            console.error("既読更新DBエラー:", updateError);
            const appError = new AppError({ code: ErrorCode.Base.API_ERROR, message: '既読状態の更新に失敗しました', originalError: updateError });
            return createErrorResponse(appError);
        }

        return createSuccessResponse({ success: true }, {}); // 修正: メタデータ {} を追加 (status はデフォルトの 200 を期待)

    } catch (caughtError: unknown) {
        // ★ デバッグログ追加 (PATCH用)
        console.error("========== nutrition-advice PATCH API 予期せぬエラー ==========");
        console.error("エラータイプ:", typeof caughtError);
        console.error("エラー内容:", caughtError);
        if (caughtError instanceof Error) {
            console.error("エラーメッセージ:", caughtError.message);
            console.error("スタックトレース:", caughtError.stack);
        }
        // --- デバッグログ追加ここまで ---

        console.error("既読更新APIの予期せぬエラー:", caughtError);
        const appError = caughtError instanceof AppError ? caughtError : new AppError({
            code: ErrorCode.Base.UNKNOWN_ERROR,
            message: '既読状態の更新中に予期せぬエラーが発生しました',
            originalError: caughtError instanceof Error ? caughtError : undefined
        });

        // ★ デバッグログ追加 (PATCH用)
        const errorResponse = createErrorResponse(appError);
        console.log("生成されたエラーレスポンス (PATCH最終catch):", errorResponse);
        // --- デバッグログ追加ここまで ---

        return errorResponse;
    }
} 