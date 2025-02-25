import { NextResponse } from "next/server";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createClient } from '@supabase/supabase-js';
import { createGeminiModel, GeminiModel } from "@/lib/langchain/langchain";

export async function POST(req: Request) {
    try {
        const { userId, servings = 2 } = await req.json();
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

        if (logError || !nutritionLog) {
            return NextResponse.json(
                { error: '栄養データが見つかりません' },
                { status: 404 }
            );
        }

        const deficientNutrients = nutritionLog.nutrition_data.deficient_nutrients || [];

        // 2. レシピ検索プロンプト
        const recipePrompt = PromptTemplate.fromTemplate(`
      あなたは妊婦向けの栄養士です。以下の栄養素が不足している妊婦に適したレシピを3つ提案してください。
      
      不足している栄養素: {deficient_nutrients}
      
      提案するレシピは以下の条件を満たすこと:
      - {servings}人分の分量
      - 調理時間30分以内
      - 一般的な食材を使用
      - 妊婦に安全な食材のみ使用
      
      以下のJSON形式で返してください:
      {{
        "recipes": [
          {{
            "title": "レシピ名",
            "ingredients": ["材料1", "材料2", ...],
            "steps": ["手順1", "手順2", ...],
            "nutrients": ["含まれる栄養素1", "含まれる栄養素2", ...],
            "preparation_time": "調理時間（分）"
          }}
        ]
      }}
    `);

        // 3. Gemini 2.0 Flashでレシピ生成
        const model = createGeminiModel(GeminiModel.FLASH);

        const chain = recipePrompt.pipe(model).pipe(new StringOutputParser());

        const result = await chain.invoke({
            deficient_nutrients: deficientNutrients.join(', '),
            servings: servings
        });

        // 4. 結果をJSONに変換して返す
        try {
            const recipes = JSON.parse(result);
            return NextResponse.json(recipes);
        } catch (parseError) {
            console.error('Error parsing recipe result:', parseError);
            return NextResponse.json(
                { error: 'レシピデータの解析に失敗しました', raw_response: result },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error recommending recipes:', error);
        return NextResponse.json(
            { error: 'レシピ提案中にエラーが発生しました' },
            { status: 500 }
        );
    }
} 