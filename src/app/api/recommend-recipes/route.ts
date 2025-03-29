import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { AIService } from '@/lib/ai/ai-service';
import { AIModelFactory } from '@/lib/ai/model-factory';
import { PromptService, PromptType } from '@/lib/ai/prompts/prompt-service';
import { getCurrentSeason } from '@/lib/date-utils';

export async function POST(req: Request) {
    try {
        const { userId, servings = 2, excludeIngredients = [] } = await req.json();
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!
        );

        // 1. ユーザーの栄養ログを取得
        const { data: nutritionLog, error: logError } = await supabase
            .from('daily_nutrition_logs')
            .select('nutrition_data')
            .eq('user_id', userId)
            .order('log_date', { ascending: false })
            .limit(1)
            .single();

        // 2. ユーザープロファイルを取得（妊娠週数など）
        const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('pregnancy_week, dietary_restrictions')
            .eq('id', userId)
            .single();

        const pregnancyWeek = userProfile?.pregnancy_week || 20;
        const dietaryRestrictions = userProfile?.dietary_restrictions || [];

        // 除外食材リストを作成（ユーザー指定 + プロファイルの食事制限）
        const allExcludeIngredients = [...excludeIngredients, ...dietaryRestrictions];

        // 栄養データがない場合は、妊娠週数に基づいたデフォルト値を使用
        let deficientNutrients: string[] = [];
        const isFirstTimeUser = logError || !nutritionLog;

        if (isFirstTimeUser) {
            // 妊娠期間に基づいたデフォルトの栄養ニーズを設定
            if (pregnancyWeek <= 12) {
                // 妊娠初期（1-12週）
                deficientNutrients = ['葉酸', '鉄分', 'ビタミンB6'];
            } else if (pregnancyWeek <= 27) {
                // 妊娠中期（13-27週）
                deficientNutrients = ['カルシウム', '鉄分', 'タンパク質'];
            } else {
                // 妊娠後期（28週以降）
                deficientNutrients = ['鉄分', 'カルシウム', 'ビタミンD', 'DHA'];
            }

            console.log(`栄養データが見つからないため、妊娠${pregnancyWeek}週に基づいたデフォルト値を使用します: ${deficientNutrients.join(', ')}`);
        } else {
            deficientNutrients = nutritionLog.nutrition_data.deficient_nutrients || [];

            // 不足栄養素がない場合も、妊娠週数に基づいたデフォルト値を提供
            if (deficientNutrients.length === 0) {
                if (pregnancyWeek <= 12) {
                    deficientNutrients = ['葉酸', '鉄分'];
                } else if (pregnancyWeek <= 27) {
                    deficientNutrients = ['カルシウム', '鉄分'];
                } else {
                    deficientNutrients = ['鉄分', 'カルシウム', 'DHA'];
                }
                console.log(`不足栄養素が特定されていないため、妊娠${pregnancyWeek}週に基づいたデフォルト値を使用します: ${deficientNutrients.join(', ')}`);
            }
        }

        // 現在の季節を取得
        const currentSeason = getCurrentSeason();

        // 日付をフォーマット
        const today = new Date();
        const formattedDate = today.toLocaleDateString('ja-JP');

        // 妊娠期の計算
        const trimester = Math.ceil(pregnancyWeek / 13);

        // レシピ生成用のプロンプトコンテキスト
        const promptContext = {
            pregnancyWeek,
            trimester,
            deficientNutrients,
            excludeIngredients: allExcludeIngredients,
            servings,
            isFirstTimeUser,
            formattedDate,
            currentSeason
        };

        // AIモデルを使用してレシピを生成
        const model = AIModelFactory.createTextModel({
            temperature: 0.7,
            maxOutputTokens: 2048
        });

        // プロンプトサービスからレシピ生成用プロンプトを取得
        const promptService = PromptService.getInstance();
        const prompt = promptService.generatePrompt(PromptType.RECIPE_RECOMMENDATION, promptContext);

        // モデル呼び出し
        const response = await model.invoke(prompt);
        const responseText = response.toString();

        // レスポンスからJSONを抽出
        try {
            const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                responseText.match(/```\n([\s\S]*?)\n```/) ||
                responseText.match(/{[\s\S]*}/);

            let jsonContent = '';
            if (jsonMatch) {
                jsonContent = jsonMatch[1] || jsonMatch[0];
            } else {
                jsonContent = responseText;
            }

            const recipes = JSON.parse(jsonContent);

            // レスポンスを構築
            const responseData = {
                ...recipes,
                is_first_time_user: isFirstTimeUser
            };

            return NextResponse.json(responseData);
        } catch (parseError) {
            console.error('Error parsing recipe result:', parseError);
            return NextResponse.json(
                {
                    error: 'レシピデータの解析に失敗しました',
                    raw_response: responseText
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error recommending recipes:', error);
        return NextResponse.json(
            { error: 'レシピ提案中にエラーが発生しました', details: (error as Error).message },
            { status: 500 }
        );
    }
} 