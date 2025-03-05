# manmaru - AI機能統合と拡張実装計画

## 1. 概要

manmaruアプリの現状AI機能には以下の課題が存在します：

- `analyze-meal`と`analyze-meal-langchain`で同様ロジックが重複実装
- プロンプト生成ロジックが各APIエンドポイントで独自実装
- エラーハンドリングの統一性がない
- 応答パーサーの活用が限定的


## 0. アプリの目的とゴール

manmaruアプリは妊婦向け栄養管理アプリとして、以下の目標を掲げています：

- **安全な妊娠期間のサポート**: 妊娠期特有の栄養ニーズを満たす支援を提供します。
- **パーソナライズされたアドバイス**: 妊娠週数や栄養状態に応じた個別対応を行います。
- **使いやすい食事管理**: 写真撮影や食品入力を通じて簡単に栄養管理が可能です。
- **信頼性の高い情報提供**: 科学的根拠に基づいた栄養アドバイスを提供します。

## 1. アーキテクチャ統一戦略

### 現状分析

- `analyze-meal/route.ts`: 直接Gemini APIを呼び出しています。
- `recommend-recipes/route.ts`: LangChainを利用しています。
- `nutrition-advice/route.ts`: 直接Gemini APIを呼び出しています。

### 推奨アプローチ

- LangChainを中心としたアーキテクチャを推奨します。
```
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
移行計画
既存コードの段階的な移行（優先順位: 食事分析→栄養アドバイス）
共通インターフェースによる各機能の統一
2. 共通プロンプトライブラリ
推奨アプローチ: テンプレート + コンテキスト分離パターン
この計画では、これらの課題を解決し、将来のレシピ提案機能実装へスムーズに移行するためのステップを定義します。
2. 共通プロンプトライブラリ
推奨アプローチ: テンプレート + コンテキスト分離パターン
```
// プロンプトライブラリ
export const PromptTemplates = {
  // 食品分析プロンプト
  FOOD_ANALYSIS: `
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
        "confidence_score": 信頼度(0.0-1.0)
      }
    }
    
    回答は必ずこのJSONフォーマットのみで返してください。
  `,
  
  // 栄養アドバイスプロンプト
  NUTRITION_ADVICE: `
    あなたは妊婦向け栄養管理アプリ「manmaru」の栄養アドバイザーです。
    現在妊娠{{pregnancyWeek}}週目（第{{trimester}}期）の妊婦に対して、{{adviceType}}アドバイスを作成してください。
    今日は{{formattedDate}}で、現在は{{currentSeason}}です。季節に合わせたアドバイスも含めてください。

    {{#if deficientNutrients.length}}
    特に不足している栄養素: {{deficientNutrients}}
    {{else}}
    現在の栄養状態は良好です。
    {{/if}}

    {{adviceInstructions}}
  `,
  
  // その他必要なプロンプトテンプレート...
};

// テンプレート処理クラス
export class PromptBuilder {
  static build(templateName: keyof typeof PromptTemplates, context: any): string {
    const template = PromptTemplates[templateName];
    return this.renderTemplate(template, context);
  }
  
  private static renderTemplate(template: string, context: any): string {
    // Handlebarsライクなシンプルなテンプレート処理
    // 実際の実装ではHandlebarsやlodashなどの成熟したライブラリの使用を推奨
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const trimmedKey = key.trim();
      if (trimmedKey.startsWith('#if ')) {
        // 条件分岐の簡易実装
        const condition = trimmedKey.substring(4);
        return this.evaluateCondition(condition, context) ? '' : 'none';
      }
      return this.getNestedValue(trimmedKey, context) || '';
    });
  }
  
  private static getNestedValue(path: string, obj: any): any {
    // ネストされたオブジェクトプロパティの取得
    return path.split('.').reduce((prev, curr) => prev && prev[curr], obj);
  }
  
  private static evaluateCondition(condition: string, context: any): boolean {
    // 簡易条件評価
    const value = this.getNestedValue(condition, context);
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
  }
}
```


## 2. 実装優先順位とマイルストーン

### フェーズ1: 基本アーキテクチャ統合 (1週間)
- 共通AIモデルアクセスレイヤーの作成
- 基本エラーハンドリングシステムの統一
- `analyze-meal`と`analyze-meal-langchain`の統合

### フェーズ2: プロンプトシステム刷新 (1週間)
- 共通プロンプトライブラリの作成
- 既存プロンプト生成ロジックの移行
- プロンプトのバージョン管理導入

### フェーズ3: パーサーシステム強化 (1週間)
- 拡張可能なパーサーシステムの実装
- 既存パーサーロジックの移行
- バリデーションシステムの統合

### フェーズ4: レシピ提案機能実装 (2週間)
- レシピ推薦ロジックの設計・実装
- データベースとの連携実装
- UI/UX実装

## 3. 具体的な修正内容と実装手順

docs\implementation\phase1-architecture-integration.md