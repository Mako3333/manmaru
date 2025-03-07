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
import { getCurrentSeason, getJapanDate } from '@/lib/utils/date-utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { calculatePregnancyWeek } from '@/lib/date-utils';
import { NextRequest } from 'next/server';

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
export async function GET(request: NextRequest) {
    console.log('栄養アドバイスAPI: リクエスト受信');

    try {
        // リクエストパラメータの取得
        const searchParams = request.nextUrl.searchParams;
        const forceUpdate = searchParams.get('force') === 'true';
        const isDetailedRequest = searchParams.get('detail') === 'true';
        const requestDate = searchParams.get('date') || getJapanDate();

        console.log('栄養アドバイスAPI: 強制更新モード =', forceUpdate);
        console.log('栄養アドバイスAPI: リクエスト日付 =', requestDate);

        const supabase = createClient();

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

        // 既存のアドバイスIDを保持する変数
        let existingAdviceId = null;

        // 強制更新モードでない場合は、既存のアドバイスを確認
        if (!forceUpdate) {
            // 指定された日付のアドバイスを取得
            const { data: existingAdvice, error: adviceError } = await supabase
                .from('daily_nutri_advice')
                .select('*')
                .eq('user_id', userId)
                .eq('advice_date', requestDate)
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
        } else {
            // 強制更新モードの場合、既存のアドバイスを確認
            const { data: existingAdvice, error: adviceError } = await supabase
                .from('daily_nutri_advice')
                .select('id')
                .eq('user_id', userId)
                .eq('advice_date', requestDate)
                .eq('advice_type', 'daily')
                .single();

            // 既存のアドバイスがある場合は、後で更新するためにIDを保存
            if (!adviceError && existingAdvice) {
                existingAdviceId = existingAdvice.id;
                console.log('栄養アドバイスAPI: 既存アドバイスを更新します', existingAdviceId); // デバッグ用ログ
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
                    message: 'プロフィールを作成してください。プロフィールページに移動します。',
                    redirect: '/profile'
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
                .eq('meal_date', requestDate)
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
        const formattedDate = format(new Date(requestDate), 'yyyy年MM月dd日', { locale: ja });

        // AIサービスのインスタンス取得
        const aiService = AIService.getInstance();

        // 栄養アドバイス生成（常に詳細と要約の両方を生成）
        console.log('栄養アドバイスAPI: アドバイスを生成します'); // デバッグ用ログ
        const adviceResult = await aiService.getNutritionAdvice({
            pregnancyWeek,
            trimester,
            deficientNutrients,
            formattedDate,
            currentSeason
        });

        console.log('栄養アドバイスAPI: アドバイス生成結果', {
            summaryLength: adviceResult.summary?.length || 0,
            detailedAdviceLength: adviceResult.detailedAdvice?.length || 0,
            recommendedFoodsCount: adviceResult.recommendedFoods?.length || 0
        }); // デバッグ用ログ

        // アドバイスをフォーマット
        const adviceData = {
            user_id: userId,
            advice_date: requestDate,
            advice_type: 'daily',
            advice_summary: adviceResult.summary || '栄養アドバイスが生成されました',
            advice_detail: adviceResult.detailedAdvice || adviceResult.summary || '詳細な栄養アドバイスが生成されました',
            recommended_foods: adviceResult.recommendedFoods?.map(food => food.name) || ['バランスの良い食事を心がけましょう'],
            is_read: false
        };

        console.log('栄養アドバイスAPI: 保存するデータ', {
            summaryLength: adviceData.advice_summary.length,
            detailLength: adviceData.advice_detail.length,
            foodsCount: adviceData.recommended_foods.length
        }); // デバッグ用ログ

        // アドバイスをデータベースに保存または更新
        let savedAdvice;

        if (existingAdviceId) {
            // 既存のアドバイスを更新
            console.log('栄養アドバイスAPI: 既存アドバイスを更新します', existingAdviceId); // デバッグ用ログ
            const { data: updatedAdvice, error: updateError } = await supabase
                .from('daily_nutri_advice')
                .update({
                    advice_summary: adviceData.advice_summary,
                    advice_detail: adviceData.advice_detail,
                    recommended_foods: adviceData.recommended_foods,
                    is_read: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingAdviceId)
                .select()
                .single();

            if (updateError) {
                console.error('アドバイス更新エラー:', updateError);
                console.log('栄養アドバイスAPI: データベース更新エラー', updateError); // デバッグ用ログ
                throw new Error('アドバイスの更新に失敗しました');
            }

            savedAdvice = updatedAdvice;
        } else {
            // 新規アドバイスを作成
            console.log('栄養アドバイスAPI: 新規アドバイスを作成します'); // デバッグ用ログ
            const { data: newAdvice, error: saveError } = await supabase
                .from('daily_nutri_advice')
                .insert(adviceData)
                .select()
                .single();

            if (saveError) {
                console.error('アドバイス保存エラー:', saveError);
                console.log('栄養アドバイスAPI: データベース保存エラー', saveError); // デバッグ用ログ
                throw new Error('アドバイスの保存に失敗しました');
            }

            savedAdvice = newAdvice;
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