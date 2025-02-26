import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

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
export interface GeminiModelOptions {
    temperature?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
}

// Geminiモデルの作成
export const createGeminiModel = (modelName: string = "gemini-2.0-flash-001", options = {}) => {
    return new ChatGoogleGenerativeAI({
        apiKey: getGeminiApiKey(),
        model: modelName,
        ...options
    });
};

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