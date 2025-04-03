// src/lib/ai/ai-service.interface.ts
import { FoodAnalysisResult, NutritionAdviceResult, FoodInput } from '@/types/ai';
// GeminiProcessResult の具体的な型は実装ファイル (gemini-service.ts) で定義されているため、
// インターフェースでは汎用的な型か any を使用します。

// TODO: 各メソッドの戻り値を、実装に依存しない汎用的な型に置き換えることを検討
// 例: interface RecipeParseResult { title: string; servings: string; foods: any[] }
// 例: interface MealAnalysisResult { foods: any[]; confidence: number; error?: string }

export interface IAIService {
    /**
     * 食事画像から食品と栄養情報を解析
     */
    analyzeMealImage(imageData: Buffer): Promise<any>; // Promise<MealAnalysisResult | GeminiProcessResult>;

    /**
     * テキスト入力から食品と栄養情報を解析
     */
    analyzeMealText(text: string): Promise<any>; // Promise<MealAnalysisResult | GeminiProcessResult>;

    /**
     * レシピテキストから食品と栄養情報を解析
     */
    analyzeRecipeText(recipeText: string): Promise<any>; // Promise<RecipeParseResult | GeminiProcessResult>;

    /**
     * URLからレシピ情報を解析
     */
    parseRecipeFromUrl(url: string): Promise<any>; // Promise<RecipeParseResult | GeminiProcessResult>;

    /**
     * 栄養アドバイスを生成
     * TODO: 引数と戻り値の型をより具体的に定義
     */
    getNutritionAdvice(params: any): Promise<NutritionAdviceResult>;

    // 他に AIService クラスにあったメソッドや、共通で必要なメソッドがあれば追加
    // 例: analyzeMeal?(image: string, mealType: string, trimester?: number): Promise<FoodAnalysisResult>;
}