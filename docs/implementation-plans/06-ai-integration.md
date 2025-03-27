# フェーズ5: AI連携の改善

## 1. AI応答解析の抽象化と強化

### 1.1 AI応答パーサーインターフェース

```typescript
// src/lib/ai/ai-response-parser.ts を新規作成

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
```

### 1.2 OpenAI応答パーサー

```typescript
// src/lib/ai/openai-response-parser.ts を新規作成

import { AIResponseParser, AIParseResult } from './ai-response-parser';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';

/**
 * OpenAI APIの応答を解析するパーサー
 */
export class OpenAIResponseParser implements AIResponseParser {
  /**
   * AI応答テキストから食品リストを解析
   */
  async parseResponse(responseText: string): Promise<AIParseResult> {
    try {
      // デフォルトの結果（エラー時）
      const defaultResult: AIParseResult = {
        foods: [],
        confidence: 0,
        error: '応答の解析に失敗しました'
      };
      
      if (!responseText) {
        return defaultResult;
      }
      
      // JSONフォーマットの検出
      const jsonMatch = responseText.match(/```json([\s\S]*?)```|{[\s\S]*}/);
      if (!jsonMatch) {
        console.error('OpenAIResponseParser: JSON形式の応答が見つかりませんでした', responseText);
        return {
          ...defaultResult,
          debug: { rawResponse: responseText }
        };
      }
      
      // JSONテキストの抽出と解析
      let jsonText = jsonMatch[1] || jsonMatch[0];
      jsonText = jsonText.trim();
      
      // 最初と最後の波括弧がない場合、追加
      if (!jsonText.startsWith('{')) {
        jsonText = '{' + jsonText;
      }
      if (!jsonText.endsWith('}')) {
        jsonText = jsonText + '}';
      }
      
      let parsedData;
      try {
        parsedData = JSON.parse(jsonText);
      } catch (e) {
        console.error('OpenAIResponseParser: JSON解析エラー', e, jsonText);
        return {
          ...defaultResult,
          error: 'JSON解析エラー: ' + e.message,
          debug: { rawResponse: responseText, jsonText }
        };
      }
      
      // 期待される形式の確認
      if (!parsedData.foods || !Array.isArray(parsedData.foods)) {
        console.error('OpenAIResponseParser: 期待される形式ではありません', parsedData);
        return {
          ...defaultResult,
          error: '応答フォーマットエラー: foods配列がありません',
          debug: { parsedData }
        };
      }
      
      // 食品リストの変換
      const foods: FoodInputParseResult[] = parsedData.foods.map(item => {
        // 食品名と量の取得
        const foodName = item.name || item.food_name || '';
        const quantityText = item.quantity || item.amount || null;
        
        return {
          foodName,
          quantityText,
          confidence: item.confidence || 0.8 // AIの確信度（指定がなければデフォルト値）
        };
      });
      
      // 全体の確信度をメタデータから取得、または計算
      let confidence = parsedData.confidence || 0;
      if (confidence === 0 && foods.length > 0) {
        // 個々の食品の確信度の平均
        confidence = foods.reduce((sum, food) => sum + food.confidence, 0) / foods.length;
      }
      
      return {
        foods,
        confidence,
        debug: { parsedData }
      };
    } catch (error) {
      console.error('OpenAIResponseParser: 予期しないエラー', error);
      return {
        foods: [],
        confidence: 0,
        error: '解析中の予期しないエラー: ' + error.message
      };
    }
  }
  
  /**
   * AIモデルに送信するプロンプトを生成
   */
  generatePrompt(inputData: any): string {
    // 食品認識用のプロンプトテンプレート
    const promptTemplate = `
あなたは日本の妊婦向け栄養管理アプリの食品認識AIです。
以下の食事情報から含まれる食品を特定し、JSON形式で出力してください。

# 指示
1. 食事写真や説明から食品名と量を特定する
2. 各食品を最もシンプルな基本形で表現する（例: 「塩鮭の切り身」→「鮭」）
3. 量が明示されていない場合は推測せず、空のままにする
4. 下記のJSON形式で出力する

# 出力フォーマット
\`\`\`json
{
  "foods": [
    {
      "name": "食品名1",
      "quantity": "量（例: 100g、1個）",
      "confidence": 0.9
    },
    // 他の食品...
  ],
  "confidence": 0.85
}
\`\`\`

# 入力データ
${inputData.text || inputData.imageDescription || '入力情報なし'}

# 出力
`;

    return promptTemplate;
  }
}
```

## 2. AIサービスの改善

### 2.1 AIサービスインターフェース

```typescript
// src/lib/ai/ai-service.ts を修正

import { AIParseResult } from './ai-response-parser';

/**
 * AI処理結果
 */
export interface AIProcessResult {
  /** 解析結果 */
  parseResult: AIParseResult;
  /** 生のAI応答 */
  rawResponse: string;
  /** 処理時間（ミリ秒） */
  processingTimeMs: number;
  /** エラーメッセージ */
  error?: string;
}

/**
 * AIサービスのインターフェース
 */
export interface AIService {
  /**
   * 食事画像から食品を解析
   * @param imageData 画像データ
   * @returns 解析結果
   */
  analyzeMealImage(imageData: any): Promise<AIProcessResult>;
  
  /**
   * テキスト入力から食品を解析
   * @param text テキスト入力
   * @returns 解析結果
   */
  analyzeMealText(text: string): Promise<AIProcessResult>;
  
  /**
   * レシピテキストから食品を解析
   * @param recipeText レシピテキスト
   * @returns 解析結果
   */
  analyzeRecipeText(recipeText: string): Promise<AIProcessResult>;
}
```

### 2.2 OpenAI APIサービス実装

```typescript
// src/lib/ai/openai-service.ts を新規作成

import { AIService, AIProcessResult } from './ai-service';
import { OpenAIResponseParser } from './openai-response-parser';
import { AIParseResult } from './ai-response-parser';

/**
 * OpenAI API設定
 */
interface OpenAIServiceConfig {
  /** API URL */
  apiUrl: string;
  /** APIキー */
  apiKey: string;
  /** モデル名 */
  model: string;
  /** 最大トークン */
  maxTokens: number;
  /** 温度パラメータ */
  temperature: number;
}

/**
 * OpenAI APIを使用したAIサービス
 */
export class OpenAIService implements AIService {
  private config: OpenAIServiceConfig;
  private parser: OpenAIResponseParser;
  
  /**
   * コンストラクタ
   * @param config API設定
   */
  constructor(config: Partial<OpenAIServiceConfig> = {}) {
    // デフォルト設定
    this.config = {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4-1106-preview',
      maxTokens: 1000,
      temperature: 0.3,
      ...config
    };
    
    this.parser = new OpenAIResponseParser();
  }
  
  /**
   * 食事画像から食品を解析
   */
  async analyzeMealImage(imageData: any): Promise<AIProcessResult> {
    try {
      const startTime = Date.now();
      
      // 画像のBase64エンコーディング
      const base64Image = imageData.toString('base64');
      
      // プロンプト生成
      const prompt = this.parser.generatePrompt({
        imageDescription: '食事の写真が提供されています。'
      });
      
      // API呼び出し
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API エラー: ${response.status} ${error}`);
      }
      
      const data = await response.json();
      const rawResponse = data.choices?.[0]?.message?.content || '';
      
      // レスポンスの解析
      const parseResult = await this.parser.parseResponse(rawResponse);
      
      // 処理時間の計算
      const processingTimeMs = Date.now() - startTime;
      
      return {
        parseResult,
        rawResponse,
        processingTimeMs
      };
    } catch (error) {
      console.error('OpenAIService: 画像解析エラー', error);
      return {
        parseResult: {
          foods: [],
          confidence: 0,
          error: error.message
        },
        rawResponse: '',
        processingTimeMs: 0,
        error: error.message
      };
    }
  }
  
  /**
   * テキスト入力から食品を解析
   */
  async analyzeMealText(text: string): Promise<AIProcessResult> {
    try {
      const startTime = Date.now();
      
      // プロンプト生成
      const prompt = this.parser.generatePrompt({ text });
      
      // API呼び出し
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API エラー: ${response.status} ${error}`);
      }
      
      const data = await response.json();
      const rawResponse = data.choices?.[0]?.message?.content || '';
      
      // レスポンスの解析
      const parseResult = await this.parser.parseResponse(rawResponse);
      
      // 処理時間の計算
      const processingTimeMs = Date.now() - startTime;
      
      return {
        parseResult,
        rawResponse,
        processingTimeMs
      };
    } catch (error) {
      console.error('OpenAIService: テキスト解析エラー', error);
      return {
        parseResult: {
          foods: [],
          confidence: 0,
          error: error.message
        },
        rawResponse: '',
        processingTimeMs: 0,
        error: error.message
      };
    }
  }
  
  /**
   * レシピテキストから食品を解析
   */
  async analyzeRecipeText(recipeText: string): Promise<AIProcessResult> {
    // レシピ向けの特別なプロンプトで処理
    const recipePrompt = `
あなたは日本の妊婦向け栄養管理アプリの食品認識AIです。
以下のレシピから使用されている食材を特定し、JSON形式で出力してください。

# 指示
1. レシピから食材とその量を特定する
2. 調味料も含めて全ての食材を抽出する
3. 各食材を最もシンプルな基本形で表現する（例: 「刻みねぎ」→「ねぎ」）
4. 下記のJSON形式で出力する

# 出力フォーマット
\`\`\`json
{
  "foods": [
    {
      "name": "食品名1",
      "quantity": "量（例: 100g、1個）",
      "confidence": 0.9
    },
    // 他の食材...
  ],
  "confidence": 0.85
}
\`\`\`

# レシピ
${recipeText}

# 出力
`;

    return this.analyzeMealText(recipePrompt);
  }
}
```

### 2.3 AIサービスファクトリ

```typescript
// src/lib/ai/ai-service-factory.ts を新規作成

import { AIService } from './ai-service';
import { OpenAIService } from './openai-service';

/**
 * AI種類
 */
export enum AIServiceType {
  OPENAI = 'openai',
  MOCK = 'mock' // テスト用モック
}

/**
 * AIサービスのファクトリクラス
 */
export class AIServiceFactory {
  private static instances: Map<AIServiceType, AIService> = new Map();
  
  /**
   * AIサービスのインスタンスを取得
   */
  static getService(type: AIServiceType = AIServiceType.OPENAI): AIService {
    if (!this.instances.has(type)) {
      switch (type) {
        case AIServiceType.OPENAI:
          this.instances.set(type, new OpenAIService());
          break;
        case AIServiceType.MOCK:
          // TODO: モックサービスの実装
          throw new Error('モックサービスは未実装です');
        default:
          throw new Error(`未知のAIサービスタイプ: ${type}`);
      }
    }
    
    return this.instances.get(type);
  }
  
  /**
   * インスタンスを強制的に再作成
   */
  static recreateService(type: AIServiceType = AIServiceType.OPENAI, config?: any): AIService {
    switch (type) {
      case AIServiceType.OPENAI:
        this.instances.set(type, new OpenAIService(config));
        break;
      case AIServiceType.MOCK:
        // TODO: モックサービスの実装
        throw new Error('モックサービスは未実装です');
      default:
        throw new Error(`未知のAIサービスタイプ: ${type}`);
    }
    
    return this.instances.get(type);
  }
}
```

## 3. API エンドポイントの改善

### 3.1 画像解析エンドポイントの修正

```typescript
// src/app/api/analyze-image/route.ts を修正

import { NextRequest, NextResponse } from 'next/server';
import { AIServiceFactory, AIServiceType } from '@/lib/ai/ai-service-factory';
import { FoodInputParser } from '@/lib/food/food-input-parser';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';

export async function POST(request: NextRequest) {
  try {
    // フォームデータからファイルを取得
    const formData = await request.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: '画像ファイルが提供されていません' },
        { status: 400 }
      );
    }
    
    // ファイルをバッファに変換
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // AIサービスの取得と画像解析
    const aiService = AIServiceFactory.getService();
    const aiResult = await aiService.analyzeMealImage(buffer);
    
    if (aiResult.error) {
      return NextResponse.json(
        { error: aiResult.error },
        { status: 500 }
      );
    }
    
    // 食品入力解析結果から名前と量のペアを生成
    const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(
      aiResult.parseResult.foods
    );
    
    // 栄養計算サービスの取得と栄養計算
    const nutritionService = NutritionServiceFactory.getService();
    const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(
      nameQuantityPairs
    );
    
    // レスポンスの作成
    return NextResponse.json({
      foods: aiResult.parseResult.foods,
      nutrition: nutritionResult,
      processingTimeMs: aiResult.processingTimeMs,
      rawResponse: process.env.NODE_ENV === 'development' ? aiResult.rawResponse : undefined
    });
  } catch (error) {
    console.error('画像解析API エラー:', error);
    return NextResponse.json(
      { error: '画像解析中にエラーが発生しました: ' + error.message },
      { status: 500 }
    );
  }
}
```

### 3.2 テキスト解析エンドポイントの修正

```typescript
// src/app/api/analyze-text-input/route.ts を修正

import { NextRequest, NextResponse } from 'next/server';
import { AIServiceFactory } from '@/lib/ai/ai-service-factory';
import { FoodInputParser } from '@/lib/food/food-input-parser';
import { NutritionServiceFactory } from '@/lib/nutrition/nutrition-service-factory';

export async function POST(request: NextRequest) {
  try {
    // リクエストボディからテキストを取得
    const body = await request.json();
    const text = body.text;
    
    if (!text) {
      return NextResponse.json(
        { error: 'テキストが提供されていません' },
        { status: 400 }
      );
    }
    
    // AIサービスのテキスト解析を実行
    const aiService = AIServiceFactory.getService();
    
    // 単純なテキスト入力の場合、まずFoodInputParserで解析を試みる
    if (text.length < 100 && !text.includes('\n')) {
      const directParseResults = FoodInputParser.parseBulkInput(text);
      
      if (directParseResults.length > 0) {
        // 直接解析に成功した場合
        const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(
          directParseResults
        );
        
        // 栄養計算サービスで栄養計算
        const nutritionService = NutritionServiceFactory.getService();
        const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(
          nameQuantityPairs
        );
        
        return NextResponse.json({
          foods: directParseResults,
          nutrition: nutritionResult,
          processingTimeMs: 0,
          directParsed: true
        });
      }
    }
    
    // 直接解析できない場合はAIに依頼
    const aiResult = await aiService.analyzeMealText(text);
    
    if (aiResult.error) {
      return NextResponse.json(
        { error: aiResult.error },
        { status: 500 }
      );
    }
    
    // AIによる解析結果から栄養計算
    const nameQuantityPairs = await FoodInputParser.generateNameQuantityPairs(
      aiResult.parseResult.foods
    );
    
    const nutritionService = NutritionServiceFactory.getService();
    const nutritionResult = await nutritionService.calculateNutritionFromNameQuantities(
      nameQuantityPairs
    );
    
    // レスポンスの作成
    return NextResponse.json({
      foods: aiResult.parseResult.foods,
      nutrition: nutritionResult,
      processingTimeMs: aiResult.processingTimeMs,
      rawResponse: process.env.NODE_ENV === 'development' ? aiResult.rawResponse : undefined
    });
  } catch (error) {
    console.error('テキスト解析API エラー:', error);
    return NextResponse.json(
      { error: 'テキスト解析中にエラーが発生しました: ' + error.message },
      { status: 500 }
    );
  }
}
```

## 4. 実装手順

1. `src/lib/ai/ai-response-parser.ts` を作成し、AI応答パーサーインターフェースを定義
2. `src/lib/ai/openai-response-parser.ts` を作成し、OpenAI応答パーサーを実装
3. `src/lib/ai/ai-service.ts` を修正し、AIサービスインターフェースを定義
4. `src/lib/ai/openai-service.ts` を作成し、OpenAI APIサービスを実装
5. `src/lib/ai/ai-service-factory.ts` を作成し、AIサービスファクトリを実装
6. `src/app/api/analyze-image/route.ts` を修正し、画像解析APIを更新
7. `src/app/api/analyze-text-input/route.ts` を修正し、テキスト解析APIを更新
8. AI応答パーサーのユニットテストを作成
9. AIサービスのモックとテストを実装 