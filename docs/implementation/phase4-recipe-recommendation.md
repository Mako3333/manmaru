# フェーズ4: レシピ提案機能実装計画

## 目標
- 先行する3フェーズで構築したAIアーキテクチャを活用したレシピ提案機能の実装
- 既存のレシピ提案APIの再構築と統合
- パーソナライズされたレシピ提案のアルゴリズム最適化
- レシピ提案UIの改善と拡張機能の追加

## タスク1: レシピ提案AIサービスの実装

### ステップ1.1: レシピ提案機能のプロンプトテンプレート作成
**ファイル**: `src/lib/ai/prompts/templates/recipe-recommendation/v1.ts`

```typescript
/**
 * レシピ提案プロンプトテンプレート v1
 */
export const recipeRecommendationTemplate = `
あなたは妊婦向けの栄養士です。以下の栄養素が不足している妊婦に適したレシピを{{recipeCount}}つ提案してください。

不足している栄養素: {{deficientNutrients}}
妊娠週数: {{pregnancyWeek}}週
除外したい食材: {{excludeIngredients}}
{{#if isFirstTimeUser}}※これは初めてアプリを使用するユーザーです。基本的な栄養情報も含めてください。{{/if}}

提案するレシピは以下の条件を満たすこと:
- {{servings}}人分の分量
- 調理時間30分以内
- 一般的な食材を使用
- 妊婦に安全な食材のみ使用
- {{currentSeason}}の季節の食材を優先的に使用

最新の栄養学的知見に基づいて、不足している栄養素を効率的に補給できるレシピを提案してください。
また、なぜそのレシピが妊婦に適しているのか、どのように栄養素を補給できるのかも説明してください。
{{#if isFirstTimeUser}}初めてのユーザーのため、妊娠中の栄養摂取の基本についても簡潔に説明してください。{{/if}}

以下のJSON形式で返してください:
{
  "recipes": [
    {
      "title": "レシピ名",
      "description": "レシピの簡単な説明と栄養的メリット",
      "ingredients": ["材料1: 量", "材料2: 量", ...],
      "steps": ["手順1", "手順2", ...],
      "nutrients": ["含まれる栄養素1: 量", "含まれる栄養素2: 量", ...],
      "preparation_time": "調理時間（分）",
      "difficulty": "簡単/中級/難しい",
      "tips": "調理のコツや代替食材の提案"
    }
  ],
  "nutrition_tips": [
    "不足栄養素に関するアドバイス1",
    "不足栄養素に関するアドバイス2"
  ]{{#if isFirstTimeUser}},
  "first_time_info": "妊娠中の栄養摂取に関する基本情報"{{/if}}
}
`;

/**
 * レシピ提案プロンプトメタデータ
 */
export const recipeRecommendationMetadata = {
  id: 'recipe-recommendation',
  version: 'v1',
  createdAt: '2025-03-15',
  changelog: 'レシピ提案プロンプトの初期バージョン'
};
```

### ステップ1.2: AIサービスにレシピ提案機能を追加
**ファイル**: `src/lib/ai/ai-service.ts`

```typescript
// 既存のimportに追加
import { AIModelFactory } from './model-factory';
import { PromptService } from './prompts/prompt-service';
import { AIError, ErrorCode } from '@/lib/errors/ai-error';
import { z } from 'zod';

// レシピ提案結果の型定義
export interface RecipeRecommendationResult {
  recipes: Array<{
    title: string;
    description: string;
    ingredients: string[];
    steps: string[];
    nutrients: string[];
    preparation_time: string;
    difficulty: string;
    tips: string;
  }>;
  nutrition_tips: string[];
  first_time_info?: string;
}

// 既存のAIServiceクラスに追加
export class AIService {
  // 既存のメソッド...
  
  /**
   * レシピ提案の生成
   */
  async getRecipeRecommendations(params: {
    userId: string;
    pregnancyWeek: number;
    deficientNutrients: string[];
    excludeIngredients: string[];
    servings: number;
    isFirstTimeUser: boolean;
    currentSeason: string;
    recipeCount?: number;
  }): Promise<RecipeRecommendationResult> {
    // プロンプト生成
    const prompt = this.promptService.generateRecipeRecommendationPrompt({
      ...params,
      recipeCount: params.recipeCount || 3
    });
    
    // モデル呼び出し（Google検索ツール付き）
    const model = AIModelFactory.createTextModelWithSearchTool({
      temperature: 0.3,
      maxTokens: 2048
    });
    
    try {
      const response = await model.invoke(prompt);
      const responseText = response.toString();
      
      // JSONパース処理
      return this.parseJSONResponse<RecipeRecommendationResult>(
        responseText, 
        undefined, // Zodスキーマはオプション
        'recipes'
      );
    } catch (error) {
      if (error instanceof AIError) throw error;
      
      throw new AIError(
        'レシピ提案中にエラーが発生しました',
        ErrorCode.AI_MODEL_ERROR,
        error
      );
    }
  }
}
```

### ステップ1.3: AIモデルファクトリーに検索ツール付きモデル作成機能を追加
**ファイル**: `src/lib/ai/model-factory.ts`

```typescript
// 既存のimportに追加
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  DynamicRetrievalMode,
  GoogleSearchRetrievalTool,
} from "@google/generative-ai";

// 既存のAIModelFactoryクラスに追加
export class AIModelFactory {
  // 既存のメソッド...
  
  /**
   * 検索ツール付きテキストモデルの作成
   */
  static createTextModelWithSearchTool(options: ModelOptions = {}): any {
    const searchRetrievalTool: GoogleSearchRetrievalTool = {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: DynamicRetrievalMode.MODE_DYNAMIC,
          dynamicThreshold: options.searchThreshold || 0.7,
        },
      },
    };
    
    return new ChatGoogleGenerativeAI({
      model: options.model || "gemini-2.0-flash-001",
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens ?? 2048,
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    }).bindTools([searchRetrievalTool]);
  }
}
```

### ステップ1.4: プロンプトサービスにレシピ提案機能を追加
**ファイル**: `src/lib/ai/prompts/prompt-service.ts`

```typescript
// 既存のimportとPromptType列挙型に追加
import { recipeRecommendationTemplate, recipeRecommendationMetadata } from './templates/recipe-recommendation/v1';

export enum PromptType {
  // 既存のタイプ...
  RECIPE_RECOMMENDATION = 'recipe-recommendation'
}

// 既存のPromptServiceクラスに追加
export class PromptService {
  // 既存のメソッド...
  
  /**
   * プロンプトテンプレート登録
   */
  private registerPromptTemplates(): void {
    // 既存の登録...
    
    // レシピ提案プロンプト登録
    this.versionManager.registerPromptVersion(
      PromptType.RECIPE_RECOMMENDATION,
      recipeRecommendationTemplate,
      recipeRecommendationMetadata
    );
  }
  
  /**
   * レシピ提案プロンプト生成
   */
  generateRecipeRecommendationPrompt(context: {
    pregnancyWeek: number;
    deficientNutrients: string[];
    excludeIngredients: string[];
    servings: number;
    isFirstTimeUser: boolean;
    currentSeason: string;
    recipeCount: number;
  }): string {
    return this.generatePrompt(PromptType.RECIPE_RECOMMENDATION, {
      ...context,
      deficientNutrients: context.deficientNutrients.join(', '),
      excludeIngredients: context.excludeIngredients.join(', ')
    });
  }
}
```

## タスク2: レシピ提案APIの再構築

### ステップ2.1: レシピ提案APIの更新
**ファイル**: `src/app/api/recommend-recipes/route.ts`

```typescript
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { AIService } from '@/lib/ai/ai-service';
import { withErrorHandling } from '@/lib/errors/error-utils';
import { getCurrentSeason } from '@/lib/utils/date-utils';

// レシピ提案APIエンドポイント
export const POST = withErrorHandling(async (req: Request) => {
  try {
    const { userId, servings = 2, excludeIngredients = [] } = await req.json();
    
    // Supabaseクライアント初期化
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 1. ユーザーの栄養ログを取得
    const { data: nutritionLog, error: logError } = await supabase
      .from('daily_nutrition_logs')
      .select('nutrition_data')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(1)
      .single();

    // 2. ユーザープロファイルを取得
    const { data: userProfile, error: profileError } = await supabase
      .from('pregnancy_profiles')
      .select('pregnancy_week, dietary_restrictions')
      .eq('user_id', userId)
      .single();

    const pregnancyWeek = userProfile?.pregnancy_week || 20;
    const dietaryRestrictions = userProfile?.dietary_restrictions || [];
    
    // 除外食材リスト作成
    const allExcludeIngredients = [...excludeIngredients, ...(dietaryRestrictions || [])];
    
    // 初回ユーザー判定
    const isFirstTimeUser = logError || !nutritionLog;
    
    // 不足栄養素の特定
    let deficientNutrients: string[] = [];
    
    if (isFirstTimeUser) {
      // 妊娠期間に基づいた栄養ニーズをデフォルト設定
      if (pregnancyWeek <= 12) {
        deficientNutrients = ['葉酸', '鉄分', 'ビタミンB6'];
      } else if (pregnancyWeek <= 27) {
        deficientNutrients = ['カルシウム', '鉄分', 'タンパク質'];
      } else {
        deficientNutrients = ['鉄分', 'カルシウム', 'ビタミンD', 'DHA'];
      }
    } else {
      deficientNutrients = nutritionLog?.nutrition_data?.deficient_nutrients || [];
      
      // 不足栄養素がない場合も、妊娠週数に基づいてデフォルト値を提供
      if (deficientNutrients.length === 0) {
        if (pregnancyWeek <= 12) {
          deficientNutrients = ['葉酸', '鉄分'];
        } else if (pregnancyWeek <= 27) {
          deficientNutrients = ['カルシウム', '鉄分'];
        } else {
          deficientNutrients = ['鉄分', 'カルシウム', 'DHA'];
        }
      }
    }
    
    // 現在の季節を取得
    const currentSeason = getCurrentSeason();
    
    // AIサービスを使用してレシピ提案を生成
    const aiService = AIService.getInstance();
    const result = await aiService.getRecipeRecommendations({
      userId,
      pregnancyWeek,
      deficientNutrients,
      excludeIngredients: allExcludeIngredients,
      servings,
      isFirstTimeUser,
      currentSeason,
      recipeCount: 3
    });
    
    // レスポンスを構築
    return NextResponse.json({
      ...result,
      is_first_time_user: isFirstTimeUser
    });
  } catch (error) {
    console.error('Error recommending recipes:', error);
    
    if (error instanceof AIError) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          details: error.details
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'レシピ提案中にエラーが発生しました', details: (error as Error).message },
      { status: 500 }
    );
  }
});
```

## タスク3: レシピ機能のUI/UX強化

### ステップ3.1: レシピ詳細コンポーネントの作成
**ファイル**: `src/components/recipes/recipe-detail.tsx`

```typescript
import React from 'react';
import Image from 'next/image';

type RecipeDetailProps = {
  recipe: {
    title: string;
    description: string;
    ingredients: string[];
    steps: string[];
    nutrients: string[];
    preparation_time: string;
    difficulty: string;
    tips: string;
    imageUrl?: string;
  };
  nutritionTips?: string[];
};

export const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe, nutritionTips }) => {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="relative h-56 w-full">
        {recipe.imageUrl ? (
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-green-100 flex items-center justify-center">
            <span className="text-green-500 text-4xl">🍽️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h1 className="text-white text-2xl font-bold">{recipe.title}</h1>
          <div className="flex items-center text-white text-sm mt-2">
            <span className="mr-4">⏱️ {recipe.preparation_time}</span>
            <span>🔥 {recipe.difficulty}</span>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">栄養価と効果</h2>
          <p className="text-gray-700 mb-4">{recipe.description}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {recipe.nutrients.map((nutrient, index) => (
              <span key={index} className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full">
                {nutrient}
              </span>
            ))}
          </div>
        </div>
        
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">材料</h2>
          <ul className="list-disc pl-5 space-y-1">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index} className="text-gray-700">{ingredient}</li>
            ))}
          </ul>
        </div>
        
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">作り方</h2>
          <ol className="list-decimal pl-5 space-y-3">
            {recipe.steps.map((step, index) => (
              <li key={index} className="text-gray-700">{step}</li>
            ))}
          </ol>
        </div>
        
        {recipe.tips && (
          <div className="mb-6 bg-amber-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">調理のコツ</h2>
            <p className="text-gray-700">{recipe.tips}</p>
          </div>
        )}
        
        {nutritionTips && nutritionTips.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">栄養アドバイス</h2>
            <ul className="list-disc pl-5 space-y-1">
              {nutritionTips.map((tip, index) => (
                <li key={index} className="text-gray-700">{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
```

### ステップ3.2: レシピ検索フィルターの実装
**ファイル**: `src/components/recipes/recipe-filters.tsx`

```typescript
import React, { useState } from 'react';

type RecipeFiltersProps = {
  onFilterChange: (filters: {
    nutrient?: string;
    difficulty?: string;
    maxPreparationTime?: number;
    servings?: number;
    excludeIngredients?: string[];
  }) => void;
};

export const RecipeFilters: React.FC<RecipeFiltersProps> = ({ onFilterChange }) => {
  const [filters, setFilters] = useState({
    nutrient: '',
    difficulty: '',
    maxPreparationTime: 0,
    servings: 2,
    excludeIngredients: [] as string[]
  });
  
  const [ingredientInput, setIngredientInput] = useState('');
  
  const handleFilterChange = (key: string, value: any) => {
    const newFilters = {
      ...filters,
      [key]: value
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  const handleAddIngredient = () => {
    if (ingredientInput && !filters.excludeIngredients.includes(ingredientInput)) {
      const newIngredients = [...filters.excludeIngredients, ingredientInput];
      setFilters({
        ...filters,
        excludeIngredients: newIngredients
      });
      onFilterChange({
        ...filters,
        excludeIngredients: newIngredients
      });
      setIngredientInput('');
    }
  };
  
  const handleRemoveIngredient = (ingredient: string) => {
    const newIngredients = filters.excludeIngredients.filter(item => item !== ingredient);
    setFilters({
      ...filters,
      excludeIngredients: newIngredients
    });
    onFilterChange({
      ...filters,
      excludeIngredients: newIngredients
    });
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <h2 className="text-lg font-semibold mb-4">レシピ検索フィルター</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            栄養素
          </label>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring focus:ring-green-200"
            value={filters.nutrient}
            onChange={(e) => handleFilterChange('nutrient', e.target.value)}
          >
            <option value="">すべて</option>
            <option value="鉄分">鉄分</option>
            <option value="葉酸">葉酸</option>
            <option value="カルシウム">カルシウム</option>
            <option value="タンパク質">タンパク質</option>
            <option value="ビタミンD">ビタミンD</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            難易度
          </label>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring focus:ring-green-200"
            value={filters.difficulty}
            onChange={(e) => handleFilterChange('difficulty', e.target.value)}
          >
            <option value="">すべて</option>
            <option value="簡単">簡単</option>
            <option value="中級">中級</option>
            <option value="難しい">難しい</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            最大調理時間（分）
          </label>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring focus:ring-green-200"
            value={filters.maxPreparationTime}
            onChange={(e) => handleFilterChange('maxPreparationTime', parseInt(e.target.value))}
          >
            <option value="0">制限なし</option>
            <option value="15">15分以内</option>
            <option value="30">30分以内</option>
            <option value="45">45分以内</option>
            <option value="60">60分以内</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            人数
          </label>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring focus:ring-green-200"
            value={filters.servings}
            onChange={(e) => handleFilterChange('servings', parseInt(e.target.value))}
          >
            <option value="1">1人分</option>
            <option value="2">2人分</option>
            <option value="4">4人分</option>
          </select>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          除外したい食材
        </label>
        <div className="flex">
          <input
            type="text"
            className="flex-1 rounded-l-md border-gray-300 shadow-sm focus:border-green-500 focus:ring focus:ring-green-200"
            placeholder="食材名を入力"
            value={ingredientInput}
            onChange={(e) => setIngredientInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddIngredient()}
          />
          <button
            className="bg-green-500 text-white px-4 py-2 rounded-r-md hover:bg-green-600"
            onClick={handleAddIngredient}
          >
            追加
          </button>
        </div>
        
        {filters.excludeIngredients.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {filters.excludeIngredients.map((ingredient, index) => (
              <span
                key={index}
                className="bg-red-50 text-red-700 px-2 py-1 rounded-full text-sm flex items-center"
              >
                {ingredient}
                <button
                  className="ml-1 text-red-500 hover:text-red-700"
                  onClick={() => handleRemoveIngredient(ingredient)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

### ステップ3.3: レシピページの更新
**ファイル**: `src/app/(authenticated)/recipes/[id]/page.tsx`

```typescript
import React from 'react';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RecipeDetail } from '@/components/recipes/recipe-detail';

export default async function RecipeDetailPage({ params }: { params: { id: string }}) {
  const supabase = createServerComponentClient({ cookies });
  
  // セッション確認
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // 未認証の場合はリダイレクト
    return { redirect: { destination: '/login', permanent: false } };
  }
  
  // IDが数値の場合はサーバー側でレシピ生成、それ以外はDBから取得
  let recipe;
  let nutritionTips;
  
  if (!isNaN(Number(params.id))) {
    // その場でAIに生成させる場合
    const { data } = await supabase.functions.invoke('generate-recipe', {
      body: { userId: session.user.id, recipeIndex: Number(params.id) }
    });
    
    recipe = data.recipe;
    nutritionTips = data.nutrition_tips;
  } else {
    // 保存済みレシピの場合
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', params.id)
      .single();
      
    recipe = data;
  }
  
  if (!recipe) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          レシピが見つかりませんでした。
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <RecipeDetail recipe={recipe} nutritionTips={nutritionTips} />
    </div>
  );
}
```

## タスク4: イメージ生成機能の追加（オプション）

### ステップ4.1: レシピ画像生成AIサービスの実装
**ファイル**: `src/lib/ai/ai-service.ts` (追加)

```typescript
/**
 * レシピ画像の生成
 */
async generateRecipeImage(recipeTitle: string, ingredients: string[]): Promise<string> {
  try {
    // プロンプト生成
    const prompt = `健康的な料理の写真: ${recipeTitle}。含まれる主な食材: ${ingredients.join(', ')}。上から見た構図、明るく鮮やかな色調、美味しそうな見た目、プロの料理写真のような高品質な画像。`;
    
    // 画像生成モデル呼び出し
    const model = AIModelFactory.createImageGenerationModel({
      quality: 'hd',
      size: '1024x1024'
    });
    
    const response = await model.generateImage(prompt);
    return response.imageUrl;
  } catch (error) {
    console.error('Recipe image generation error:', error);
    throw new AIError(
      'レシピ画像の生成に失敗しました',
      ErrorCode.AI_MODEL_ERROR,
      error
    );
  }
}
```

### ステップ4.2: AIモデルファクトリーに画像生成モデル作成機能を追加
**ファイル**: `src/lib/ai/model-factory.ts` (追加)

```typescript
/**
 * 画像生成モデルの作成
 */
static createImageGenerationModel(options: {
  quality?: 'standard' | 'hd';
  size?: string;
} = {}): any {
  // Gemini Pro Vision等の画像生成AI実装
  // 実際の実装はGemini APIの仕様に合わせて調整
  return {
    generateImage: async (prompt: string) => {
      // ここにGemini APIの画像生成実装
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY}`
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2048,
          }
        })
      });
      
      const result = await response.json();
      
      // 応答から画像URLを抽出する処理
      // 注: 実際の実装はAPIの仕様に合わせて調整する必要があります
      return {
        imageUrl: result.candidates[0].content.parts[0].inlineData.data || 
                 'https://placeholder.com/400x300'
      };
    }
  };
}
```

## 検証方法

### ステップ別検証

1. **プロンプトテンプレートの検証**: レシピ提案プロンプトが適切に登録され、レンダリングされることを確認
2. **AIサービスのレシピ提案機能テスト**: 様々なパラメータでのレシピ提案が正しく機能することを確認
3. **APIエンドポイントのテスト**: レシピ提案APIが正しくレスポンスを返すことを確認
4. **UIコンポーネントの動作確認**: レシピ詳細やフィルター機能が期待通りに動作することを確認

### ユーザーシナリオテスト

1. **初回ユーザー**: アプリ初回使用時のレシピ提案が適切に行われることを確認
2. **フィルター検索**: 様々なフィルター条件でのレシピ提案が正しく動作することを確認
3. **詳細表示**: レシピ詳細ページが全ての情報を適切に表示することを確認
4. **レスポンシブデザイン**: モバイル・タブレット・デスクトップでの表示が適切であることを確認

## 完了条件

- [ ] AIサービスにレシピ提案機能が追加され、プロンプトが適切に登録されている
- [ ] レシピ提案APIが再構築され、AIサービスを使用している
- [ ] レシピ関連のUIコンポーネントが実装され、正しく表示される
- [ ] レシピフィルター機能が実装され、ユーザーが条件を指定してレシピを検索できる
- [ ] （オプション）レシピ画像生成機能が実装されている

## 次のステップ

この機能の実装が完了したら、以下の追加機能を検討します：

1. **レシピの保存機能**: ユーザーが気に入ったレシピを保存できる機能
2. **栄養素ごとのレシピ推薦**: 特定の栄養素に特化したレシピ推薦機能
3. **食品アレルギー対応**: ユーザーのアレルギー情報に基づいた安全なレシピ提案
4. **季節に合わせたレシピ提案**: 季節の食材を活用したレシピの優先表示 