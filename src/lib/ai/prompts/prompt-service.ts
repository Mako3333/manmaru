//src\lib\ai\prompts\prompt-service.ts
import { TemplateEngine } from './template-engine';
import { PromptVersionManager } from './version-manager';
import { AppError, ErrorCode } from '@/lib/error';

// 静的インポートを追加
import * as foodAnalysisV1 from './templates/food-analysis/v1';
import * as nutritionAdviceV1 from './templates/nutrition-advice/v1';
import * as textInputAnalysisV1 from './templates/text-input-analysis/v1';
import * as recipeUrlAnalysisV1 from './templates/recipe-url-analysis/v1';
import * as nutritionTipsV1 from './templates/nutrition-tips/v1';
// import * as recipeRecommendationV1 from './templates/recipe-recommendation/v1'; // 必要ならコメント解除

/**
 * プロンプト種別
 */
export enum PromptType {
    /** 食事画像解析用 */
    FOOD_ANALYSIS = 'food-analysis',
    /** 栄養アドバイス生成用 */
    NUTRITION_ADVICE = 'nutrition-advice',
    /** レシピ推薦用 */
    RECIPE_RECOMMENDATION = 'recipe-recommendation',
    /** テキスト入力解析用 */
    TEXT_INPUT_ANALYSIS = 'text-input-analysis',
    /** URLからのレシピ解析用 (新規追加) */
    RECIPE_URL_ANALYSIS = 'recipe-url-analysis',
    /** 栄養Tips生成用 (3食記録後) */
    NUTRITION_TIPS = 'nutrition-tips'
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
    async generateFoodAnalysisPrompt(context: {
        mealType: string;
        trimester?: number;
    }): Promise<string> {
        return this.generatePrompt(PromptType.FOOD_ANALYSIS, context);
    }

    /**
     * 栄養アドバイスプロンプト生成
     */
    async generateNutritionAdvicePrompt(context: {
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
    }): Promise<string> {
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
    async generateTextInputAnalysisPrompt(context: {
        foodsText: string;
    }): Promise<string> {
        return this.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, context);
    }

    /**
     * 汎用プロンプト生成メソッド
     */
    async generatePrompt(
        type: PromptType,
        context: Record<string, unknown>,
        version?: string
    ): Promise<string> {
        // テンプレート取得
        const template = this.versionManager.getPromptTemplate(type, version);

        if (!template) {
            throw new AppError({
                code: ErrorCode.Base.DATA_NOT_FOUND,
                message: `Prompt template not found: ${type}, version: ${version || 'default'}`,
                userMessage: 'プロンプトテンプレートの読み込みに失敗しました。システム設定を確認してください。',
                details: { type, version }
            });
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
        // const foodAnalysisV1 = require('./templates/food-analysis/v1'); // require を削除
        this.versionManager.registerPrompt({
            id: PromptType.FOOD_ANALYSIS,
            name: '食品分析',
            description: '食事写真から食品を識別するプロンプト',
            category: '栄養分析',
            versions: [
                {
                    ...foodAnalysisV1.metadata,
                    createdAt: new Date(foodAnalysisV1.metadata.createdAt),
                    updatedAt: new Date(foodAnalysisV1.metadata.updatedAt),
                }
            ],
            parameters: ['mealType', 'trimester'],
            defaultVersion: 'v1'
        });

        // 栄養アドバイス
        // const nutritionAdviceV1 = require('./templates/nutrition-advice/v1'); // require を削除
        this.versionManager.registerPrompt({
            id: PromptType.NUTRITION_ADVICE,
            name: '栄養アドバイス',
            description: '妊婦向け栄養アドバイス生成',
            category: '栄養アドバイス',
            versions: [
                {
                    ...nutritionAdviceV1.metadata,
                    createdAt: new Date(nutritionAdviceV1.metadata.createdAt),
                    updatedAt: new Date(nutritionAdviceV1.metadata.updatedAt),
                }
            ],
            parameters: ['pregnancyWeek', 'trimester', 'deficientNutrients', 'isSummary', 'formattedDate', 'currentSeason'],
            defaultVersion: 'v1'
        });

        // テキスト入力分析
        // const textInputAnalysisV1 = require('./templates/text-input-analysis/v1'); // require を削除
        this.versionManager.registerPrompt({
            id: PromptType.TEXT_INPUT_ANALYSIS,
            name: 'テキスト入力分析',
            description: '食事テキスト入力の解析と正規化',
            category: '栄養分析',
            versions: [
                {
                    ...textInputAnalysisV1.metadata,
                    createdAt: new Date(textInputAnalysisV1.metadata.createdAt),
                    updatedAt: new Date(textInputAnalysisV1.metadata.updatedAt),
                }
            ],
            parameters: ['foodsText'],
            defaultVersion: 'v1'
        });

        // レシピ推薦 (一時的にコメントアウト)
        /*
        try {
            // const recipeRecommendationV1 = require('./templates/recipe-recommendation/v1'); // require を削除
            this.versionManager.registerPrompt({
                id: PromptType.RECIPE_RECOMMENDATION,
                name: 'レシピ推薦',
                description: 'ユーザーの過去データに基づいたレシピ推薦プロンプト',
                category: 'レシピ',
                versions: [
                    {
                        ...recipeRecommendationV1.metadata,
                        createdAt: new Date(recipeRecommendationV1.metadata.createdAt),
                        updatedAt: new Date(recipeRecommendationV1.metadata.updatedAt),
                    }
                ],
                parameters: ['pastNutritionData', 'deficientNutrients', 'userPreferences'], // 例
                defaultVersion: 'v1'
            });
            console.log('[PromptService] Recipe Recommendation prompt registered.');
        } catch (error) {
            console.error('レシピ推薦プロンプトの登録に失敗しました:', error);
        }
        */

        // URLレシピ解析 (新規追加)
        try {
            // const recipeUrlAnalysisV1 = require('./templates/recipe-url-analysis/v1'); // require を削除
            this.versionManager.registerPrompt({
                id: PromptType.RECIPE_URL_ANALYSIS,
                name: 'URLレシピ解析',
                description: 'URLからレシピ情報を抽出するプロンプト',
                category: 'レシピ解析',
                versions: [
                    {
                        ...recipeUrlAnalysisV1.metadata,
                        createdAt: new Date(recipeUrlAnalysisV1.metadata.createdAt),
                        updatedAt: new Date(recipeUrlAnalysisV1.metadata.updatedAt),
                    }
                ],
                parameters: ['recipeContent'], // テンプレートの変数名に合わせる
                defaultVersion: 'v1'
            });
        } catch (error) {
            console.error('URLレシピ解析プロンプトの登録に失敗しました:', error);
        }

        // 栄養Tips (3食記録後)
        try {
            // const nutritionTipsV1 = require('./templates/nutrition-tips/v1'); // require を削除
            this.versionManager.registerPrompt({
                id: PromptType.NUTRITION_TIPS,
                name: '栄養Tips',
                description: '3食記録後のTips生成プロンプト',
                category: '栄養アドバイス',
                versions: [
                    {
                        ...nutritionTipsV1.metadata,
                        createdAt: new Date(nutritionTipsV1.metadata.createdAt),
                        updatedAt: new Date(nutritionTipsV1.metadata.updatedAt),
                    }
                ],
                // テンプレート内で使用する変数を列挙
                parameters: ['pregnancyWeek', 'trimester', 'formattedDate', 'currentSeason', 'pastNutritionData'],
                defaultVersion: 'v1'
            });
            console.log('[PromptService] Nutrition Tips prompt registered.');
        } catch (error) {
            console.error('栄養Tipsプロンプトの登録に失敗しました:', error);
        }
    }
} 