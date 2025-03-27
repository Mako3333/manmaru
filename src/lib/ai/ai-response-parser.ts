import { FoodInputParseResult } from '@/lib/food/food-input-parser';

/**
 * AI応答解析結果
 */
export interface AIParseResult {
    /** 検出された食品リスト */
    foods: FoodInputParseResult[];
    /** 解析の確信度 */
    confidence: number;
    /** エラーメッセージ */
    error?: string;
    /** デバッグ情報 */
    debug?: any;
}

/**
 * AI応答パーサーのインターフェース
 */
export interface AIResponseParser {
    /**
     * AI応答テキストから食品リストを解析
     * @param responseText AI応答テキスト
     * @returns 解析結果
     */
    parseResponse(responseText: string): Promise<AIParseResult>;

    /**
     * AIモデルに送信するプロンプトを生成
     * @param inputData プロンプト生成に必要な入力データ
     * @returns プロンプトテキスト
     */
    generatePrompt(inputData: any): string;
} 