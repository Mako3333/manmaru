import { GeminiService } from './services/gemini-service';
import { IAIService } from './ai-service.interface';

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
    private static instances: Map<AIServiceType, IAIService> = new Map();

    /**
     * AIサービスのインスタンスを取得
     * 戻り値を IAIService に変更
     */
    static getService(type: AIServiceType = AIServiceType.GEMINI): IAIService {
        if (!this.instances.has(type)) {
            let instance: IAIService;
            switch (type) {
                case AIServiceType.GEMINI:
                    instance = new GeminiService();
                    break;
                case AIServiceType.MOCK:
                    // TODO: モックサービスの実装 (IAIService を実装する)
                    // instance = new MockAIService();
                    throw new Error('モックサービスは未実装です');
                default:
                    throw new Error(`未知のAIサービスタイプ: ${type}`);
            }
            this.instances.set(type, instance);
        }

        // getの戻り値は IAIService | undefined なので non-null assertion を使う
        // または、上のロジックで必ず set されるので型アサーションでも可
        return this.instances.get(type)!;
    }

    /**
     * インスタンスを強制的に再作成
     * 戻り値を IAIService に変更
     */
    static recreateService(type: AIServiceType = AIServiceType.GEMINI, config?: any): IAIService {
        let instance: IAIService;
        switch (type) {
            case AIServiceType.GEMINI:
                instance = new GeminiService(config);
                break;
            case AIServiceType.MOCK:
                // TODO: モックサービスの実装 (IAIService を実装する)
                // instance = new MockAIService(config);
                throw new Error('モックサービスは未実装です');
            default:
                throw new Error(`未知のAIサービスタイプ: ${type}`);
        }
        this.instances.set(type, instance);

        return instance;
    }
} 