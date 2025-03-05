# フェーズ3: パーサーシステム強化実装計画

## 目標
- 拡張可能なパーサーシステムの設計と実装
- 既存パーサーロジックの共通システムへの移行
- 応答バリデーションシステムの統合

## 修正されたアプローチ: シンプルでより統合的な設計

### タスク1: 統合されたAIサービスの設計

**ファイル**: `src/lib/ai/ai-service.ts`

```typescript
import { z } from 'zod';
import { AIModelFactory } from './model-factory';
import { PromptService, PromptType } from './prompts/prompt-service';
import { AIError, ErrorCode } from '@/lib/errors/ai-error';

// 食品分析結果の型とスキーマ
export interface FoodAnalysisResult {
  foods: Array<{
    name: string;
    quantity: string;
    confidence: number;
  }>;
  nutrition: {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d?: number;
    confidence_score: number;
  };
}

// Zodスキーマでの結果検証
const foodAnalysisSchema = z.object({
  foods: z.array(z.object({
    name: z.string().min(1, "食品名は必須です"),
    quantity: z.string(),
    confidence: z.number().min(0).max(1)
  })).min(1, "少なくとも1つの食品が必要です"),
  nutrition: z.object({
    calories: z.number().min(0),
    protein: z.number().min(0),
    iron: z.number().min(0),
    folic_acid: z.number().min(0),
    calcium: z.number().min(0),
    vitamin_d: z.number().min(0).optional(),
    confidence_score: z.number().min(0).max(1)
  })
});

// 栄養アドバイス結果の型
export interface NutritionAdviceResult {
  summary: string;
  detailedAdvice?: string;
  recommendedFoods?: Array<{
    name: string;
    benefits: string;
  }>;
}

/**
 * 統合型AIサービスクラス
 * AIモデル呼び出しからレスポンスのパースまで一元管理
 */
export class AIService {
  private static instance: AIService;
  private promptService: PromptService;
  
  private constructor() {
    this.promptService = PromptService.getInstance();
  }
  
  /**
   * シングルトンインスタンス取得
   */
  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * 食事写真の解析を行う
   * @param image 画像データ（Base64）
   * @param mealType 食事タイプ
   * @param trimester 妊娠期（オプション）
   */
  async analyzeMeal(
    image: string, 
    mealType: string, 
    trimester?: number
  ): Promise<FoodAnalysisResult> {
    // プロンプト生成
    const prompt = this.promptService.generateFoodAnalysisPrompt({
      mealType,
      trimester
    });
    
    // モデル呼び出し
    const model = AIModelFactory.createVisionModel({
      temperature: 0.1
    });
    
    try {
      const response = await model.invokeWithImageData!(prompt, image);
      const responseText = response.toString();
      
      // JSONパース処理
      return this.parseJSONResponse<FoodAnalysisResult>(
        responseText, 
        foodAnalysisSchema,
        'foods'
      );
    } catch (error) {
      if (error instanceof AIError) throw error;
      
      throw new AIError(
        '食事分析中にエラーが発生しました',
        ErrorCode.AI_MODEL_ERROR,
        error
      );
    }
  }
  
  /**
   * 栄養アドバイスの生成
   */
  async getNutritionAdvice(params: {
    pregnancyWeek: number;
    trimester: number;
    deficientNutrients: string[];
    isSummary: boolean;
    formattedDate: string;
    currentSeason: string;
  }): Promise<NutritionAdviceResult> {
    // プロンプト生成
    const prompt = this.promptService.generateNutritionAdvicePrompt(params);
    
    // モデル呼び出し
    const model = AIModelFactory.createTextModel({
      temperature: 0.7
    });
    
    try {
      const response = await model.invoke(prompt);
      const responseText = response.toString();
      
      // テキスト形式の応答をパース
      return this.parseNutritionAdvice(responseText, params.isSummary);
    } catch (error) {
      if (error instanceof AIError) throw error;
      
      throw new AIError(
        '栄養アドバイス生成中にエラーが発生しました',
        ErrorCode.AI_MODEL_ERROR,
        error
      );
    }
  }
  
  /**
   * AIからのJSON応答をパース
   */
  private parseJSONResponse<T>(
    responseText: string, 
    schema?: z.ZodSchema<T>,
    requiredField?: string
  ): T {
    // JSONパターンの抽出
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      throw new AIError(
        'JSONレスポンスの形式が不正です',
        ErrorCode.RESPONSE_PARSE_ERROR,
        responseText
      );
    }
    
    // JSON抽出
    const jsonStr = (jsonMatch[1] || jsonMatch[2]).trim();
    
    try {
      // JSONパース
      const parsed = JSON.parse(jsonStr);
      
      // 必須フィールドの確認
      if (requiredField && !parsed[requiredField]) {
        throw new AIError(
          `必須フィールド "${requiredField}" が見つかりません`,
          ErrorCode.VALIDATION_ERROR,
          { response: parsed }
        );
      }
      
      // スキーマ検証（オプション）
      if (schema) {
        const result = schema.safeParse(parsed);
        if (!result.success) {
          throw new AIError(
            'データ検証エラー',
            ErrorCode.VALIDATION_ERROR,
            { errors: result.error.issues, data: parsed }
          );
        }
        return result.data;
      }
      
      return parsed;
    } catch (error) {
      if (error instanceof AIError) throw error;
      
      throw new AIError(
        'JSONの解析に失敗しました',
        ErrorCode.RESPONSE_PARSE_ERROR,
        { error, text: jsonStr }
      );
    }
  }
  
  /**
   * 栄養アドバイステキストのパース
   */
  private parseNutritionAdvice(responseText: string, isSummary: boolean): NutritionAdviceResult {
    if (isSummary) {
      // 要約モードの場合は単純にテキスト全体を要約として扱う
      return {
        summary: this.cleanupText(responseText)
      };
    }
    
    // 詳細モードの場合は推奨食品リストを抽出
    const recommendedFoods = this.extractRecommendedFoods(responseText);
    
    // 最初の段落を要約として抽出
    const paragraphs = responseText.split(/\n\s*\n/);
    const summary = paragraphs.length > 0 
      ? this.cleanupText(paragraphs[0]) 
      : this.cleanupText(responseText);
    
    // 詳細アドバイスを抽出（推奨食品リストの前まで）
    let detailedAdvice = '';
    const foodListIndex = responseText.indexOf('### 推奨食品');
    if (foodListIndex !== -1 && paragraphs.length > 1) {
      detailedAdvice = this.cleanupText(
        responseText.substring(paragraphs[0].length, foodListIndex)
      );
    } else if (paragraphs.length > 1) {
      // 食品リストが見つからない場合
      detailedAdvice = this.cleanupText(
        responseText.substring(paragraphs[0].length)
      );
    }
    
    return {
      summary,
      detailedAdvice: detailedAdvice || undefined,
      recommendedFoods: recommendedFoods.length > 0 ? recommendedFoods : undefined
    };
  }
  
  /**
   * 推奨食品リストを抽出
   */
  private extractRecommendedFoods(text: string): Array<{name: string, benefits: string}> {
    const foods: Array<{name: string, benefits: string}> = [];
    
    // 推奨食品セクションを探す
    const foodSection = text.match(/###\s*推奨食品[^#]*|推奨食品[：:][^#]*/i);
    if (!foodSection) return foods;
    
    // 箇条書きアイテムを抽出
    const listItems = foodSection[0].match(/[-•*]\s*([^:：\n]+)[：:]\s*([^\n]+)/g);
    if (!listItems) return foods;
    
    // 各アイテムをパース
    listItems.forEach(item => {
      const parts = item.match(/[-•*]\s*([^:：\n]+)[：:]\s*([^\n]+)/);
      if (parts && parts.length >= 3) {
        foods.push({
          name: parts[1].trim(),
          benefits: parts[2].trim()
        });
      }
    });
    
    return foods;
  }
  
  /**
   * テキストのクリーンアップ
   */
  private cleanupText(text: string): string {
    return text
      .replace(/^[#\s]+|[#\s]+$/g, '') // 先頭と末尾の#や空白を削除
      .replace(/\n{3,}/g, '\n\n')      // 3つ以上の連続改行を2つに
      .trim();
  }
}
```

### タスク2: 既存APIの更新

#### ステップ2.1: 食事分析APIの更新
**ファイル**: `src/app/api/analyze-meal/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { z } from "zod";
import { AIService } from '@/lib/ai/ai-service';
import { withErrorHandling } from '@/lib/errors/error-utils';

// リクエストスキーマ
const requestSchema = z.object({
  image: z.string(),
  mealType: z.string()
});

// 食事写真の解析APIエンドポイント
async function analyzeMealHandler(request: Request) {
  console.log('API: リクエスト受信');
  
  // リクエストボディの解析
  const body = await request.json();
  
  // スキーマ検証
  const validationResult = requestSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'validation_error',
          message: 'リクエスト形式が不正です',
          details: validationResult.error.issues
        }
      },
      { status: 400 }
    );
  }
  
  const { image, mealType } = validationResult.data;
  console.log(`API: 食事タイプ=${mealType}, 画像データ長=${image?.length || 0}`);
  
  // AIサービス呼び出し
  const aiService = AIService.getInstance();
  const result = await aiService.analyzeMeal(image, mealType);
  
  console.log('API: 解析成功', JSON.stringify(result).substring(0, 100) + '...');
  return NextResponse.json(result);
}

// エラーハンドリングでラップしたハンドラをエクスポート
export const POST = withErrorHandling(analyzeMealHandler);
```

#### ステップ2.2: 栄養アドバイスAPIの更新
**ファイル**: `src/app/api/nutrition-advice/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AIService } from '@/lib/ai/ai-service';
import { withErrorHandling } from '@/lib/errors/error-utils';
import { getCurrentSeason } from '@/lib/utils/date-utils';

// 栄養アドバイスAPIエンドポイント
export const GET = withErrorHandling(async (req: Request) => {
  // ユーザー認証確認
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const userId = session.user.id;
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  
  // 既存のアドバイスがあるか確認
  const { data: existingAdvice } = await supabase
    .from('nutrition_advice')
    .select('*')
    .eq('user_id', userId)
    .eq('date', formattedDate)
    .maybeSingle();
  
  if (existingAdvice) {
    return NextResponse.json({ 
      advice: existingAdvice.advice,
      detailed_advice: existingAdvice.detailed_advice,
      recommended_foods: existingAdvice.recommended_foods
    });
  }
  
  // 妊婦プロフィール取得
  const { data: profile } = await supabase
    .from('pregnancy_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (!profile) {
    return NextResponse.json(
      { error: '妊婦プロフィールが見つかりません' },
      { status: 404 }
    );
  }
  
  // 不足栄養素の取得
  const deficientNutrients = await getDeficientNutrients(supabase, userId, profile);
  
  // 季節情報
  const currentSeason = getCurrentSeason();
  
  // 妊娠期の計算
  const pregnancyWeek = calculatePregnancyWeek(profile.due_date);
  const trimester = Math.ceil(pregnancyWeek / 13);
  
  // AIサービス呼び出し - 要約
  const aiService = AIService.getInstance();
  const summaryResult = await aiService.getNutritionAdvice({
    pregnancyWeek,
    trimester,
    deficientNutrients,
    isSummary: true,
    formattedDate: today.toLocaleDateString('ja-JP'),
    currentSeason
  });
  
  // 詳細アドバイスが必要かどうか
  const need_detail_advice = true; // 条件に応じて変更可能
  
  let detailedAdvice = '';
  let recommendedFoods = [];
  
  if (need_detail_advice) {
    // 詳細アドバイス生成
    const detailResult = await aiService.getNutritionAdvice({
      pregnancyWeek,
      trimester,
      deficientNutrients,
      isSummary: false,
      formattedDate: today.toLocaleDateString('ja-JP'),
      currentSeason
    });
    
    detailedAdvice = detailResult.detailedAdvice || '';
    recommendedFoods = detailResult.recommendedFoods || [];
  }
  
  // データベースに保存
  const { error: saveError } = await supabase
    .from('nutrition_advice')
    .insert({
      user_id: userId,
      date: formattedDate,
      advice: summaryResult.summary,
      detailed_advice: detailedAdvice,
      recommended_foods: recommendedFoods.length > 0 ? recommendedFoods : null
    });
  
  if (saveError) {
    console.error('アドバイス保存エラー:', saveError);
  }
  
  return NextResponse.json({
    advice: summaryResult.summary,
    detailed_advice: detailedAdvice,
    recommended_foods: recommendedFoods
  });
});

// 不足栄養素取得（既存関数）
async function getDeficientNutrients(supabase: any, userId: string, profile: any) {
  // 既存の実装
  // ...
}

// 妊娠週数計算（既存関数）
function calculatePregnancyWeek(dueDate: string): number {
  // 既存の実装
  // ...
}
```

### タスク3: テストの実装

**ファイル**: `__tests__/ai-service.test.ts`

```typescript
import { AIService, FoodAnalysisResult } from '@/lib/ai/ai-service';

describe('AIService', () => {
  let service: AIService;
  
  beforeEach(() => {
    service = AIService.getInstance();
  });
  
  test('食品分析のJSONレスポースをパースできる', () => {
    const mockResponse = `
      \`\`\`json
      {
        "foods": [
          {"name": "サラダ", "quantity": "1人前", "confidence": 0.9},
          {"name": "玄米ご飯", "quantity": "茶碗1杯", "confidence": 0.8}
        ],
        "nutrition": {
          "calories": 320,
          "protein": 8,
          "iron": 2.1,
          "folic_acid": 120,
          "calcium": 85,
          "confidence_score": 0.75
        }
      }
      \`\`\`
    `;
    
    // privateメソッドテスト用の型アサーション
    const result = (service as any).parseJSONResponse<FoodAnalysisResult>(mockResponse);
    
    expect(result).toBeDefined();
    expect(result.foods).toHaveLength(2);
    expect(result.foods[0].name).toBe('サラダ');
    expect(result.nutrition.calories).toBe(320);
  });
  
  test('栄養アドバイスを適切にパースできる', () => {
    const mockResponse = `
      妊娠20週目の今は、胎児の骨格形成が活発な時期です。カルシウムと鉄分の摂取が特に重要です。

      ### 推奨食品リスト
      - 小松菜: カルシウムと鉄分が豊富で、胎児の骨格発達をサポート
      - レバー: 貧血予防に効果的な鉄分と葉酸を含む
      - 豆腐: 良質なタンパク質とカルシウムの優れた供給源
    `;
    
    // privateメソッドテスト用の型アサーション
    const result = (service as any).parseNutritionAdvice(mockResponse, false);
    
    expect(result.summary).toContain('妊娠20週目');
    expect(result.recommendedFoods).toHaveLength(3);
    expect(result.recommendedFoods[0].name).toBe('小松菜');
  });
});
```

## 検証方法

### シンプル化されたアプローチの利点

1. **コードの整理**: パーサーとAI呼び出しを一つのサービスに統合し、コードの流れがシンプルになりました。

2. **メンテナンス性の向上**: 各機能が論理的に関連付けられ、変更が必要な場合に修正箇所が明確になります。

3. **再利用性**: 共通のパース処理を複数のAPIで簡単に再利用できます。

4. **ファイル数の削減**: 複雑な階層構造や多数のファイルを避け、関連する機能をまとめました。

### テスト方法

1. 単体テスト: AIサービスの各パース機能をテストして動作を確認
2. 統合テスト: 実際のAPIエンドポイントからサービスを呼び出してE2Eテスト
3. エラーシナリオ: 異常系ケースの処理が適切に行われることを確認

## 完了条件

- [ ] AIサービスが実装され、既存API（食事分析・栄養アドバイス）が移行されている
- [ ] 異なる応答形式（JSON・テキスト）の適切なパース処理が実装されている
- [ ] テストが成功し、全ての機能が意図通りに動作することが確認されている

## 次のステップ

この実装が完了したら、フェーズ4のレシピ提案機能実装に進みます。現在の設計であれば、新しいAI機能の追加も同じパターンで簡単に行えます。
