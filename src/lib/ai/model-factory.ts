import { GoogleGenerativeAI } from '@google/generative-ai';
import { createImageContent } from '@/lib/utils/image-utils';

// モデル設定オプションの型定義
export interface ModelOptions {
    temperature?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
}

// AIモデルのインターフェース
export interface AIModel {
    invoke(prompt: string): Promise<{
        content: string;
        toString: () => string;
    }>;
    invokeWithImageData?(prompt: string, imageData: string): Promise<{
        content: string;
        toString: () => string;
    }>;
}

/**
 * AI モデルファクトリークラス
 * すべてのAIモデル作成を一元管理
 */
export class AIModelFactory {
    /**
     * テキスト処理モデルを作成
     */
    static createTextModel(options: ModelOptions = {}): AIModel {
        return this.createBaseModel('gemini-2.0-flash-001', options);
    }

    /**
     * 画像処理モデルを作成
     */
    static createVisionModel(options: ModelOptions = {}): AIModel {
        return this.createBaseModel('gemini-2.0-flash-001', options);
    }

    /**
     * 基本モデル作成ロジック
     */
    private static createBaseModel(modelName: string, options: ModelOptions = {}): AIModel {
        // APIキーの取得
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY環境変数が設定されていません");
        }

        // Gemini APIクライアントの初期化
        const genAI = new GoogleGenerativeAI(apiKey);

        // モデルの取得
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: options.temperature ?? 0.2,
                maxOutputTokens: options.maxOutputTokens ?? 1024,
                topK: options.topK ?? 32,
                topP: options.topP ?? 0.95,
            },
        });

        // AIModelインターフェースに適合したオブジェクトを返す
        return {
            // テキスト入力用invoke
            invoke: async (prompt: string) => {
                const result = await model.generateContent(prompt);
                return {
                    content: result.response.text(),
                    toString: () => result.response.text()
                };
            },

            // 画像入力用invokeWithImageData
            invokeWithImageData: async (prompt: string, imageData: string) => {
                const imageContent = createImageContent(imageData);

                const result = await model.generateContent({
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: prompt },
                                { inlineData: imageContent }
                            ]
                        }
                    ]
                });

                return {
                    content: result.response.text(),
                    toString: () => result.response.text()
                };
            }
        };
    }
} 