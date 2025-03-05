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

/**
 * プロンプトバージョン管理クラス
 */
export class PromptVersionManager {
    private static instance: PromptVersionManager;
    private promptRegistry: Map<string, PromptMetadata> = new Map();

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
            // プロンプトファイルを動的にインポート
            // 注: この部分は実際の実装で調整が必要
            const promptModule = require(`./templates/${promptId}/${targetVersion}.ts`);
            return promptModule.default || promptModule.template;
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