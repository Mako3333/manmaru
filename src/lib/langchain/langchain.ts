import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// GEMINI APIキーの取得
const getGeminiApiKey = (): string => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEYまたはGOOGLE_API_KEY環境変数が設定されていません");
    }
    return apiKey;
};

// Geminiモデルの種類を定義
export enum GeminiModel {
    PRO = "gemini-pro",
    VISION = "gemini-pro-vision",
    FLASH = "gemini-2.0-flash-001" // 正しいGemini 2.0 Flashモデル名
}

// Geminiモデルの設定オプション
interface GeminiModelOptions {
    temperature?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
}

/**
 * Geminiモデルを作成する関数
 * @param modelName モデル名（例: "gemini-2.0-pro", "gemini-2.0-pro-vision"）
 * @param options モデルオプション
 * @returns Geminiモデルインスタンス
 */
export function createGeminiModel(modelName: string, options: GeminiModelOptions = {}) {
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
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 2048,
            topK: options.topK ?? 40,
            topP: options.topP ?? 0.95,
        },
    });

    // モデルをラップして、invokeメソッドを追加
    return {
        ...model,
        // テキスト入力用のinvokeメソッド
        invoke: async (prompt: string) => {
            const result = await model.generateContent(prompt);
            return {
                content: result.response.text(),
                toString: () => result.response.text()
            };
        },
        // 画像入力用のinvokeメソッド
        invokeWithImageData: async (data: any) => {
            const result = await model.generateContent(data);
            return {
                content: result.response.text(),
                toString: () => result.response.text()
            };
        }
    };
}

// 画像変換ユーティリティ
export async function imageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = reader.result as string;
            // data:image/jpeg;base64, の部分を削除
            resolve(base64String.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
}

// 画像コンテンツの作成
export const createImageContent = (base64Image: string) => {
    // データURLプレフィックスがない場合は追加
    const dataUrl = base64Image.startsWith('data:')
        ? base64Image
        : `data:image/jpeg;base64,${base64Image}`;

    return {
        type: "image_url",
        image_url: { url: dataUrl }
    };
};

// マルチモーダルメッセージの作成
export const createMultiModalMessage = (text: string, base64Image: string) => {
    return new HumanMessage({
        content: [
            { type: "text", text },
            createImageContent(base64Image)
        ]
    });
};