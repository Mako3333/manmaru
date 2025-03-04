import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AdviceType } from "@/types/nutrition";

export async function GET(request: Request) {
    try {
        // 1. リクエストパラメータの取得
        const { searchParams } = new URL(request.url);
        const detailLevel = searchParams.get('detail') === 'true' ? 'detail' : 'summary';

        // 2. Supabaseクライアント初期化
        const supabase = createRouteHandlerClient({ cookies });

        // 3. セッション確認 (認証チェック)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: "認証が必要です" },
                { status: 401 }
            );
        }

        // 4. 今日の日付を取得
        const today = new Date().toISOString().split('T')[0];

        // 5. 既存のアドバイスを確認
        const { data: existingAdvice, error: adviceError } = await supabase
            .from('daily_nutri_advice')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('advice_date', today)
            .eq('advice_type', AdviceType.DAILY)
            .single();

        // 既存アドバイスがある場合は返す
        if (existingAdvice && !adviceError) {
            return NextResponse.json({
                success: true,
                advice: {
                    id: existingAdvice.id,
                    content: detailLevel === 'detail' ? existingAdvice.advice_detail : existingAdvice.advice_summary,
                    recommended_foods: detailLevel === 'detail' ? existingAdvice.recommended_foods : undefined,
                    created_at: existingAdvice.created_at,
                    is_read: existingAdvice.is_read
                }
            });
        }

        // 6. ユーザープロファイル取得
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        if (profileError) {
            console.error('プロファイル取得エラー:', profileError);
            return NextResponse.json(
                { success: false, error: "プロフィール情報の取得に失敗しました" },
                { status: 500 }
            );
        }

        // 7. 栄養目標・実績データ取得
        const { data: nutritionData, error: nutritionError } = await supabase
            .from('nutrition_goal_prog')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('meal_date', today)
            .single();

        // 栄養データがなくてもエラーとはしない（新規ユーザーや食事未記録の場合）

        // 8. Gemini APIセットアップ
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('API KEY未設定');
            return NextResponse.json(
                { success: false, error: "サーバー設定エラー" },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-001",
            generationConfig: { temperature: 0.2 }
        });

        // 9. 不足栄養素の特定
        const deficientNutrients = [];

        if (nutritionData) {
            if (nutritionData.protein_percent < 80)
                deficientNutrients.push("タンパク質");
            if (nutritionData.iron_percent < 80)
                deficientNutrients.push("鉄分");
            if (nutritionData.folic_acid_percent < 80)
                deficientNutrients.push("葉酸");
            if (nutritionData.calcium_percent < 80)
                deficientNutrients.push("カルシウム");
            if (nutritionData.vitamin_d_percent < 80)
                deficientNutrients.push("ビタミンD");
        }

        // 10. トライメスターの計算
        const pregnancyWeek = profile.pregnancy_week || 0;
        let trimester = 1;
        if (pregnancyWeek > 13) trimester = 2;
        if (pregnancyWeek > 27) trimester = 3;

        // 11. プロンプト生成
        const summaryPrompt = generatePrompt(pregnancyWeek, trimester, deficientNutrients, 'summary');
        const detailPrompt = generatePrompt(pregnancyWeek, trimester, deficientNutrients, 'detail');

        // 12. AI生成（並行処理）
        const [summaryResult, detailResult] = await Promise.all([
            model.generateContent({
                contents: [{ role: "user", parts: [{ text: summaryPrompt }] }]
            }),
            model.generateContent({
                contents: [{ role: "user", parts: [{ text: detailPrompt }] }]
            })
        ]);

        const adviceSummary = summaryResult.response.text();
        const detailResponse = detailResult.response.text();

        // 13. 詳細レスポンスから推奨食品リストを抽出
        let adviceDetail = detailResponse;
        let recommendedFoods: string[] = [];

        const foodListMatch = detailResponse.match(/### 推奨食品リスト\s*([\s\S]*?)(\n\n|$)/);
        if (foodListMatch) {
            adviceDetail = detailResponse.replace(/### 推奨食品リスト[\s\S]*/, '').trim();
            recommendedFoods = foodListMatch[1]
                .split('\n')
                .map(item => item.replace(/^[•\-\*]\s*/, '').trim())
                .filter(item => item.length > 0);
        }

        // 14. データベースに保存
        const { data: savedAdvice, error: saveError } = await supabase
            .from('daily_nutri_advice')
            .insert({
                user_id: session.user.id,
                advice_date: today,
                advice_type: AdviceType.DAILY,
                advice_summary: adviceSummary,
                advice_detail: adviceDetail,
                recommended_foods: recommendedFoods,
                is_read: false
            })
            .select()
            .single();

        if (saveError) {
            console.error('アドバイス保存エラー:', saveError);
            return NextResponse.json(
                { success: false, error: "アドバイスの保存に失敗しました" },
                { status: 500 }
            );
        }

        // 15. レスポンス返却
        return NextResponse.json({
            success: true,
            advice: {
                id: savedAdvice.id,
                content: detailLevel === 'detail' ? savedAdvice.advice_detail : savedAdvice.advice_summary,
                recommended_foods: detailLevel === 'detail' ? savedAdvice.recommended_foods : undefined,
                created_at: savedAdvice.created_at,
                is_read: savedAdvice.is_read
            }
        });

    } catch (error) {
        console.error("アドバイス生成エラー:", error);
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
    const basePrompt = `
あなたは妊婦向け栄養管理アプリ「manmaru」の栄養アドバイザーです。
現在妊娠${pregnancyWeek}週目（第${trimester}期）の妊婦に対して、栄養アドバイスを作成します。

${deficientNutrients.length > 0
            ? `特に不足している栄養素: ${deficientNutrients.join('、')}`
            : '現在の栄養状態は良好です。'}
`;

    if (mode === 'summary') {
        return `
${basePrompt}

以下の点を考慮した簡潔なアドバイスを作成してください:
1. 妊娠${pregnancyWeek}週目に特に重要な栄養素の説明
2. ${deficientNutrients.length > 0
                ? `不足している栄養素を補うための簡単なアドバイス`
                : '全体的な栄養バランスを維持するための簡単なアドバイス'}

アドバイスは150-200字程度、親しみやすく、要点を絞った内容で作成してください。
専門用語の使用は最小限に抑え、温かい口調で作成してください。
`;
    } else {
        return `
${basePrompt}

以下の点を含む詳細なアドバイスを作成してください:
1. 妊娠${pregnancyWeek}週目の胎児の発達状況
2. この時期に特に重要な栄養素とその理由
3. ${deficientNutrients.length > 0
                ? `不足している栄養素（${deficientNutrients.join('、')}）を補うための具体的な食品例とレシピのアイデア`
                : '全体的な栄養バランスを維持するための詳細なアドバイスと食品例'}
4. 季節の食材を取り入れた提案

さらに、レスポンスの最後に「### 推奨食品リスト」というセクションを作成し、箇条書きで5-7つの具体的な食品と、その栄養価や調理法のヒントを簡潔に列挙してください。

アドバイスは300-500字程度、詳細ながらも理解しやすい内容で作成してください。
専門用語を使う場合は、簡単な説明を添えてください。
`;
    }
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