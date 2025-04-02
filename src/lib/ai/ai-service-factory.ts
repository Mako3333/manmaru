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
 * GeminiServiceのような具体的な実装クラスのインスタンスを生成・管理する
 */
export class AIServiceFactory {
    private static instances: Map<AIServiceType, GeminiService> = new Map();

    /**
     * AIサービスのインスタンスを取得
     * 戻り値を GeminiService に変更
     */
    static getService(type: AIServiceType = AIServiceType.GEMINI): GeminiService {
        if (!this.instances.has(type)) {
            switch (type) {
                case AIServiceType.GEMINI:
                    this.instances.set(type, new GeminiService());
                    break;
                case AIServiceType.MOCK:
                    // TODO: モックサービスの実装
                    // モックサービスも GeminiService と同じインターフェースを持つようにする想定
                    throw new Error('モックサービスは未実装です');
                default:
                    throw new Error(`未知のAIサービスタイプ: ${type}`);
            }
        }

        return this.instances.get(type)!;
    }

    /**
     * インスタンスを強制的に再作成
     * 戻り値を GeminiService に変更
     */
    static recreateService(type: AIServiceType = AIServiceType.GEMINI, config?: any): GeminiService {
        switch (type) {
            case AIServiceType.GEMINI:
                // GeminiServiceのコンストラクタが config を受け取るように修正されている前提
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