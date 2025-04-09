/**
 * プロンプトのバージョン情報
 */
export interface PromptVersion {
    id: string;
    version: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    changelog?: string;
}

/**
 * プロンプトのメタデータ
 */
export interface PromptMetadata {
    id: string;
    name: string;
    description: string;
    category: string;
    versions: PromptVersion[];
    parameters: string[];
    defaultVersion: string;
}

// 静的インポートを追加 (prompt-service.ts と同様)
import * as foodAnalysisV1 from './templates/food-analysis/v1';
import * as nutritionAdviceV1 from './templates/nutrition-advice/v1';
import * as textInputAnalysisV1 from './templates/text-input-analysis/v1';
import * as recipeUrlAnalysisV1 from './templates/recipe-url-analysis/v1';
import * as nutritionTipsV1 from './templates/nutrition-tips/v1';
// import * as recipeRecommendationV1 from './templates/recipe-recommendation/v1'; // 必要ならコメント解除

// PromptType をインポート
import { PromptType } from './prompt-service';

/**
 * プロンプトバージョン管理クラス
 */
export class PromptVersionManager {
    private static instance: PromptVersionManager;
    private promptRegistry: Map<string, PromptMetadata> = new Map();

    // インポートしたテンプレートを保持するマップを追加
    private templates: Record<string, Record<string, any>> = {
        [PromptType.FOOD_ANALYSIS]: { 'v1': foodAnalysisV1 },
        [PromptType.NUTRITION_ADVICE]: { 'v1': nutritionAdviceV1 },
        [PromptType.TEXT_INPUT_ANALYSIS]: { 'v1': textInputAnalysisV1 },
        [PromptType.RECIPE_URL_ANALYSIS]: { 'v1': recipeUrlAnalysisV1 },
        [PromptType.NUTRITION_TIPS]: { 'v1': nutritionTipsV1 },
        // [PromptType.RECIPE_RECOMMENDATION]: { 'v1': recipeRecommendationV1 }, // 必要ならコメント解除
    };

    private constructor() {
        // シングルトンパターン
    }

    /**
     * インスタンス取得
     */
    static getInstance(): PromptVersionManager {
        if (!PromptVersionManager.instance) {
            PromptVersionManager.instance = new PromptVersionManager();
        }
        return PromptVersionManager.instance;
    }

    /**
     * プロンプトメタデータを登録
     */
    registerPrompt(metadata: PromptMetadata): void {
        this.promptRegistry.set(metadata.id, metadata);
    }

    /**
     * プロンプトメタデータを取得
     */
    getPromptMetadata(promptId: string): PromptMetadata | undefined {
        return this.promptRegistry.get(promptId);
    }

    /**
     * アクティブなプロンプトバージョンを取得
     */
    getActiveVersion(promptId: string): PromptVersion | undefined {
        const metadata = this.getPromptMetadata(promptId);
        if (!metadata) return undefined;

        // アクティブバージョンを検索
        return metadata.versions.find(v => v.isActive);
    }

    /**
     * 指定バージョンのプロンプトテンプレートを取得
     */
    getPromptTemplate(promptId: string, version?: string): string | undefined {
        const metadata = this.getPromptMetadata(promptId);
        if (!metadata) return undefined;

        // バージョン指定がない場合はアクティブバージョンを使用
        const targetVersion = version ||
            metadata.versions.find(v => v.isActive)?.version ||
            metadata.defaultVersion;

        try {
            // require を削除し、インポート済みのマップから取得
            // const promptModule = require(`./templates/${promptId}/${targetVersion}.ts`);
            const promptModule = this.templates[promptId]?.[targetVersion];
            return promptModule?.default || promptModule?.template;
        } catch (error) {
            console.error(`プロンプトテンプレートの読み込みに失敗: ${promptId}/${targetVersion}`, error);
            return undefined;
        }
    }

    /**
     * 全登録プロンプトのメタデータリストを取得
     */
    getAllPrompts(): PromptMetadata[] {
        return Array.from(this.promptRegistry.values());
    }

    /**
     * カテゴリ別プロンプトリスト取得
     */
    getPromptsByCategory(category: string): PromptMetadata[] {
        return this.getAllPrompts().filter(p => p.category === category);
    }
} 