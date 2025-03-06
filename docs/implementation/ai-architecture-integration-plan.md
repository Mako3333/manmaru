# manmaru - AI機能統合と拡張実装計画（改訂版）

## 0. アプリの目的とゴール

manmaruアプリは妊婦向け栄養管理アプリとして、以下の目標を掲げています：

- **安全な妊娠期間のサポート**: 妊娠期特有の栄養ニーズを満たす支援を提供します。
- **パーソナライズされたアドバイス**: 妊娠週数や栄養状態に応じた個別対応を行います。
- **使いやすい食事管理**: 写真撮影や食品入力を通じて簡単に栄養管理が可能です。
- **信頼性の高い情報提供**: 科学的根拠に基づいた栄養アドバイスを提供します。

## 1. 現状分析と課題

manmaruアプリの現状AI機能には以下の課題が存在します：

- 栄養計算システムの不整合
- UI/UXの一貫性不足
- 日本語対応の不完全さ


## 2. 統合アーキテクチャ戦略

### 2.1 基盤システムの強化

#### 2.1.1 AIモデルアクセスの統一

```typescript
// モデルファクトリークラス - 統一されたインターフェース
export class AIModelFactory {
  static createTextModel(options: ModelOptions = {}) {
    return createGeminiModel("gemini-2.0-flash-001", {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 1024,
      ...options
    });
  }
  
  static createVisionModel(options: ModelOptions = {}) {
    return createGeminiModel("gemini-2.0-flash-001", {
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: options.maxTokens ?? 1024,
      ...options
    });
  }
  
  // モデル作成の統一メソッド
  static createModel(type: 'text' | 'vision', options?: ModelOptions) {
    return type === 'vision' 
      ? this.createVisionModel(options)
      : this.createTextModel(options);
  }
}
```

#### 2.1.2 栄養計算システムの一元化

```typescript
// 栄養計算の中央ロジック
export class NutritionCalculator {
  // 食事データから栄養素を計算する中央ロジック
  static calculateMealNutrition(foods: FoodItem[]): NutritionSummary {
    // 食材ごとの栄養素を集計
    const nutrition = foods.reduce((acc, food) => {
      const quantity = this.parseQuantity(food.quantity);
      return {
        calories: acc.calories + (food.nutrition?.calories || 0) * quantity,
        protein: acc.protein + (food.nutrition?.protein || 0) * quantity,
        iron: acc.iron + (food.nutrition?.iron || 0) * quantity,
        folic_acid: acc.folic_acid + (food.nutrition?.folic_acid || 0) * quantity,
        calcium: acc.calcium + (food.nutrition?.calcium || 0) * quantity,
        vitamin_d: acc.vitamin_d + (food.nutrition?.vitamin_d || 0) * quantity,
      };
    }, this.getEmptyNutrition());
    
    return {
      ...nutrition,
      score: this.calculateBalanceScore(nutrition)
    };
  }
  
  // バランススコア計算ロジック（妊娠期に特化）
  static calculateBalanceScore(nutrition: NutritionValues): number {
    // 妊娠期に重要な栄養素に重み付け
    const weights = {
      protein: 0.25,
      iron: 0.2,
      folic_acid: 0.25,
      calcium: 0.2,
      vitamin_d: 0.1
    };
    
    // 1日の推奨摂取量に対する割合を計算
    const dailyValues = {
      protein: 60, // g
      iron: 27,    // mg
      folic_acid: 400, // μg
      calcium: 1000, // mg
      vitamin_d: 10  // μg
    };
    
    // スコア計算（各栄養素の充足率 × 重み）
    let score = 0;
    for (const [nutrient, weight] of Object.entries(weights)) {
      const value = nutrition[nutrient as keyof typeof nutrition] as number;
      const daily = dailyValues[nutrient as keyof typeof dailyValues];
      // 充足率（最大100%）
      const fulfillment = Math.min(value / daily, 1);
      score += fulfillment * weight * 100;
    }
    
    return Math.round(score);
  }
  
  // 空の栄養素オブジェクト
  static getEmptyNutrition(): NutritionValues {
    return {
      calories: 0,
      protein: 0,
      iron: 0,
      folic_acid: 0,
      calcium: 0,
      vitamin_d: 0
    };
  }
}
```

#### 2.1.3 デザインシステムの確立

```typescript
// デザインシステム定義
export const colors = {
  primary: {
    50: '#e6f7f5',
    100: '#ccefe9',
    200: '#99dfd3',
    300: '#66cfbd',
    400: '#33bfa7',
    500: '#00af91', // メインカラー
    600: '#008c74',
    700: '#006957',
    800: '#00463a',
    900: '#00231d',
  },
  accent: {
    50: '#fdf2f8',
    100: '#fce7f3',
    200: '#fbcfe8',
    300: '#f9a8d4',
    400: '#f472b6',
    500: '#ec4899', // アクセントカラー
    600: '#db2777',
    700: '#be185d',
    800: '#9d174d',
    900: '#831843',
  },
  // 妊娠期に関連する優しい色調
  pregnancy: {
    first: '#8ecae6',  // 第1期
    second: '#219ebc', // 第2期
    third: '#023047',  // 第3期
  }
};

export const typography = {
  fontFamily: {
    sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
};
```

### 2.2 統一プロンプトシステム

#### 2.2.1 基本テンプレート

```typescript
// 基本プロンプトテンプレート
export const baseTemplate = `
あなたは妊婦向け栄養管理アプリ「manmaru」の栄養AIアシスタントです。
以下の情報を考慮して応答してください：

- ユーザーは妊娠{{pregnancyWeek}}週目（第{{trimester}}期）の妊婦です
- 現在の季節は{{currentSeason}}です
- 応答は必ず日本語で行ってください
- 専門用語は避け、わかりやすい言葉で説明してください
- 妊娠期に安全で適切な情報のみを提供してください

{{additionalInstructions}}
`;

// 各機能別テンプレートは基本テンプレートを拡張
export function extendBaseTemplate(additionalTemplate: string): string {
  return baseTemplate.replace('{{additionalInstructions}}', additionalTemplate);
}
```

#### 2.2.2 機能別テンプレート

```typescript
// 食品分析プロンプト
export const foodAnalysisTemplate = extendBaseTemplate(`
この食事の写真から含まれている食品を識別してください。
食事タイプは「{{mealType}}」です。

以下の形式で必ず日本語でJSON形式の応答を返してください:
{
  "foods": [
    {"name": "食品名（日本語）", "quantity": "量の目安（日本語）", "confidence": 信頼度(0.0-1.0)}
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

食品名は必ず日本語で返してください。量の目安も日本語で表現してください。
例: "Rice" → "ご飯"、"100g" → "お茶碗1杯分"
回答は必ずこのJSONフォーマットのみで返してください。
`);

// 栄養アドバイスプロンプト
export const nutritionAdviceTemplate = extendBaseTemplate(`
現在妊娠{{pregnancyWeek}}週目（第{{trimester}}期）の妊婦に対して、{{adviceType}}アドバイスを作成してください。
今日は{{formattedDate}}で、現在は{{currentSeason}}です。季節に合わせたアドバイスも含めてください。

{{#if deficientNutrients.length}}
特に不足している栄養素: {{deficientNutrients}}
{{else}}
現在の栄養状態は良好です。
{{/if}}

以下の形式でマークダウン形式のアドバイスを作成してください：
1. 簡潔な挨拶と状況確認
2. 現在の栄養状態の評価（良い点と改善点）
3. 具体的な食事アドバイス（季節の食材を含む）
4. 簡単に実践できるヒント

アドバイスは親しみやすく、励ましの言葉を含め、300-400文字程度にまとめてください。
`);

// レシピ推薦プロンプト
export const recipeRecommendationTemplate = extendBaseTemplate(`
妊娠{{pregnancyWeek}}週目（第{{trimester}}期）の妊婦に適したレシピを推薦してください。
現在の季節は{{currentSeason}}です。季節の食材を活用したレシピを提案してください。

{{#if deficientNutrients.length}}
特に補いたい栄養素: {{deficientNutrients}}
{{/if}}

{{#if preferences.length}}
食事の好み: {{preferences}}
{{/if}}

{{#if restrictions.length}}
制限事項: {{restrictions}}
{{/if}}

以下の形式でJSON形式の応答を返してください:
{
  "recipes": [
    {
      "name": "レシピ名",
      "description": "簡単な説明",
      "ingredients": [
        {"name": "材料名", "quantity": "量", "unit": "単位"}
      ],
      "steps": [
        {"order": 1, "description": "手順の説明"}
      ],
      "nutrition": {
        "calories": カロリー,
        "protein": タンパク質(g),
        "iron": 鉄分(mg),
        "folic_acid": 葉酸(μg),
        "calcium": カルシウム(mg),
        "vitamin_d": ビタミンD(μg)
      },
      "preparation_time": 準備時間（分）,
      "cooking_time": 調理時間（分）,
      "difficulty": "easy/medium/hard",
      "pregnancy_benefits": "妊娠中の利点の説明"
    }
  ]
}

レシピは必ず妊娠中に安全な食材のみを使用し、第{{trimester}}期の栄養ニーズに適したものを提案してください。
回答は必ずこのJSONフォーマットのみで返してください。
`);
```

## 3. 実装計画（5ステップ）

### STEP 1: 基盤システムの強化（2日間）
1. 栄養計算システムの一元化
   - 中央栄養計算ロジックの実装
   - バランススコア計算の妊娠期特化
   - APIエンドポイントの統一

2. デザインシステムの確立
   - 色彩・タイポグラフィの統一
   - コンポーネントスタイルの標準化
   - レスポンシブデザインの強化

### STEP 2: UI/UX改善の一括適用（2日間）
1. ホーム画面の改善
   - 妊娠週情報カードのモダン化
   - 食事記録ボタンの強調
   - 栄養サマリー表示の修正

2. ダッシュボード画面の改善
   - 栄養バランススコア表示の修正
   - 週間・月間タブの「実装中」表示
   - AIアドバイスのマークダウン対応

### STEP 3: AI機能の統合と日本語化（1日間）
1. プロンプトシステムの統一
   - 基本テンプレートの作成
   - 各機能別テンプレートの統一
   - 日本語応答の徹底

2. レスポンスパーサーの強化
   - エラーハンドリングの改善
   - 応答フォーマットの標準化
   - マークダウン対応の実装

### STEP 4: データフローとプロフィール連携の最適化（1日間）
1. データフロー最適化
   - 栄養データの効率的な取得・計算
   - キャッシュ戦略の実装
   - エラー時の代替表示

2. プロフィール連携の改善
   - 妊娠周数計算の一元化
   - 出産予定日からの自動計算
   - プロフィール更新時の連動処理

### STEP 5: フェーズ4（レシピ提案機能）への接続準備（1日間）
1. データモデルの準備
   - レシピテーブル設計
   - 食材・栄養素マッピング
   - ユーザー嗜好データ構造

2. UI/UXプロトタイプ
   - レシピカードコンポーネント
   - レシピ詳細ページ
   - レシピ検索・フィルター機能

## 4. レシピ提案機能の実装計画

### 4.1 データモデル

```typescript
// レシピ関連の型定義
export interface Recipe {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  preparation_time: number; // 分単位
  cooking_time: number; // 分単位
  difficulty: 'easy' | 'medium' | 'hard';
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  nutrition: RecipeNutrition;
  tags: string[];
  pregnancy_safe: boolean;
  trimester_recommendations: number[]; // 推奨される妊娠期（1, 2, 3）
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
  optional: boolean;
}

export interface RecipeStep {
  order: number;
  description: string;
  image_url?: string;
}

export interface RecipeNutrition {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  iron: number;
  calcium: number;
  folic_acid: number;
  vitamin_d: number;
}
```

### 4.2 レシピ推薦ロジック

レシピ推薦は以下の要素を考慮して行います：

1. 妊娠期（第1期、第2期、第3期）に適した栄養素
2. ユーザーの栄養状態（不足している栄養素）
3. 季節性（旬の食材）
4. ユーザーの好みと制限（アレルギーなど）

```typescript
// レシピ推薦サービス
export class RecipeRecommendationService {
  // 栄養状態に基づくレシピ推薦
  static async recommendByNutrition(
    userId: string,
    date: string,
    count: number = 3
  ): Promise<Recipe[]> {
    // 1. ユーザーの栄養状態を取得
    const nutritionSummary = await NutritionService.getSummary(userId, date);
    
    // 2. 不足している栄養素を特定
    const deficientNutrients = this.identifyDeficientNutrients(nutritionSummary);
    
    // 3. ユーザープロフィールを取得
    const profile = await ProfileService.getProfile(userId);
    
    // 4. 現在の季節を取得
    const currentSeason = DateUtils.getCurrentSeason();
    
    // 5. AIによるレシピ推薦
    const recommendedRecipes = await this.getAIRecommendations({
      pregnancyWeek: profile.pregnancy_week,
      trimester: Math.ceil(profile.pregnancy_week / 13),
      deficientNutrients,
      preferences: profile.food_preferences || [],
      restrictions: profile.food_restrictions || [],
      currentSeason,
      count
    });
    
    return recommendedRecipes;
  }
  
  // AIによるレシピ推薦
  private static async getAIRecommendations(params: RecommendationParams): Promise<Recipe[]> {
    // プロンプトの構築
    const prompt = PromptBuilder.build('RECIPE_RECOMMENDATION', params);
    
    // AIモデルの呼び出し
    const model = AIModelFactory.createTextModel({
      temperature: 0.7,
      maxTokens: 2048
    });
    
    const response = await model.generateContent(prompt);
    
    // レスポンスのパース
    const parsedResponse = ResponseParser.parse(response, 'recipe');
    
    return parsedResponse.recipes;
  }
  
  // 不足している栄養素の特定
  private static identifyDeficientNutrients(summary: NutritionSummary): string[] {
    const deficientNutrients = [];
    const thresholds = {
      protein: 45, // g
      iron: 20,    // mg
      folic_acid: 300, // μg
      calcium: 800, // mg
      vitamin_d: 8  // μg
    };
    
    for (const [nutrient, threshold] of Object.entries(thresholds)) {
      const value = summary[nutrient as keyof typeof summary] as number;
      if (value < threshold) {
        deficientNutrients.push(nutrient);
      }
    }
    
    return deficientNutrients;
  }
}
```

## 5. 技術的特記事項

1. **Next.js 15.2.0とReact 19の互換性**
   - React 19の新機能（useFormStatus, useActionなど）の活用検討
   - Server Componentsの適切な活用

2. **モバイルファーストデザイン**
   - すべてのUI改善はモバイル表示を最優先
   - Touch Targetの適切なサイズ確保（最低44x44px）

3. **AI機能の最適化**
   - プロンプトの日本語指定による応答品質向上
   - コンテキスト（妊娠周数、季節など）の最適活用

4. **パフォーマンス考慮**
   - 不必要なレンダリング防止（useMemo, useCallback）
   - API呼び出しの最適化（キャッシュ戦略）

## 6. 将来の拡張性

1. **多言語対応**
   - 基本テンプレートに言語設定を追加
   - 翻訳システムの統合

2. **オフライン対応**
   - PWA機能の強化
   - ローカルストレージの活用

3. **コミュニティ機能**
   - レシピ共有システム
   - Q&A機能

4. **医療専門家連携**
   - 栄養士・産婦人科医との連携機能
   - 遠隔相談システム