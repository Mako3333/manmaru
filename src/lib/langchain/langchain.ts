import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import dotenv from 'dotenv';

// dotenvの設定を読み込む
dotenv.config();

// GEMINI APIキーの取得
const getGeminiApiKey = (): string => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY環境変数が設定されていません");
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

// LangChain Geminiモデルを作成
export const createGeminiModel = (
    modelName: GeminiModel,
    options: GeminiModelOptions = {}
) => {
    return new ChatGoogleGenerativeAI({
        apiKey: getGeminiApiKey(),
        modelName: modelName,
        maxOutputTokens: options.maxOutputTokens,
        temperature: options.temperature,
        topK: options.topK,
        topP: options.topP,
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ],
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

// 画像コンテンツの作成ヘルパー関数
export const createImageContent = (base64Image: string) => {
    return {
        type: "image_url",
        image_url: {
            url: `data:image/jpeg;base64,${base64Image}`
        }
    };
};