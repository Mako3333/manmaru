import { GeminiService } from './services/gemini-service';
// import { parseCookies } from 'nookies'; // 削除済み
import { type IAIService } from './ai-service.interface';
// import { OpenAIChatService } from './openai-chat-service'; // 削除
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';

/**
 * AI種類
 */
export enum AIServiceType {
    GEMINI = 'gemini',
    MOCK = 'mock' // テスト用モック
}

/**
 * AI設定の型定義
 */
export interface AIServiceConfig {
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: string | number | boolean | undefined;
}

/**
 * AIサービスのファクトリクラス
 * GeminiServiceのような具体的な実装クラスのインスタンスを生成・管理する
 */
export class AIServiceFactory {
    private static instances: Map<AIServiceType, IAIService> = new Map();

    /**
     * AIサービスのインスタンスを取得
     * デフォルトは Gemini
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
                    throw new AppError({ code: ErrorCode.Base.UNKNOWN_ERROR, message: 'モックサービスは未実装です' });
                default:
                    // 未知のタイプが指定された場合、エラーを投げるか、デフォルト（Gemini）にフォールバックする
                    // ここではエラーを投げる
                    console.error(`Unknown AI service type requested: ${type}`);
                    throw new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: `未知のAIサービスタイプ: ${type}` });
            }
            this.instances.set(type, instance);
        }

        return this.instances.get(type)!;
    }

    /**
     * インスタンスを強制的に再作成
     * デフォルトは Gemini
     */
    static recreateService(type: AIServiceType = AIServiceType.GEMINI, config?: AIServiceConfig): IAIService {
        let instance: IAIService;
        switch (type) {
            case AIServiceType.GEMINI:
                instance = new GeminiService(config);
                break;
            case AIServiceType.MOCK:
                // TODO: モックサービスの実装 (IAIService を実装する)
                // instance = new MockAIService(config);
                throw new AppError({ code: ErrorCode.Base.UNKNOWN_ERROR, message: 'モックサービスは未実装です' });
            default:
                console.error(`Unknown AI service type requested for recreation: ${type}`);
                throw new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: `未知のAIサービスタイプ: ${type}` });
        }
        this.instances.set(type, instance);

        return instance;
    }

    // テスト用に instances マップをクリアするメソッド (必要であれば)
    static clearInstancesForTesting(): void {
        this.instances.clear();
    }
} 