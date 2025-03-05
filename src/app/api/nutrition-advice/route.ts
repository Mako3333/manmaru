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

// リクエストスキーマ
const RequestSchema = z.object({
    pregnancyWeek: z.number().min(1).max(42),
    deficientNutrients: z.array(z.string()).optional(),
    mode: z.enum(['summary', 'detail']).default('detail')
});

export async function GET(request: Request) {
    try {
        console.log('栄養アドバイスAPI: リクエスト受信'); // デバッグ用ログ

        // 1. リクエストパラメータの取得
        const { searchParams } = new URL(request.url);
        const pregnancyWeekParam = searchParams.get('pregnancyWeek');
        const deficientNutrientsParam = searchParams.get('deficientNutrients');
        const modeParam = searchParams.get('mode') as 'summary' | 'detail' || 'detail';
        console.log('栄養アドバイスAPI: 妊娠週数', pregnancyWeekParam);
        console.log('栄養アドバイスAPI: 不足栄養素', deficientNutrientsParam);
        console.log('栄養アドバイスAPI: 詳細レベル', modeParam);

        // 2. パラメータの検証
        if (!pregnancyWeekParam) {
            throw new AIError(
                '妊娠週数が指定されていません',
                ErrorCode.VALIDATION_ERROR,
                null,
                ['pregnancyWeek パラメータを指定してください']
            );
        }

        const pregnancyWeek = parseInt(pregnancyWeekParam, 10);
        if (isNaN(pregnancyWeek) || pregnancyWeek < 1 || pregnancyWeek > 42) {
            throw new AIError(
                '妊娠週数が無効です',
                ErrorCode.VALIDATION_ERROR,
                null,
                ['妊娠週数は1〜42の範囲で指定してください']
            );
        }

        // 不足栄養素の解析
        const deficientNutrients = deficientNutrientsParam
            ? deficientNutrientsParam.split(',').map(n => n.trim())
            : [];

        // 3. トリメスター（妊娠期）の計算
        const trimester = calculateTrimester(pregnancyWeek);

        // 4. Supabaseクライアント初期化
        const supabase = createRouteHandlerClient({ cookies });

        // 5. セッション確認 (認証チェック)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.log('栄養アドバイスAPI: 認証エラー - セッションなし'); // デバッグ用ログ
            return NextResponse.json(
                { success: false, error: "認証が必要です" },
                { status: 401 }
            );
        }
        console.log('栄養アドバイスAPI: ユーザーID', session.user.id); // デバッグ用ログ

        // 6. 今日の日付を取得
        const today = new Date().toISOString().split('T')[0];
        console.log('栄養アドバイスAPI: 今日の日付', today); // デバッグ用ログ

        // 7. 既存のアドバイスを確認
        const { data: existingAdvice, error: adviceError } = await supabase
            .from('daily_nutri_advice')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('advice_date', today)
            .eq('advice_type', AdviceType.DAILY)
            .single();

        console.log('栄養アドバイスAPI: 既存アドバイス検索結果', existingAdvice, adviceError); // デバッグ用ログ

        // 既存アドバイスがある場合は返す
        if (existingAdvice && !adviceError) {
            console.log('栄養アドバイスAPI: 既存アドバイスを返します'); // デバッグ用ログ
            return NextResponse.json({
                success: true,
                advice: {
                    id: existingAdvice.id,
                    content: modeParam === 'detail' ? existingAdvice.advice_detail : existingAdvice.advice_summary,
                    recommended_foods: modeParam === 'detail' ? existingAdvice.recommended_foods : undefined,
                    created_at: existingAdvice.created_at,
                    is_read: existingAdvice.is_read
                }
            });
        }

        console.log('栄養アドバイスAPI: 新規アドバイス生成開始'); // デバッグ用ログ

        // 8. ユーザープロファイル取得
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        if (profileError) {
            console.error('プロファイル取得エラー:', profileError);
            console.log('栄養アドバイスAPI: プロファイル取得エラー', profileError); // デバッグ用ログ
            return NextResponse.json(
                { success: false, error: "プロフィール情報の取得に失敗しました" },
                { status: 500 }
            );
        }

        // 9. 栄養目標・実績データ取得
        const { data: nutritionData, error: nutritionError } = await supabase
            .from('nutrition_goal_prog')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('meal_date', today)
            .single();

        // 栄養データがなくてもエラーとはしない（新規ユーザーや食事未記録の場合）

        // 10. Gemini APIセットアップ
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('API KEY未設定');
            console.log('栄養アドバイスAPI: Gemini API KEY未設定'); // デバッグ用ログ
            return NextResponse.json(
                { success: false, error: "サーバー設定エラー" },
                { status: 500 }
            );
        }

        // APIキーが有効かどうかを確認するための簡易チェック
        if (apiKey.length < 10) {
            console.error('API KEY無効: 長さが不足しています');
            console.log('栄養アドバイスAPI: Gemini API KEY無効', apiKey.length); // デバッグ用ログ
            return NextResponse.json(
                { success: false, error: "API設定エラー" },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-001",
            generationConfig: { temperature: 0.2 }
        });

        // 11. プロンプト生成
        const prompt = generatePrompt(
            pregnancyWeek,
            trimester,
            deficientNutrients,
            modeParam
        );

        // 12. AI生成（並行処理）
        let result;
        try {
            result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            });
        } catch (aiError) {
            console.error('AI生成エラー:', aiError);
            console.log('栄養アドバイスAPI: Gemini API呼び出しエラー', aiError); // デバッグ用ログ

            // フォールバックのアドバイスを返す
            return NextResponse.json({
                success: true,
                advice: {
                    id: 'fallback',
                    content: modeParam === 'detail'
                        ? "現在、詳細な栄養アドバイスを生成できません。しばらく経ってからもう一度お試しください。バランスの良い食事を心がけ、特に鉄分、葉酸、カルシウムの摂取に注意しましょう。"
                        : "バランスの良い食事を心がけましょう。特に妊娠中は鉄分、葉酸、カルシウムの摂取が重要です。",
                    recommended_foods: modeParam === 'detail'
                        ? ["ほうれん草", "レバー", "ブロッコリー", "牛乳", "ヨーグルト", "豆腐", "ナッツ類"]
                        : undefined,
                    created_at: new Date().toISOString(),
                    is_read: false
                }
            });
        }

        const advice = result.response.text();

        // 13. データベースに保存
        try {
            const { data: savedAdvice, error: saveError } = await supabase
                .from('daily_nutri_advice')
                .insert({
                    user_id: session.user.id,
                    advice_date: today,
                    advice_type: AdviceType.DAILY,
                    advice_summary: advice,
                    advice_detail: advice,
                    recommended_foods: [],
                    is_read: false
                })
                .select()
                .single();

            if (saveError) {
                console.error('アドバイス保存エラー:', saveError);
                console.log('栄養アドバイスAPI: データベース保存エラー', saveError); // デバッグ用ログ

                // 保存に失敗した場合でも、生成したアドバイスを返す
                return NextResponse.json({
                    success: true,
                    advice: {
                        id: 'temp-' + Date.now(),
                        content: modeParam === 'detail' ? advice : advice,
                        recommended_foods: modeParam === 'detail' ? [] : undefined,
                        created_at: new Date().toISOString(),
                        is_read: false
                    },
                    warning: "アドバイスの保存に失敗しました。次回アクセス時に再生成される可能性があります。"
                });
            }

            // 14. レスポンス返却
            console.log('栄養アドバイスAPI: 新規アドバイス生成完了'); // デバッグ用ログ
            return NextResponse.json({
                success: true,
                advice: {
                    id: savedAdvice.id,
                    content: modeParam === 'detail' ? savedAdvice.advice_detail : savedAdvice.advice_summary,
                    recommended_foods: modeParam === 'detail' ? [] : undefined,
                    created_at: savedAdvice.created_at,
                    is_read: savedAdvice.is_read
                }
            });
        } catch (dbError) {
            console.error('データベース操作エラー:', dbError);
            console.log('栄養アドバイスAPI: 予期せぬデータベースエラー', dbError); // デバッグ用ログ

            // データベースエラーの場合でも、生成したアドバイスを返す
            return NextResponse.json({
                success: true,
                advice: {
                    id: 'temp-' + Date.now(),
                    content: modeParam === 'detail' ? advice : advice,
                    recommended_foods: modeParam === 'detail' ? [] : undefined,
                    created_at: new Date().toISOString(),
                    is_read: false
                },
                warning: "データベースエラーが発生しました。次回アクセス時に再生成される可能性があります。"
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
}

// プロンプト生成関数
function generatePrompt(
    pregnancyWeek: number,
    trimester: number,
    deficientNutrients: string[],
    mode: 'summary' | 'detail'
): string {
    // プロンプトサービスを利用
    const promptService = PromptService.getInstance();

    // コンテキスト作成
    const context = {
        pregnancyWeek,
        trimester,
        deficientNutrients,
        isSummary: mode === 'summary',
        formattedDate: new Date().toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        currentSeason: getSeason(new Date().getMonth() + 1)
    };

    // プロンプト生成
    return promptService.generateNutritionAdvicePrompt(context);
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