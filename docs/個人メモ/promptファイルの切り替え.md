# プロンプト管理の最適化アプローチ

現在のGeminiServiceとGeminiResponseParserの実装を確認しました。既存のプロンプト管理システム(`/lib/ai/prompts`)との統合について、以下の観点から検討結果をお伝えします。

## 現状分析

1. **現在の実装**:
   - `GeminiResponseParser`クラス内に直接プロンプトテンプレートがハードコードされている
   - プロンプト生成ロジックと解析ロジックが同じクラスに混在している

2. **既存のプロンプト管理システム**:
   - 構造化されたディレクトリ(`/lib/ai/prompts`)が既に用意されている
   - テンプレートエンジン、バージョン管理などの機能が実装されている
   - 機能別のテンプレートフォルダがある(`food-analysis`, `nutrition-advice`など)

## 推奨アプローチ

**段階的統合アプローチ**を推奨します：

### フェーズ1: 現在のテスト完了までは最小限の変更（短期）

```
推奨アクション:
1. 現状のままで機能テストを完了する
2. プロンプトテキストのみを別ファイルに抽出
   - `src/lib/ai/prompts/gemini-temp-prompts.ts`として別ファイル化
   - 定数としてエクスポートし、GeminiResponseParserから参照
3. コードにTODOコメントを追加して、将来的な統合計画を明示
```

この軽量な対応により、テスト進行を妨げることなく最低限の分離を実現できます。

### フェーズ2: テスト完了後の本格的統合（中期）

```
統合計画:
1. 既存プロンプトシステムの構造に合わせたテンプレート作成
   - `src/lib/ai/prompts/templates/food-analysis/gemini-v1.ts`
   - `src/lib/ai/prompts/templates/recipe-analysis/gemini-v1.ts`

2. バージョン管理への統合
   - version-manager.tsにバージョン情報を追加
   - ABテスト可能な構造への適応

3. テンプレートエンジンの活用
   - 変数置換の活用（ハードコードの排除）
   - 再利用可能な部分テンプレートの特定と分離
```

## 判断理由

1. **テスト優先の原則**:
   - 現在のフェーズ5の機能テストを最優先することが重要
   - 大きなアーキテクチャ変更はテスト後に行うべき

2. **段階的リファクタリング**:
   - 一度にすべてを変更するのではなく、計画的に段階を踏む
   - 最初に最も簡単な「プロンプトテキストの分離」から始める

3. **既存システムの活用**:
   - 既存の`/lib/ai/prompts`システムは洗練されており、最終的にはこれを活用すべき
   - バージョン管理やABテストなどの機能は長期的に価値がある

## 具体的な実装例（フェーズ1）

```typescript
// src/lib/ai/prompts/gemini-temp-prompts.ts
export const FOOD_RECOGNITION_PROMPT = `
あなたは日本の妊婦向け栄養管理アプリの食品認識AIです。
以下の食事情報から含まれる食品を特定し、JSON形式で出力してください。
...
`;

export const RECIPE_ANALYSIS_PROMPT = `
あなたは日本の妊婦向け栄養管理アプリの食品認識AIです。
以下のレシピから使用されている食材を特定し、JSON形式で出力してください。
...
`;
```

```typescript
// src/lib/ai/gemini-response-parser.ts
import { FOOD_RECOGNITION_PROMPT, RECIPE_ANALYSIS_PROMPT } from './prompts/gemini-temp-prompts';

// TODO: 将来的に /lib/ai/prompts システムに統合予定
// - テンプレートエンジンの活用
// - バージョン管理の統合
// - ABテスト対応
generatePrompt(inputData: any): string {
    // 食品認識用のプロンプトテンプレート
    const promptTemplate = FOOD_RECOGNITION_PROMPT;
    
    // 入力データの挿入
    return promptTemplate.replace(
        '# 入力データ\n${入力情報}',
        `# 入力データ\n${inputData.text || inputData.imageDescription || '入力情報なし'}`
    );
}
```

## 長期的な展望

将来的には、GeminiServiceとGeminiResponseParserのロジックも既存のAIサービスアーキテクチャに完全統合することが望ましいですが、それは今回のテスト完了後の次のフェーズとして計画的に進めることをお勧めします。

現在のアプローチでテストを完了させ、その後の統合作業を計画的に行うことで、機能の安定性を確保しながら、長期的なコード品質も向上させることができます。

何か具体的な質問や懸念点があれば、さらに詳細にアドバイスいたします。