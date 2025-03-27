import { AIServiceV2 } from './ai-service';
import { GeminiService } from './gemini-service';

/**
 * AI種類
 */
export enum AIServiceType {
    GEMINI = 'gemini',
    MOCK = 'mock' // テスト用モック
}

/**
 * AIサービスのファクトリクラス
 */
export class AIServiceFactory {
    private static instances: Map<AIServiceType, AIServiceV2> = new Map();

    /**
     * AIサービスのインスタンスを取得
     */
    static getService(type: AIServiceType = AIServiceType.GEMINI): AIServiceV2 {
        if (!this.instances.has(type)) {
            switch (type) {
                case AIServiceType.GEMINI:
                    this.instances.set(type, new GeminiService());
                    break;
                case AIServiceType.MOCK:
                    // TODO: モックサービスの実装
                    throw new Error('モックサービスは未実装です');
                default:
                    throw new Error(`未知のAIサービスタイプ: ${type}`);
            }
        }

        return this.instances.get(type)!;
    }

    /**
     * インスタンスを強制的に再作成
     */
    static recreateService(type: AIServiceType = AIServiceType.GEMINI, config?: any): AIServiceV2 {
        switch (type) {
            case AIServiceType.GEMINI:
                this.instances.set(type, new GeminiService(config));
                break;
            case AIServiceType.MOCK:
                // TODO: モックサービスの実装
                throw new Error('モックサービスは未実装です');
            default:
                throw new Error(`未知のAIサービスタイプ: ${type}`);
        }

        return this.instances.get(type)!;
    }
} 