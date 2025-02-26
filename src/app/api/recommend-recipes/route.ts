import { NextResponse } from "next/server";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createClient } from '@supabase/supabase-js';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
    DynamicRetrievalMode,
    GoogleSearchRetrievalTool,
} from "@google/generative-ai";

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

        // 3. Google検索ツールを設定
        const searchRetrievalTool: GoogleSearchRetrievalTool = {
            googleSearchRetrieval: {
                dynamicRetrievalConfig: {
                    mode: DynamicRetrievalMode.MODE_DYNAMIC,
                    dynamicThreshold: 0.7,
                },
            },
        };

        // 4. Gemini 2.0 Flashモデルを設定（検索ツール付き）
        const model = new ChatGoogleGenerativeAI({
            model: "gemini-2.0-flash-001",
            temperature: 0.2,
            maxOutputTokens: 2048,
            apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        }).bindTools([searchRetrievalTool]);

        // 5. プロンプトテンプレートを作成（初回ユーザー向けの情報を追加）
        const recipePrompt = `
あなたは妊婦向けの栄養士です。以下の栄養素が不足している妊婦に適したレシピを3つ提案してください。

不足している栄養素: ${deficientNutrients.join(', ')}
妊娠週数: ${pregnancyWeek}週
除外したい食材: ${allExcludeIngredients.join(', ')}
${isFirstTimeUser ? '※これは初めてアプリを使用するユーザーです。基本的な栄養情報も含めてください。' : ''}

提案するレシピは以下の条件を満たすこと:
- ${servings}人分の分量
- 調理時間30分以内
- 一般的な食材を使用
- 妊婦に安全な食材のみ使用
- 季節の食材を優先的に使用

最新の栄養学的知見に基づいて、不足している栄養素を効率的に補給できるレシピを提案してください。
また、なぜそのレシピが妊婦に適しているのか、どのように栄養素を補給できるのかも説明してください。
${isFirstTimeUser ? '初めてのユーザーのため、妊娠中の栄養摂取の基本についても簡潔に説明してください。' : ''}

以下のJSON形式で返してください:
{
  "recipes": [
    {
      "title": "レシピ名",
      "description": "レシピの簡単な説明と栄養的メリット",
      "ingredients": ["材料1: 量", "材料2: 量", ...],
      "steps": ["手順1", "手順2", ...],
      "nutrients": ["含まれる栄養素1: 量", "含まれる栄養素2: 量", ...],
      "preparation_time": "調理時間（分）",
      "difficulty": "簡単/中級/難しい",
      "tips": "調理のコツや代替食材の提案"
    }
  ],
  "nutrition_tips": [
    "不足栄養素に関するアドバイス1",
    "不足栄養素に関するアドバイス2"
  ]${isFirstTimeUser ? ',\n  "first_time_info": "妊娠中の栄養摂取に関する基本情報"' : ''}
}
`;

        // 6. モデルを呼び出してレシピを生成
        const result = await model.invoke(recipePrompt);

        // 7. 結果をJSONに変換して返す
        try {
            // レスポンスからJSONを抽出
            const content = result.content.toString();
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                content.match(/```\n([\s\S]*?)\n```/) ||
                content.match(/{[\s\S]*}/);

            let jsonContent = '';
            if (jsonMatch) {
                jsonContent = jsonMatch[1] || jsonMatch[0];
            } else {
                jsonContent = content;
            }

            const recipes = JSON.parse(jsonContent);

            // 検索メタデータを取得（存在する場合）
            const searchMetadata = result.response_metadata?.groundingMetadata;

            // レスポンスを構築
            const response = {
                ...recipes,
                is_first_time_user: isFirstTimeUser,
                search_metadata: searchMetadata ? {
                    queries: searchMetadata.webSearchQueries || [],
                    sources: (searchMetadata.groundingChunks || []).map((chunk: any) =>
                        chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null
                    ).filter(Boolean)
                } : null
            };

            return NextResponse.json(response);
        } catch (parseError) {
            console.error('Error parsing recipe result:', parseError);
            return NextResponse.json(
                {
                    error: 'レシピデータの解析に失敗しました',
                    raw_response: result.content.toString()
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