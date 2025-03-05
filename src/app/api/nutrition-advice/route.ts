import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AdviceType } from "@/types/nutrition";
import { AIModelFactory } from '@/lib/ai/model-factory';
import { PromptService, PromptType } from '@/lib/ai/prompts/prompt-service';
import { getSeason } from '@/lib/ai/prompts/prompt-utils';
import { withErrorHandling } from '@/lib/errors/error-utils';
import { AIError, ErrorCode } from '@/lib/errors/ai-error';
import { z } from 'zod';
import { AIService, NutritionAdviceResult } from '@/lib/ai/ai-service';
import { getCurrentSeason } from '@/lib/utils/date-utils';

// リクエストスキーマ
const RequestSchema = z.object({
    pregnancyWeek: z.number().min(1).max(42),
    deficientNutrients: z.array(z.string()).optional(),
    mode: z.enum(['summary', 'detail']).default('detail')
});

// Supabaseクライアント型定義
type SupabaseClient = any; // 実際の型が利用可能な場合は置き換えてください

// Supabaseクライアント作成関数
function createClient(): SupabaseClient {
    // サーバーサイドでのクライアント作成
    return createRouteHandlerClient({ cookies });
}

// 栄養アドバイスAPIエンドポイント
export const GET = withErrorHandling(async (req: Request) => {
    try {
        console.log('栄養アドバイスAPI: リクエスト受信'); // デバッグ用ログ

        // ユーザー認証確認
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.log('栄養アドバイスAPI: 認証エラー - セッションなし'); // デバッグ用ログ
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];

        // 既存のアドバイスがあるか確認
        const { data: existingAdvice } = await supabase
            .from('daily_nutri_advice')
            .select('*')
            .eq('user_id', userId)
            .eq('advice_date', formattedDate)
            .maybeSingle();

        if (existingAdvice) {
            console.log('栄養アドバイスAPI: 既存アドバイスを返します'); // デバッグ用ログ
            return NextResponse.json({
                success: true,
                ...existingAdvice
            });
        }

        // 妊婦プロフィール取得
        const { data: profile } = await supabase
            .from('pregnancy_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (!profile) {
            console.error('プロファイル取得エラー:', { error: '妊婦プロフィールが見つかりません' });
            console.log('栄養アドバイスAPI: プロファイル取得エラー', { error: '妊婦プロフィールが見つかりません' }); // デバッグ用ログ
            return NextResponse.json(
                { error: '妊婦プロフィールが見つかりません' },
                { status: 404 }
            );
        }

        // 不足栄養素の取得
        const deficientNutrients = await getDeficientNutrients(supabase, userId, profile);

        // 季節情報
        const currentSeason = getCurrentSeason();

        // 妊娠期の計算
        const pregnancyWeek = calculatePregnancyWeek(profile.due_date);
        const trimester = Math.ceil(pregnancyWeek / 13);

        // AIサービス呼び出し - 要約
        const aiService = AIService.getInstance();
        const summaryResult = await aiService.getNutritionAdvice({
            pregnancyWeek,
            trimester,
            deficientNutrients,
            isSummary: true,
            formattedDate: today.toLocaleDateString('ja-JP'),
            currentSeason
        });

        // 詳細アドバイスが必要かどうか
        const need_detail_advice = true; // 条件に応じて変更可能

        let detailedAdvice = '';
        let recommendedFoods: Array<{ name: string, benefits: string }> = [];

        if (need_detail_advice) {
            // 詳細アドバイス生成
            const detailResult = await aiService.getNutritionAdvice({
                pregnancyWeek,
                trimester,
                deficientNutrients,
                isSummary: false,
                formattedDate: today.toLocaleDateString('ja-JP'),
                currentSeason
            });

            detailedAdvice = detailResult.detailedAdvice || '';
            recommendedFoods = detailResult.recommendedFoods || [];
        }

        // 推奨食品をフォーマット
        const formattedRecommendedFoods = recommendedFoods.map(food =>
            `**${food.name}:** ${food.benefits}`
        );

        // データベースに保存
        const { data: savedAdvice, error: saveError } = await supabase
            .from('daily_nutri_advice')
            .insert({
                user_id: userId,
                advice_date: formattedDate,
                advice_type: 'daily',
                advice_summary: summaryResult.summary,
                advice_detail: detailedAdvice,
                recommended_foods: formattedRecommendedFoods,
                is_read: false,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (saveError) {
            console.error('アドバイス保存エラー:', saveError);
            console.log('栄養アドバイスAPI: データベース保存エラー', saveError); // デバッグ用ログ
            throw new Error('アドバイスの保存に失敗しました');
        }

        return NextResponse.json({
            success: true,
            ...savedAdvice
        });
    } catch (error) {
        console.error("アドバイス生成エラー:", error);
        console.log('栄養アドバイスAPI: 予期せぬエラー', error); // デバッグ用ログ
        return NextResponse.json(
            { success: false, error: "アドバイスの生成に失敗しました" },
            { status: 500 }
        );
    }
});

// 不足栄養素取得
async function getDeficientNutrients(supabase: any, userId: string, profile: any) {
    // 最近の食事記録から栄養摂取状況を取得
    const { data: mealRecords } = await supabase
        .from('meal_records')
        .select('nutrition')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

    // 妊娠期に基づく推奨栄養摂取量
    const recommendedIntake = getRecommendedIntake(calculatePregnancyWeek(profile.due_date));

    // 平均栄養摂取量の計算
    const averageIntake = calculateAverageIntake(mealRecords);

    // 不足している栄養素の特定
    const deficient = [];

    if (averageIntake.protein < recommendedIntake.protein * 0.8) {
        deficient.push('タンパク質');
    }

    if (averageIntake.iron < recommendedIntake.iron * 0.8) {
        deficient.push('鉄分');
    }

    if (averageIntake.folic_acid < recommendedIntake.folic_acid * 0.8) {
        deficient.push('葉酸');
    }

    if (averageIntake.calcium < recommendedIntake.calcium * 0.8) {
        deficient.push('カルシウム');
    }

    return deficient;
}

// 妊娠週数計算
function calculatePregnancyWeek(dueDate: string): number {
    const today = new Date();
    const due = new Date(dueDate);
    const totalPregnancyDays = 280; // 40週 × 7日

    // 出産予定日までの日数
    const daysUntilDue = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // 妊娠日数 = 全期間 - 残り日数
    const pregnancyDays = totalPregnancyDays - daysUntilDue;

    // 妊娠週数の計算（切り上げ）
    return Math.max(1, Math.min(40, Math.ceil(pregnancyDays / 7)));
}

// 推奨栄養摂取量の取得
function getRecommendedIntake(pregnancyWeek: number) {
    // 妊娠期に応じた推奨摂取量
    if (pregnancyWeek <= 13) {
        return {
            protein: 65, // g/日
            iron: 20,    // mg/日
            folic_acid: 480, // μg/日
            calcium: 650,  // mg/日
        };
    } else if (pregnancyWeek <= 27) {
        return {
            protein: 75,
            iron: 25,
            folic_acid: 480,
            calcium: 650,
        };
    } else {
        return {
            protein: 80,
            iron: 30,
            folic_acid: 480,
            calcium: 700,
        };
    }
}

// 平均栄養摂取量の計算
function calculateAverageIntake(mealRecords: any[]) {
    if (!mealRecords || mealRecords.length === 0) {
        return {
            protein: 0,
            iron: 0,
            folic_acid: 0,
            calcium: 0
        };
    }

    let totalProtein = 0;
    let totalIron = 0;
    let totalFolicAcid = 0;
    let totalCalcium = 0;
    let validRecords = 0;

    mealRecords.forEach(record => {
        if (record.nutrition) {
            totalProtein += record.nutrition.protein || 0;
            totalIron += record.nutrition.iron || 0;
            totalFolicAcid += record.nutrition.folic_acid || 0;
            totalCalcium += record.nutrition.calcium || 0;
            validRecords++;
        }
    });

    return {
        protein: validRecords ? totalProtein / validRecords : 0,
        iron: validRecords ? totalIron / validRecords : 0,
        folic_acid: validRecords ? totalFolicAcid / validRecords : 0,
        calcium: validRecords ? totalCalcium / validRecords : 0
    };
}

// 妊娠週数から妊娠期（トリメスター）を計算
function calculateTrimester(pregnancyWeek: number): number {
    if (pregnancyWeek <= 13) return 1;
    if (pregnancyWeek <= 27) return 2;
    return 3;
}

// read状態を更新するPATCHエンドポイント
export async function PATCH(request: Request) {
    try {
        const { id } = await request.json();

        const supabase = createRouteHandlerClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: "認証が必要です" },
                { status: 401 }
            );
        }

        const { error } = await supabase
            .from('daily_nutri_advice')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', session.user.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("アドバイス更新エラー:", error);
        return NextResponse.json(
            { success: false, error: "アドバイスの更新に失敗しました" },
            { status: 500 }
        );
    }
} 