// src/lib/ai/ai-service.interface.ts
import { PromptType } from '@/lib/ai/prompts/prompt-service';
import {
    NutritionAdviceResult,
    MealAnalysisResult,
    RecipeAnalysisResult,
} from '@/types/ai';
import { GeminiParseResult } from '@/lib/ai/gemini-response-parser';
// GeminiProcessResult の具体的な型は実装ファイル (gemini-service.ts) で定義されているため、
// インターフェースでは汎用的な型か any を使用します。

// TODO: 各メソッドの戻り値を、実装に依存しない汎用的な型に置き換えることを検討
// 例: interface RecipeParseResult { title: string; servings: string; foods: any[] }
// 例: interface MealAnalysisResult { foods: any[]; confidence: number; error?: string }

// interface RecipeParseAIResult {
//     title?: string;
//     servings?: string;
//     foods: { foodName: string; quantityText: string }[];
//     // 他に必要なプロパティがあれば追加
// }

// interface MealAnalysisAIResult {
//     foods: { foodName: string; quantityText: string }[];
//     // 他に必要なプロパティがあれば追加
// }

// interface GeminiError { // 必要に応じて詳細化
//     code: string;
//     message: string;
//     details?: any;
// }

// interface GeminiParseRecipeResult {
//     parseResult: RecipeParseAIResult | null;
//     error: GeminiError | null;
// }

export interface IAIService {
    /**
     * 食事画像から食品と栄養情報を解析
     */
    analyzeMealImage(imageData: Buffer): Promise<MealAnalysisResult>;

    /**
     * テキスト入力から食品と栄養情報を解析
     */
    analyzeMealText(text: string): Promise<MealAnalysisResult>;

    /**
     * レシピテキストから食品と栄養情報を解析
     * @deprecated parseRecipeFromUrl または analyzeMealText の利用を検討
     */
    analyzeRecipeText(recipeText: string): Promise<RecipeAnalysisResult>;

    /**
     * URLからレシピ情報を解析
     * @param url 解析対象のURL
     * @param htmlContent オプショナル。事前に取得したHTMLコンテンツ。提供された場合、内部でのfetchをスキップする。
     */
    parseRecipeFromUrl(url: string, htmlContent?: string): Promise<RecipeAnalysisResult>;

    /**
     * 栄養アドバイスを生成
     * TODO: 引数と戻り値の型をより具体的に定義
     * 引数に promptType: PromptType を追加
     */
    getNutritionAdvice(params: Record<string, any>, promptType: PromptType): Promise<NutritionAdviceResult>;

    // 他に AIService クラスにあったメソッドや、共通で必要なメソッドがあれば追加
    // 例: analyzeMeal?(image: string, mealType: string, trimester?: number): Promise<FoodAnalysisResult>;

    /**
     * @returns AIモデルの応答。
     */
    generateResponse(
        type: PromptType,
        context: Record<string, unknown>,
        options?: Record<string, unknown>,
    ): Promise<string>;
}