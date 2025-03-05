# フェーズ2: プロンプトシステム刷新

## 目標
- 共通プロンプトライブラリの作成
- 既存プロンプト生成ロジックの統合と移行
- プロンプトのバージョン管理機能の導入

## タスク1: プロンプトライブラリ基盤の構築

### ステップ1.1: テンプレートエンジンの実装
**ファイル**: `src/lib/ai/prompts/template-engine.ts`

```typescript
/**
 * シンプルなテンプレートエンジン
 * ハンドルバーライクな構文でテンプレート処理を行う
 */
export class TemplateEngine {
  /**
   * テンプレートをレンダリング
   * @param template テンプレート文字列
   * @param context コンテキストデータ
   * @returns レンダリングされた文字列
   */
  static render(template: string, context: Record<string, any> = {}): string {
    // 変数置換
    let result = this.replaceVariables(template, context);
    
    // 条件ブロック処理
    result = this.processConditionalBlocks(result, context);
    
    // 繰り返しブロック処理
    result = this.processLoopBlocks(result, context);
    
    return result;
  }
  
  /**
   * 変数の置換処理
   */
  private static replaceVariables(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path) => {
      // trim と条件演算子の除去
      const trimmedPath = path.trim();
      
      if (trimmedPath.startsWith('if') || 
          trimmedPath.startsWith('each') || 
          trimmedPath.startsWith('/if') || 
          trimmedPath.startsWith('/each')) {
        return `{{${trimmedPath}}}`; // 条件/ループブロックはそのまま
      }
      
      return this.getNestedValue(trimmedPath, context) ?? '';
    });
  }
  
  /**
   * 条件ブロックの処理
   */
  private static processConditionalBlocks(template: string, context: Record<string, any>): string {
    const ifRegex = /\{\{\s*if\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/if\s*\}\}/g;
    
    return template.replace(ifRegex, (_, condition, content) => {
      const conditionValue = this.evaluateCondition(condition.trim(), context);
      return conditionValue ? content : '';
    });
  }
  
  /**
   * 繰り返しブロックの処理
   */
  private static processLoopBlocks(template: string, context: Record<string, any>): string {
    const eachRegex = /\{\{\s*each\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/each\s*\}\}/g;
    
    return template.replace(eachRegex, (_, arrayPath, content) => {
      const array = this.getNestedValue(arrayPath.trim(), context);
      
      if (!Array.isArray(array)) {
        return '';
      }
      
      return array.map(item => {
        // 配列の各アイテムをコンテキストとしてコンテンツをレンダリング
        return this.render(content, { 
          ...context, 
          'this': item, 
          'item': item 
        });
      }).join('');
    });
  }
  
  /**
   * ネストされた値の取得
   */
  private static getNestedValue(path: string, obj: Record<string, any>): any {
    return path.split('.').reduce((prev, curr) => {
      return prev && typeof prev === 'object' ? prev[curr] : undefined;
    }, obj);
  }
  
  /**
   * 条件式の評価
   */
  private static evaluateCondition(condition: string, context: Record<string, any>): boolean {
    // 否定条件
    if (condition.startsWith('!')) {
      return !this.evaluateCondition(condition.substring(1).trim(), context);
    }
    
    // 単純な条件評価
    const value = this.getNestedValue(condition, context);
    
    // 配列の場合は長さをチェック
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    
    // 真偽値評価
    return !!value;
  }
}
```

### ステップ1.2: プロンプトバージョン管理の実装
**ファイル**: `src/lib/ai/prompts/version-manager.ts`

```typescript
/**
 * プロンプトのバージョン情報
 */
export interface PromptVersion {
  id: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  changelog?: string;
}

/**
 * プロンプトのメタデータ
 */
export interface PromptMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  versions: PromptVersion[];
  parameters: string[];
  defaultVersion: string;
}

/**
 * プロンプトバージョン管理クラス
 */
export class PromptVersionManager {
  private static instance: PromptVersionManager;
  private promptRegistry: Map<string, PromptMetadata> = new Map();
  
  private constructor() {
    // シングルトンパターン
  }
  
  /**
   * インスタンス取得
   */
  static getInstance(): PromptVersionManager {
    if (!PromptVersionManager.instance) {
      PromptVersionManager.instance = new PromptVersionManager();
    }
    return PromptVersionManager.instance;
  }
  
  /**
   * プロンプトメタデータを登録
   */
  registerPrompt(metadata: PromptMetadata): void {
    this.promptRegistry.set(metadata.id, metadata);
  }
  
  /**
   * プロンプトメタデータを取得
   */
  getPromptMetadata(promptId: string): PromptMetadata | undefined {
    return this.promptRegistry.get(promptId);
  }
  
  /**
   * アクティブなプロンプトバージョンを取得
   */
  getActiveVersion(promptId: string): PromptVersion | undefined {
    const metadata = this.getPromptMetadata(promptId);
    if (!metadata) return undefined;
    
    // アクティブバージョンを検索
    return metadata.versions.find(v => v.isActive);
  }
  
  /**
   * 指定バージョンのプロンプトテンプレートを取得
   */
  getPromptTemplate(promptId: string, version?: string): string | undefined {
    const metadata = this.getPromptMetadata(promptId);
    if (!metadata) return undefined;
    
    // バージョン指定がない場合はアクティブバージョンを使用
    const targetVersion = version || 
      metadata.versions.find(v => v.isActive)?.version || 
      metadata.defaultVersion;
    
    try {
      // プロンプトファイルを動的にインポート
      // 注: この部分は実際の実装で調整が必要
      const promptModule = require(`./templates/${promptId}/${targetVersion}.ts`);
      return promptModule.default || promptModule.template;
    } catch (error) {
      console.error(`プロンプトテンプレートの読み込みに失敗: ${promptId}/${targetVersion}`, error);
      return undefined;
    }
  }
  
  /**
   * 全登録プロンプトのメタデータリストを取得
   */
  getAllPrompts(): PromptMetadata[] {
    return Array.from(this.promptRegistry.values());
  }
  
  /**
   * カテゴリ別プロンプトリスト取得
   */
  getPromptsByCategory(category: string): PromptMetadata[] {
    return this.getAllPrompts().filter(p => p.category === category);
  }
}
```

## タスク2: 共通プロンプトテンプレートの作成

### ステップ2.1: 食品分析プロンプト
**ファイル**: `src/lib/ai/prompts/templates/food-analysis/v1.ts`

```typescript
/**
 * 食品分析プロンプトテンプレート v1
 */
export const template = `
この食事の写真から含まれている食品を識別してください。
食事タイプは「{{mealType}}」です。
{{#if trimester}}妊娠第{{trimester}}期の栄養素に特に注目してください。{{/if}}

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
    "vitamin_d": ビタミンD(μg),
    "confidence_score": 信頼度(0.0-1.0)
  }
}

回答は必ずこのJSONフォーマットのみで返してください。
`;

export default template;

export const metadata = {
  id: 'food-analysis',
  version: 'v1',
  createdAt: new Date('2023-04-01'),
  updatedAt: new Date('2023-04-01'),
  isActive: true,
  changelog: '初期バージョン'
};
```

### ステップ2.2: 栄養アドバイスプロンプト
**ファイル**: `src/lib/ai/prompts/templates/nutrition-advice/v1.ts`

```typescript
/**
 * 栄養アドバイスプロンプトテンプレート v1
 */
export const template = `
あなたは妊婦向け栄養管理アプリ「manmaru」の栄養アドバイザーです。
現在妊娠{{pregnancyWeek}}週目（第{{trimester}}期）の妊婦に対して、栄養アドバイスを作成してください。
今日は{{formattedDate}}で、現在は{{currentSeason}}です。季節に合わせたアドバイスも含めてください。

{{#if deficientNutrients.length}}
特に不足している栄養素: {{#each deficientNutrients}}{{#if @index}}、{{/if}}{{this}}{{/each}}
{{else}}
現在の栄養状態は良好です。
{{/if}}

{{#if isSummary}}
以下の点を考慮した簡潔なアドバイスを作成してください:
1. 妊娠周期、栄養摂取状況、不足している栄養素、季節要因を考慮した
アドバイスを2文程度、親しみやすく、要点を絞った内容で作成してください。
専門用語の使用は最小限に抑え、温かい口調で作成してください。
{{else}}
以下の点を含む詳細なアドバイスを作成してください:
1. 妊娠{{pregnancyWeek}}週目の胎児の発達状況
2. この時期に特に重要な栄養素とその理由
3. {{#if deficientNutrients.length}}
不足している栄養素（{{#each deficientNutrients}}{{#if @index}}、{{/if}}{{this}}{{/each}}）を補うための具体的な食品例とレシピのアイデア
{{else}}
全体的な栄養バランスを維持するための詳細なアドバイスと食品例
{{/if}}
4. {{currentSeason}}の旬の食材を取り入れた具体的な提案

さらに、レスポンスの最後に「### 推奨食品リスト」というセクションを作成し、箇条書きで5-7つの具体的な食品と、その栄養価や調理法のヒントを簡潔に列挙してください。特に{{currentSeason}}の旬の食材を含めてください。

アドバイスは300-500字程度、詳細ながらも理解しやすい内容で作成してください。
専門用語を使う場合は、簡単な説明を添えてください。
{{/if}}
`;

export default template;

export const metadata = {
  id: 'nutrition-advice',
  version: 'v1',
  createdAt: new Date('2023-04-01'),
  updatedAt: new Date('2023-04-01'),
  isActive: true,
  changelog: '初期バージョン'
};
```

### ステップ2.3: テキスト入力分析プロンプト
**ファイル**: `src/lib/ai/prompts/templates/text-input-analysis/v1.ts`

```typescript
/**
 * テキスト入力分析プロンプトテンプレート v1
 */
export const template = `
# 指示
あなたは日本の栄養士AIです。以下の食事リストを解析して、データベース検索に適した形式に変換してください。

## 入力データ
{{foodsText}}

## 出力要件
1. 各食品を標準的な日本語の食品名に変換してください
2. 量が曖昧または不明確な場合は、一般的な分量を推測して具体化してください
   例: 「サラダ」→「グリーンサラダ 100g」、「りんご」→「りんご 150g（中1個）」
3. 以下の量の表現は具体的な数値に変換してください
   - 「少し」→ 適切なグラム数（例: 10-30g）
   - 「一杯」→ 適切な量（例: ご飯なら150g、スープなら200ml）
   - 「一切れ」→ 食品に適した量（例: パンなら40g、ケーキなら80g）

## 出力形式
以下のJSONフォーマットで出力してください:
{
  "enhancedFoods": [
    {"name": "標準化された食品名", "quantity": "標準化された量", "confidence": 0.9},
    ...
  ]
}

JSONデータのみを出力してください。説明文などは不要です。
`;

export default template;

export const metadata = {
  id: 'text-input-analysis',
  version: 'v1',
  createdAt: new Date('2023-04-01'),
  updatedAt: new Date('2023-04-01'),
  isActive: true,
  changelog: '初期バージョン'
};
```

## タスク3: プロンプトサービスの実装

### ステップ3.1: プロンプトサービスクラス
**ファイル**: `src/lib/ai/prompts/prompt-service.ts`

```typescript
import { TemplateEngine } from './template-engine';
import { PromptVersionManager } from './version-manager';

// プロンプトID定義
export enum PromptType {
  FOOD_ANALYSIS = 'food-analysis',
  NUTRITION_ADVICE = 'nutrition-advice',
  TEXT_INPUT_ANALYSIS = 'text-input-analysis',
  // 将来的に追加するプロンプトタイプ
  RECIPE_RECOMMENDATION = 'recipe-recommendation'
}

/**
 * プロンプトサービスクラス
 * テンプレートの取得とレンダリングを行う
 */
export class PromptService {
  private static instance: PromptService;
  private versionManager: PromptVersionManager;
  
  private constructor() {
    this.versionManager = PromptVersionManager.getInstance();
    this.registerPromptTemplates();
  }
  
  /**
   * インスタンス取得
   */
  static getInstance(): PromptService {
    if (!PromptService.instance) {
      PromptService.instance = new PromptService();
    }
    return PromptService.instance;
  }
  
  /**
   * 食品分析プロンプト生成
   */
  generateFoodAnalysisPrompt(context: {
    mealType: string;
    trimester?: number;
  }): string {
    return this.generatePrompt(PromptType.FOOD_ANALYSIS, context);
  }
  
  /**
   * 栄養アドバイスプロンプト生成
   */
  generateNutritionAdvicePrompt(context: {
    pregnancyWeek: number;
    trimester: number;
    deficientNutrients: string[];
    isSummary: boolean;
    formattedDate: string;
    currentSeason: string;
  }): string {
    return this.generatePrompt(PromptType.NUTRITION_ADVICE, context);
  }
  
  /**
   * テキスト入力分析プロンプト生成
   */
  generateTextInputAnalysisPrompt(context: {
    foodsText: string;
  }): string {
    return this.generatePrompt(PromptType.TEXT_INPUT_ANALYSIS, context);
  }
  
  /**
   * 汎用プロンプト生成メソッド
   */
  generatePrompt(promptType: PromptType, context: Record<string, any>, version?: string): string {
    // テンプレート取得
    const template = this.versionManager.getPromptTemplate(promptType, version);
    
    if (!template) {
      throw new Error(`プロンプトテンプレートが見つかりません: ${promptType}, バージョン: ${version || 'デフォルト'}`);
    }
    
    // テンプレートレンダリング
    return TemplateEngine.render(template, context);
  }
  
  /**
   * プロンプトテンプレート登録
   * 初期化時に実行される
   */
  private registerPromptTemplates(): void {
    // 食品分析
    const foodAnalysisV1 = require('./templates/food-analysis/v1');
    this.versionManager.registerPrompt({
      id: PromptType.FOOD_ANALYSIS,
      name: '食品分析',
      description: '食事写真から食品を識別するプロンプト',
      category: '栄養分析',
      versions: [foodAnalysisV1.metadata],
      parameters: ['mealType', 'trimester'],
      defaultVersion: 'v1'
    });
    
    // 栄養アドバイス
    const nutritionAdviceV1 = require('./templates/nutrition-advice/v1');
    this.versionManager.registerPrompt({
      id: PromptType.NUTRITION_ADVICE,
      name: '栄養アドバイス',
      description: '妊婦向け栄養アドバイス生成',
      category: '栄養アドバイス',
      versions: [nutritionAdviceV1.metadata],
      parameters: ['pregnancyWeek', 'trimester', 'deficientNutrients', 'isSummary', 'formattedDate', 'currentSeason'],
      defaultVersion: 'v1'
    });
    
    // テキスト入力分析
    const textInputAnalysisV1 = require('./templates/text-input-analysis/v1');
    this.versionManager.registerPrompt({
      id: PromptType.TEXT_INPUT_ANALYSIS,
      name: 'テキスト入力分析',
      description: '食事テキスト入力の解析と正規化',
      category: '栄養分析',
      versions: [textInputAnalysisV1.metadata],
      parameters: ['foodsText'],
      defaultVersion: 'v1'
    });
  }
}
```

### ステップ3.2: プロンプトユーティリティ関数
**ファイル**: `src/lib/ai/prompts/prompt-utils.ts`

```typescript
/**
 * 現在の季節を判定する関数
 * @param month 月 (1-12)
 * @returns 季節の名前
 */
export function getSeason(month: number): string {
  if (month >= 3 && month <= 5) {
    return '春';
  } else if (month >= 6 && month <= 8) {
    return '夏';
  } else if (month >= 9 && month <= 11) {
    return '秋';
  } else {
    return '冬';
  }
}

/**
 * 日付を日本語フォーマットで取得
 * @param date 日付オブジェクト
 * @returns フォーマットされた日付文字列
 */
export function formatDateJP(date: Date = new Date()): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * コンテキストヘルパー関数
 * 栄養アドバイス用のコンテキストを生成
 */
export function createNutritionAdviceContext(params: {
  pregnancyWeek: number;
  trimester: number;
  deficientNutrients: string[];
  isSummary: boolean;
  date?: Date;
}): Record<string, any> {
  const date = params.date || new Date();
  const month = date.getMonth() + 1; // 0-11 なので +1
  
  return {
    pregnancyWeek: params.pregnancyWeek,
    trimester: params.trimester,
    deficientNutrients: params.deficientNutrients,
    isSummary: params.isSummary,
    formattedDate: formatDateJP(date),
    currentSeason: getSeason(month)
  };
}

/**
 * 食品テキストを配列から整形
 */
export function formatFoodsText(foods: Array<{ name: string, quantity?: string }>): string {
  return foods.map(food => 
    `・${food.name}${food.quantity ? ` ${food.quantity}` : ''}`
  ).join('\n');
}
```

## タスク4: 既存APIの移行

### ステップ4.1: 栄養アドバイスAPIの更新
**ファイル**: `src/app/api/nutrition-advice/route.ts`

```typescript
// 既存のimport文は維持

// 以下を追加
import { AIModelFactory } from '@/lib/ai/model-factory';
import { PromptService, PromptType } from '@/lib/ai/prompts/prompt-service';
import { withErrorHandling } from '@/lib/errors/error-utils';
import { AIError, ErrorCode } from '@/lib/errors/ai-error';

// generatePrompt関数のリファクタリング
function generatePrompt(
  pregnancyWeek: number,
  trimester: number,
  deficientNutrients: string[],
  mode: 'summary' | 'detail'
): string {
  // プロンプトサービスを利用
  const promptService = PromptService.getInstance();
  
  // コンテキスト作成
  const context = {
    pregnancyWeek,
    trimester,
    deficientNutrients,
    isSummary: mode === 'summary',
    formattedDate: new Date().toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    currentSeason: getSeason(new Date().getMonth() + 1)
  };
  
  // プロンプト生成
  return promptService.generateNutritionAdvicePrompt(context);
}

// 既存の月から季節を判定する関数は維持

// GET関数をエラーハンドリングでラップ
export const GET = withErrorHandling(async (req: Request) => {
  // 既存のコードは基本的に維持

  // AIモデル作成部分を修正
  try {
    // 既存コード...
    
    // ここでAIModelFactoryを使用するよう変更
    const model = AIModelFactory.createTextModel({
      temperature: 0.7,
      maxOutputTokens: 1500
    });
    
    // その他の処理は既存コードを維持
    // ...
  } catch (error) {
    // エラーを適切な型に変換
    if (error instanceof AIError) {
      throw error;
    }
    
    throw new AIError(
      '栄養アドバイスの生成に失敗しました',
      ErrorCode.AI_MODEL_ERROR,
      error
    );
  }
});
```

### ステップ4.2: テキスト入力分析APIの更新
**ファイル**: `src/app/api/analyze-text-input/route.ts`

```typescript
// 既存のimport文は維持

// 以下を追加
import { AIModelFactory } from '@/lib/ai/model-factory';
import { PromptService } from '@/lib/ai/prompts/prompt-service';
import { formatFoodsText } from '@/lib/ai/prompts/prompt-utils';
import { withErrorHandling } from '@/lib/errors/error-utils';
import { AIError, ErrorCode } from '@/lib/errors/ai-error';

// POST関数をエラーハンドリングでラップ
export const POST = withErrorHandling(async (request: Request) => {
  try {
    console.log('テキスト解析リクエスト受信');
    const body = await request.json();
    console.log('リクエストボディ:', body);

    // APIキーチェックを共通ユーティリティに置き換え
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new AIError(
        'API設定エラー',
        ErrorCode.API_KEY_ERROR,
        null,
        ['GEMINI_API_KEY環境変数を設定してください']
      );
    }

    // リクエストデータの検証
    const { foods } = RequestSchema.parse(body);

    // 食品データがない場合はエラー
    if (!foods || foods.length === 0) {
      throw new AIError(
        '食品データが必要です',
        ErrorCode.VALIDATION_ERROR,
        null,
        ['少なくとも1つの食品を入力してください']
      );
    }

    // AIモデルファクトリーの使用
    const model = AIModelFactory.createTextModel({
      temperature: 0.2,
      maxOutputTokens: 1024
    });

    // プロンプトサービスの使用
    const promptService = PromptService.getInstance();
    const foodsText = formatFoodsText(foods);
    const prompt = promptService.generateTextInputAnalysisPrompt({ foodsText });

    // その他の処理は既存コードを維持
    // ...
  } catch (error) {
    // エラー変換処理
    if (error instanceof FoodAnalysisError || error instanceof AIError) {
      throw error;
    }
    
    if (error instanceof z.ZodError) {
      throw new AIError(
        'リクエスト形式が不正です',
        ErrorCode.VALIDATION_ERROR,
        error
      );
    }
    
    throw new AIError(
      'テキスト解析中にエラーが発生しました',
      ErrorCode.AI_MODEL_ERROR,
      error
    );
  }
});
```

## 検証方法

### 単体テスト
**ファイル**: `__tests__/prompt-service.test.ts`

```typescript
import { PromptService, PromptType } from '@/lib/ai/prompts/prompt-service';

describe('PromptService', () => {
  let promptService: PromptService;
  
  beforeAll(() => {
    promptService = PromptService.getInstance();
  });
  
  test('generateFoodAnalysisPrompt generates valid prompt', () => {
    const context = {
      mealType: '朝食',
      trimester: 2
    };
    
    const prompt = promptService.generateFoodAnalysisPrompt(context);
    
    expect(prompt).toContain('朝食');
    expect(prompt).toContain('妊娠第2期');
    expect(prompt).toContain('JSON形式で回答');
  });
  
  test('generateNutritionAdvicePrompt generates summary prompt', () => {
    const context = {
      pregnancyWeek: 20,
      trimester: 2,
      deficientNutrients: ['鉄分', '葉酸'],
      isSummary: true,
      formattedDate: '2023年4月1日',
      currentSeason: '春'
    };
    
    const prompt = promptService.generateNutritionAdvicePrompt(context);
    
    expect(prompt).toContain('20週目');
    expect(prompt).toContain('鉄分、葉酸');
    expect(prompt).toContain('簡潔なアドバイス');
    expect(prompt).not.toContain('詳細なアドバイス');
  });
});
```

### エンドツーエンドテスト
**ファイル**: `cypress/e2e/nutrition-advice.cy.ts`

```typescript
describe('栄養アドバイス機能', () => {
  it('アドバイスが正しく表示される', () => {
    // テスト用のモックデータを設定
    cy.intercept('GET', '/api/nutrition-advice*', {
      fixture: 'nutrition-advice.json'
    }).as('getNutritionAdvice');
    
    // アドバイスページにアクセス
    cy.visit('/nutrition-advice');
    
    // データ読み込み待機
    cy.wait('@getNutritionAdvice');
    
    // アドバイスが表示されることを確認
    cy.get('[data-testid="advice-card"]').should('be.visible');
    cy.get('[data-testid="advice-summary"]').should('not.be.empty');
    cy.get('[data-testid="recommended-foods"]').should('have.length.at.least', 1);
  });
});
```

## 完了条件

- [ ] テンプレートエンジンが実装され、テストに合格
- [ ] プロンプトバージョン管理システムが実装され、テストに合格
- [ ] 全プロンプトテンプレートが標準化され、テンプレートシステムに統合
- [ ] 既存APIがプロンプトサービスを使用するよう更新
- [ ] 手動テストで機能が正しく動作することを確認 