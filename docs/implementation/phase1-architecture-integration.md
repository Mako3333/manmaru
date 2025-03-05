# フェーズ1: 基本アーキテクチャ統合実装手順

## 目標
- 統一されたAIモデルアクセスレイヤーの作成
- 共通エラーハンドリングシステムの構築
- 重複API (`analyze-meal`と`analyze-meal-langchain`) の統合

## タスク1: 共通AIモデルファクトリーの作成

### ステップ1.1: モデルファクトリークラスの実装
**ファイル**: `src/lib/ai/model-factory.ts`

```typescript
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
```

### ステップ1.2: 既存LangChainユーティリティを依存注入パターンに更新
**ファイル**: `src/lib/langchain/langchain.ts`

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIModel, ModelOptions } from "@/lib/ai/model-factory";

// 既存関数を新しいファクトリークラスに依存するように更新

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

// 以下、互換性のために古い関数を残す
// これらは徐々に新しいファクトリーに置き換える

/**
 * Geminiモデルを作成する関数 (非推奨、代わりにAIModelFactoryを使用)
 * @deprecated Use AIModelFactory.createTextModel or AIModelFactory.createVisionModel instead
 */
export function createGeminiModel(modelName: string, options: ModelOptions = {}) {
  console.warn("createGeminiModel は非推奨です。AIModelFactory を使用してください。");
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

// 画像変換ユーティリティなど、その他の既存関数は維持
// ...
```

## タスク2: 統一エラーハンドリングシステムの構築

### ステップ2.1: 基本エラークラス階層の実装
**ファイル**: `src/lib/errors/ai-error.ts`

```typescript
/**
 * AIエラーコード列挙型
 */
export enum ErrorCode {
  // 一般エラー
  UNKNOWN_ERROR = 'unknown_error',
  API_KEY_ERROR = 'api_key_error',
  NETWORK_ERROR = 'network_error',
  
  // AI関連エラー
  AI_MODEL_ERROR = 'ai_model_error',
  PROMPT_ERROR = 'prompt_error',
  RESPONSE_PARSE_ERROR = 'response_parse_error',
  
  // 食品分析特有エラー
  IMAGE_PROCESSING_ERROR = 'image_processing_error',
  FOOD_RECOGNITION_ERROR = 'food_recognition_error',
  
  // 栄養解析特有エラー
  NUTRITION_CALCULATION_ERROR = 'nutrition_calculation_error',
  
  // 入力検証エラー
  VALIDATION_ERROR = 'validation_error',
  
  // その他のアプリ特有エラー
  PREGNANCY_DATA_ERROR = 'pregnancy_data_error'
}

/**
 * 基本AIエラークラス
 * すべてのAI関連エラーのベースクラス
 */
export class AIError extends Error {
  public code: ErrorCode;
  public details: any;
  public suggestions: string[];
  
  constructor(
    message: string, 
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR, 
    details?: any,
    suggestions: string[] = []
  ) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.details = details;
    this.suggestions = suggestions;
    
    // エラーログ記録
    this.logError();
  }
  
  /**
   * JSON形式のエラー情報を返す
   */
  public toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        suggestions: this.suggestions
      }
    };
  }
  
  /**
   * エラー情報をログに記録
   */
  private logError() {
    console.error(`AIError [${this.code}]: ${this.message}`, this.details);
  }
}

/**
 * 食品分析特化エラー
 */
export class FoodAnalysisError extends AIError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.FOOD_RECOGNITION_ERROR,
    details?: any,
    suggestions: string[] = []
  ) {
    super(message, code, details, suggestions);
    this.name = 'FoodAnalysisError';
  }
}

/**
 * 栄養計算特化エラー
 */
export class NutritionError extends AIError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NUTRITION_CALCULATION_ERROR,
    details?: any,
    suggestions: string[] = []
  ) {
    super(message, code, details, suggestions);
    this.name = 'NutritionError';
  }
}

/**
 * エラーレスポンス生成関数
 */
export function createErrorResponse(error: AIError) {
  return {
    success: false,
    ...error.toJSON(),
    timestamp: new Date().toISOString()
  };
}
```

### ステップ2.2: エラーユーティリティヘルパー
**ファイル**: `src/lib/errors/error-utils.ts`

```typescript
import { NextResponse } from 'next/server';
import { AIError, ErrorCode, createErrorResponse } from './ai-error';

/**
 * API用のエラーハンドララッパー
 * @param fn API関数
 * @returns ラップされたAPI関数
 */
export function withErrorHandling(fn: Function) {
  return async (request: Request) => {
    try {
      // 元の関数を実行
      return await fn(request);
    } catch (error) {
      console.error('API Error:', error);
      
      // AIError型へ変換
      const aiError = error instanceof AIError 
        ? error 
        : new AIError(
            error instanceof Error ? error.message : '不明なエラーが発生しました',
            ErrorCode.UNKNOWN_ERROR,
            error
          );
      
      // エラーレスポンスを生成
      return NextResponse.json(
        createErrorResponse(aiError),
        { status: aiError.code.includes('validation') ? 400 : 500 }
      );
    }
  };
}

/**
 * APIキーチェック関数
 * @throws AIError if API key is missing
 */
export function checkApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIError(
      'API設定エラー',
      ErrorCode.API_KEY_ERROR,
      null,
      ['環境変数GEMINI_API_KEYを設定してください']
    );
  }
  return apiKey;
}
```

## タスク3: 重複API統合

### ステップ3.1: 統合された食事分析API実装
**ファイル**: `src/app/api/analyze-meal/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { z } from "zod";
import { AIModelFactory } from '@/lib/ai/model-factory';
import { AIError, ErrorCode } from '@/lib/errors/ai-error';
import { withErrorHandling, checkApiKey } from '@/lib/errors/error-utils';

// リクエストスキーマ
const requestSchema = z.object({
  image: z.string(),
  mealType: z.string()
});

// テストモード設定
const TEST_MODE = process.env.NODE_ENV === 'development';

/**
 * 食事写真の解析APIエンドポイント
 * Base64エンコードされた画像を受け取り、AI分析結果を返す
 */
async function analyzeMealHandler(request: Request) {
  console.log('API: リクエスト受信');
  
  // APIキーの確認
  checkApiKey();
  
  // リクエストボディの解析
  const body = await request.json();
  
  // スキーマ検証
  const validationResult = requestSchema.safeParse(body);
  if (!validationResult.success) {
    throw new AIError(
      'リクエスト形式が不正です',
      ErrorCode.VALIDATION_ERROR,
      validationResult.error,
      ['image: Base64エンコードされた画像データ', 'mealType: 食事タイプ']
    );
  }
  
  const { image, mealType } = validationResult.data;
  console.log(`API: 食事タイプ=${mealType}, 画像データ長=${image?.length || 0}`);
  
  // テストモードの場合はモックデータを返す
  if (TEST_MODE) {
    console.log('API: テストモード - モックデータを返します');
    await new Promise(resolve => setTimeout(resolve, 1500));
    return NextResponse.json(getMockData(mealType));
  }
  
  // プロンプト作成
  const prompt = `
    この食事の写真から含まれている食品を識別してください。
    食事タイプは「${mealType}」です。
    
    以下の形式でJSON形式で回答してください:
    {
      "foods": [
        {"name": "食品名", "quantity": "量の目安", "confidence": 信頼度(0.0-1.0)}
      ],
      "nutrition": {
        "calories": カロリー推定値,
        "protein": タンパク質(g),
        "iron": 鉄分(mg),
        "folic_acid": 葉酸(μg),
        "calcium": カルシウム(mg),
        "confidence_score": 信頼度(0.0-1.0)
      }
    }
    
    回答は必ずこのJSONフォーマットのみで返してください。
  `;
  
  // AIモデルの作成
  const model = AIModelFactory.createVisionModel({
    temperature: 0.1,
    maxOutputTokens: 1024
  });
  
  // モデル呼び出し
  console.log('API: Gemini API呼び出し');
  const aiResponse = await model.invokeWithImageData!(prompt, image);
  const responseText = aiResponse.toString();
  console.log('API: Gemini応答受信', responseText.substring(0, 100) + '...');
  
  // JSONレスポンスの抽出
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AIError(
      'AIからの応答を解析できませんでした',
      ErrorCode.RESPONSE_PARSE_ERROR,
      responseText
    );
  }
  
  // JSONパース
  try {
    const jsonResponse = JSON.parse(jsonMatch[0]);
    console.log('API: 解析成功', JSON.stringify(jsonResponse).substring(0, 100) + '...');
    return NextResponse.json(jsonResponse);
  } catch (parseError) {
    throw new AIError(
      'AIレスポンスのJSON解析に失敗しました',
      ErrorCode.RESPONSE_PARSE_ERROR,
      { error: parseError, text: jsonMatch[0] }
    );
  }
}

// エラーハンドリングでラップしたハンドラをエクスポート
export const POST = withErrorHandling(analyzeMealHandler);

// モックデータ関数は変更なし
function getMockData(mealType: string) {
  // 既存のモックデータ実装
  // ...
}
```

### ステップ3.2: LangChain版のAPI削除またはリダイレクト設定
**ファイル**: `src/app/api/analyze-meal-langchain/route.ts`

```typescript
import { NextResponse } from 'next/server';

/**
 * 互換性のためのリダイレクトハンドラ
 * @deprecated - このAPIは廃止予定です。代わりに /api/analyze-meal を使用してください
 */
export async function POST(request: Request) {
  console.log('リダイレクト: /api/analyze-meal-langchain から /api/analyze-meal へ');
  
  // 新しいURLを構築
  const url = new URL(request.url);
  const newUrl = new URL('/api/analyze-meal', url.origin);
  
  // リクエストボディを取得して転送
  const body = await request.json();
  
  // 新APIへのフェッチ
  const response = await fetch(newUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  // レスポンスをそのまま返す
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
```

## 検証方法

### 単体テスト
各コンポーネントの単体テストを作成し、正常に動作することを確認します。

```typescript
// モデルファクトリーのテスト例
describe('AIModelFactory', () => {
  test('createTextModel returns valid model', () => {
    const model = AIModelFactory.createTextModel();
    expect(model).toBeDefined();
    expect(model.invoke).toBeDefined();
  });
});
```

### 統合テスト
統合されたAPIエンドポイントのテストを実施し、以下を確認:

1. 正常な入力での応答が期待通りか
2. 不正な入力に対するエラーハンドリングが適切か
3. パフォーマンスが低下していないか

### 手動テスト
Postmanなどを使用してエンドポイントを手動テストし、以下を確認:

1. 画像アップロードと結果表示が正常に動作するか
2. エラーメッセージが適切に表示されるか
3. レスポンス時間が許容範囲内か

## 完了条件

- [ ] AIモデルファクトリーが実装され、テストに合格
- [ ] エラーハンドリングシステムが実装され、テストに合格
- [ ] 統合APIが実装され、すべての機能要件を満たす
- [ ] 古いAPIのリダイレクトが正常に動作
- [ ] すべての統合テストと手動テストに合格 