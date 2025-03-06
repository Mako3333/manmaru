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
import { AIService } from '@/lib/ai/ai-service';
import { getCurrentSeason } from '@/lib/utils/date-utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { calculatePregnancyWeek } from '@/lib/date-utils';

// リクエストスキーマ
const RequestSchema = z.object({
    pregnancyWeek: z.number().min(1).max(42).optional(),
    deficientNutrients: z.array(z.string()).optional(),
    mode: z.enum(['normal', 'force_update']).optional().default('normal')
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

        const supabase = createClient();
        const { searchParams } = new URL(req.url);

        // 詳細モードかどうか
        const isDetailMode = searchParams.get('detail') === 'true';

        // 強制更新モードかどうか
        const mode = searchParams.get('mode') || 'normal';
        const isForceUpdate = mode === 'force_update';

        // ユーザー認証確認
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.log('栄養アドバイスAPI: 認証エラー - セッションなし'); // デバッグ用ログ
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const today = new Date().toISOString().split('T')[0];

        // 強制更新モードでない場合は、既存のアドバイスを確認
        if (!isForceUpdate) {
            // 今日のアドバイスを取得
            const { data: existingAdvice, error: adviceError } = await supabase
                .from('daily_nutri_advice')
                .select('*')
                .eq('user_id', userId)
                .eq('advice_date', today)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            // エラーがなく、既存のアドバイスがある場合
            if (!adviceError && existingAdvice) {
                console.log('栄養アドバイスAPI: 既存アドバイスを返します'); // デバッグ用ログ
                return NextResponse.json({
                    success: true,
                    ...existingAdvice
                });
            }
        }

        // 妊婦プロフィール取得
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (profileError) {
            console.error('プロファイル取得エラー:', profileError);
            console.log('栄養アドバイスAPI: プロファイル取得エラー', profileError); // デバッグ用ログ
            return NextResponse.json(
                {
                    error: '妊婦プロフィールが見つかりません',

                },
                { status: 404 }
            );
        }

        // 妊娠週数計算
        const pregnancyWeek = calculatePregnancyWeek(profile.due_date);

        // トライメスター計算
        let trimester = 1;
        if (pregnancyWeek > 27) {
            trimester = 3;
        } else if (pregnancyWeek > 13) {
            trimester = 2;
        }

        // 不足栄養素の取得
        let deficientNutrients: string[] = [];
        try {
            // 栄養進捗データを取得
            const { data: nutritionProgress } = await supabase
                .from('nutrition_goal_prog')
                .select('*')
                .eq('user_id', userId)
                .eq('meal_date', today)
                .single();

            if (nutritionProgress) {
                // 不足している栄養素を特定
                if (nutritionProgress.protein_percent < 70) {
                    deficientNutrients.push('タンパク質');
                }
                if (nutritionProgress.iron_percent < 70) {
                    deficientNutrients.push('鉄分');
                }
                if (nutritionProgress.folic_acid_percent < 70) {
                    deficientNutrients.push('葉酸');
                }
                if (nutritionProgress.calcium_percent < 70) {
                    deficientNutrients.push('カルシウム');
                }
                if (nutritionProgress.vitamin_d_percent < 70) {
                    deficientNutrients.push('ビタミンD');
                }
            } else {
                // デフォルトの不足栄養素（データがない場合）
                deficientNutrients = ['タンパク質', '鉄分', '葉酸', 'カルシウム'];
            }
        } catch (error) {
            console.error('栄養データ取得エラー:', error);
            // エラー時はデフォルト値を使用
            deficientNutrients = ['タンパク質', '鉄分', '葉酸', 'カルシウム'];
        }

        // 現在の季節を取得
        const currentSeason = getCurrentSeason();

        // 日付を日本語フォーマットで
        const formattedDate = format(new Date(), 'yyyy年MM月dd日', { locale: ja });

        // AIサービスのインスタンス取得
        const aiService = AIService.getInstance();

        // 詳細アドバイスが必要かどうか
        if (isDetailMode) {
            // 詳細アドバイス生成
            const adviceResult = await aiService.getNutritionAdvice({
                pregnancyWeek,
                trimester,
                deficientNutrients,
                isSummary: false,
                formattedDate,
                currentSeason
            });

            // アドバイスをフォーマット
            const adviceData = {
                user_id: userId,
                advice_date: today,
                advice_type: 'daily',
                advice_summary: adviceResult.summary,
                advice_detail: adviceResult.detailedAdvice,
                recommended_foods: adviceResult.recommendedFoods?.map(food => food.name) || [],
                is_read: false
            };

            // アドバイスをデータベースに保存
            const { data: savedAdvice, error: saveError } = await supabase
                .from('daily_nutri_advice')
                .insert(adviceData)
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
        } else {
            // 要約アドバイス生成
            const adviceResult = await aiService.getNutritionAdvice({
                pregnancyWeek,
                trimester,
                deficientNutrients,
                isSummary: true,
                formattedDate,
                currentSeason
            });

            // アドバイスをフォーマット
            const adviceData = {
                user_id: userId,
                advice_date: today,
                advice_type: 'daily',
                advice_summary: adviceResult.summary,
                is_read: false
            };

            // アドバイスをデータベースに保存
            const { data: savedAdvice, error: saveError } = await supabase
                .from('daily_nutri_advice')
                .insert(adviceData)
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
        }
    } catch (error) {
        console.error("アドバイス生成エラー:", error);
        console.log('栄養アドバイスAPI: 予期せぬエラー', error); // デバッグ用ログ
        return NextResponse.json(
            { success: false, error: "アドバイスの生成に失敗しました" },
            { status: 500 }
        );
    }
});

// 妊娠週数から妊娠期（トリメスター）を計算
function calculateTrimester(pregnancyWeek: number): number {
    if (pregnancyWeek <= 13) return 1;
    if (pregnancyWeek <= 27) return 2;
    return 3;
}

// read状態を更新するPATCHエンドポイント
export async function PATCH(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies });

        // ユーザー認証確認
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: '認証が必要です' },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'アドバイスIDが必要です' },
                { status: 400 }
            );
        }

        // アドバイスの既読状態を更新
        const { error } = await supabase
            .from('daily_nutri_advice')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) {
            console.error('アドバイス更新エラー:', error);
            return NextResponse.json(
                { success: false, error: 'アドバイスの更新に失敗しました' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('栄養アドバイス更新API エラー:', error);
        return NextResponse.json(
            { success: false, error: '栄養アドバイスの更新に失敗しました' },
            { status: 500 }
        );
    }
} 