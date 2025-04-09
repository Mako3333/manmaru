import { AIModelFactory, ModelOptions } from '@/lib/ai/core/ai-model-factory'; // Check if this path is correct
// Import AppError from the re-export in index.ts
import { AppError, ErrorCode, AnyErrorCode } from '@/lib/error';

// AIモデルサービスインターフェース（オプション）
export interface IAIModelService {
    invokeText(prompt: string, options?: ModelOptions): Promise<string>;
    invokeVision(prompt: string, imageBase64: string, options?: ModelOptions): Promise<string>;
}

export class AIModelService implements IAIModelService {
    constructor() {
        // Remove the instantiation
        // this.modelFactory = AIModelFactory.getInstance();
    }

    /**
     * テキスト生成モデルを呼び出す
     */
    async invokeText(prompt: string, options: ModelOptions = { temperature: 0.7 }): Promise<string> {
        // Call statically
        const model = AIModelFactory.createTextModel(options);
        try {
            const response = await model.invoke(prompt);
            return response.content;
        } catch (error) {
            console.error('AIModelService: invokeTextエラー:', error);
            throw this.handleAIError(error, 'テキストモデル呼び出し');
        }
    }

    /**
     * 画像認識モデルを呼び出す
     */
    async invokeVision(prompt: string, imageBase64: string, options: ModelOptions = { temperature: 0.1 }): Promise<string> {
        // Call statically
        const model = AIModelFactory.createVisionModel(options);
        try {
            if (!model.invokeWithImageData) {
                // Use AppError with appropriate AI error code
                throw new AppError({
                    code: ErrorCode.AI.MODEL_ERROR,
                    message: 'Visionモデルが画像データをサポートしていません (invokeWithImageData method missing)'
                });
            }
            const response = await model.invokeWithImageData(prompt, imageBase64);
            return response.content;
        } catch (error) {
            console.error('AIModelService: invokeVisionエラー:', error);
            throw this.handleAIError(error, '画像モデル呼び出し');
        }
    }

    /**
     * AIモデル呼び出し時の共通エラーハンドリング（基本的な変換）
     * @returns AppError (since we are using the base error class)
     */
    private handleAIError(error: unknown, context: string): AppError { // Return type changed to AppError
        // Re-throw if already an instance of AppError or structured like AppError
        // Using instanceof AppError now
        if (error instanceof AppError) {
            // console.warn("Re-throwing existing AppError from handleAIError");
            throw error;
        }
        // Added a check for AppError-like structure just in case instanceof fails across realms, though less likely here.
        else if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
            // Attempt to re-wrap in AppError to ensure correct prototype chain? Or just throw?
            // For now, re-throwing as is, assuming it's compatible enough.
            console.warn("Re-throwing object with AppError structure");
            throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        let errorCode: AnyErrorCode = ErrorCode.AI.MODEL_ERROR; // Default AI model error

        // Map error messages to appropriate ErrorCodes
        if (errorMessage.includes('timeout') || errorMessage.includes('DEADLINE_EXCEEDED')) {
            errorCode = ErrorCode.Base.NETWORK_ERROR;
        } else if (errorMessage.includes('quota') || errorMessage.includes('QUOTA_EXCEEDED')) {
            errorCode = ErrorCode.Resource.QUOTA_EXCEEDED;
        } else if (errorMessage.includes('network') || errorMessage.includes('UNAVAILABLE')) {
            errorCode = ErrorCode.Base.NETWORK_ERROR;
        } else if (errorMessage.includes('permission') || errorMessage.includes('content_blocked') || errorMessage.includes('CONTENT_FILTER')) {
            errorCode = ErrorCode.AI.ANALYSIS_FAILED;
        } else if (errorMessage.includes('Invalid image')) {
            errorCode = ErrorCode.File.INVALID_IMAGE;
        }

        // Create and return a new AppError instance
        return new AppError({
            code: errorCode,
            message: `${context}中にエラーが発生しました: ${errorMessage}`,
            originalError: error instanceof Error ? error : new Error(String(error))
        });
    }
}
