//src\lib\ai\prompts\prompt-service.ts
import { TemplateEngine } from './template-engine';
import { PromptVersionManager } from './version-manager';

// プロンプトID定義
export enum PromptType {
    FOOD_ANALYSIS = 'food-analysis',
    NUTRITION_ADVICE = 'nutrition-advice',
    TEXT_INPUT_ANALYSIS = 'text-input-analysis',
    // 将来的に追加するプロンプトタイプ
    RECIPE_RECOMMENDATION = 'recipe-recommendation'
}

/**
 * プロンプトサービスクラス
 * テンプレートの取得とレンダリングを行う
 */
export class PromptService {
    private static instance: PromptService;
    private versionManager: PromptVersionManager;

    private constructor() {
        this.versionManager = PromptVersionManager.getInstance();
        this.registerPromptTemplates();
    }

    /**
     * インスタンス取得
     */
    static getInstance(): PromptService {
        if (!PromptService.instance) {
            PromptService.instance = new PromptService();
        }
        return PromptService.instance;
    }

    /**
     * 食品分析プロンプト生成
     */
    generateFoodAnalysisPrompt(context: {
        mealType: string;
        trimester?: number;
    }): string {
        return this.generatePrompt(PromptType.FOOD_ANALYSIS, context);
    }

    /**
     * 栄養アドバイスプロンプト生成
     */
    generateNutritionAdvicePrompt(context: {
        pregnancyWeek: number;
        trimester: number;
        deficientNutrients: string[];
        formattedDate: string;
        currentSeason: string;
        isSummary?: boolean;  // オプショナル
        pastNutritionData?: Array<{
            date: string;
            overallScore: number;
            nutrients: {
                calories: { percentage: number };
                protein: { percentage: number };
                iron: { percentage: number };
                folic_acid: { percentage: number };
                calcium: { percentage: number };
                vitamin_d: { percentage: number };
            };
        }>;
    }): string {
        // デバッグ用ログを追加
        console.log('PromptService: 栄養アドバイスプロンプト生成', {
            pregnancyWeek: context.pregnancyWeek,
            hasPastData: !!context.pastNutritionData && context.pastNutritionData.length > 0,
            pastDataCount: context.pastNutritionData?.length || 0
        });

        return this.generatePrompt(PromptType.NUTRITION_ADVICE, context);
    }

    /**
     * テキスト入力分析プロンプト生成
     */
    generateTextInputAnalysisPrompt(context: {
        foodsText: string;
    }): string {
        return this.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, context);
    }

    /**
     * 汎用プロンプト生成メソッド
     */
    generatePrompt(promptType: PromptType, context: Record<string, any>, version?: string): string {
        // テンプレート取得
        const template = this.versionManager.getPromptTemplate(promptType, version);

        if (!template) {
            throw new Error(`プロンプトテンプレートが見つかりません: ${promptType}, バージョン: ${version || 'デフォルト'}`);
        }

        // テンプレートレンダリング
        return TemplateEngine.render(template, context);
    }

    /**
     * プロンプトテンプレート登録
     * 初期化時に実行される
     */
    private registerPromptTemplates(): void {
        // 食品分析
        const foodAnalysisV1 = require('./templates/food-analysis/v1');
        this.versionManager.registerPrompt({
            id: PromptType.FOOD_ANALYSIS,
            name: '食品分析',
            description: '食事写真から食品を識別するプロンプト',
            category: '栄養分析',
            versions: [foodAnalysisV1.metadata],
            parameters: ['mealType', 'trimester'],
            defaultVersion: 'v1'
        });

        // 栄養アドバイス
        const nutritionAdviceV1 = require('./templates/nutrition-advice/v1');
        this.versionManager.registerPrompt({
            id: PromptType.NUTRITION_ADVICE,
            name: '栄養アドバイス',
            description: '妊婦向け栄養アドバイス生成',
            category: '栄養アドバイス',
            versions: [nutritionAdviceV1.metadata],
            parameters: ['pregnancyWeek', 'trimester', 'deficientNutrients', 'isSummary', 'formattedDate', 'currentSeason'],
            defaultVersion: 'v1'
        });

        // テキスト入力分析
        const textInputAnalysisV1 = require('./templates/text-input-analysis/v1');
        this.versionManager.registerPrompt({
            id: PromptType.TEXT_INPUT_ANALYSIS,
            name: 'テキスト入力分析',
            description: '食事テキスト入力の解析と正規化',
            category: '栄養分析',
            versions: [textInputAnalysisV1.metadata],
            parameters: ['foodsText'],
            defaultVersion: 'v1'
        });

        // レシピ推薦
        try {
            const recipeRecommendationV1 = require('./templates/recipe-recommendation/v1');
            this.versionManager.registerPrompt({
                id: PromptType.RECIPE_RECOMMENDATION,
                name: 'レシピ推薦',
                description: '妊婦向けレシピ推薦生成',
                category: '栄養アドバイス',
                versions: [recipeRecommendationV1.metadata],
                parameters: ['pregnancyWeek', 'trimester', 'deficientNutrients', 'excludeIngredients', 'servings', 'isFirstTimeUser', 'formattedDate', 'currentSeason'],
                defaultVersion: 'v1'
            });
        } catch (error) {
            console.error('レシピ推薦プロンプトの登録に失敗しました:', error);
        }
    }
} 