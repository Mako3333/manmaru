// テスト環境のグローバル設定を行うファイル
// 例: jestのモックやグローバル関数の設定など

// テスト用のモック
jest.mock('./src/lib/ai/prompts/templates/food-analysis/v1', () => ({
    template: `
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
`,
    default: `
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
`,
    metadata: {
        id: 'food-analysis',
        version: 'v1',
        createdAt: new Date('2023-04-01'),
        updatedAt: new Date('2023-04-01'),
        isActive: true,
        changelog: '初期バージョン'
    }
}));

jest.mock('./src/lib/ai/prompts/templates/nutrition-advice/v1', () => ({
    template: `
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
`,
    default: `
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
`,
    metadata: {
        id: 'nutrition-advice',
        version: 'v1',
        createdAt: new Date('2023-04-01'),
        updatedAt: new Date('2023-04-01'),
        isActive: true,
        changelog: '初期バージョン'
    }
}));

jest.mock('./src/lib/ai/prompts/templates/text-input-analysis/v1', () => ({
    template: `
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
`,
    default: `
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
`,
    metadata: {
        id: 'text-input-analysis',
        version: 'v1',
        createdAt: new Date('2023-04-01'),
        updatedAt: new Date('2023-04-01'),
        isActive: true,
        changelog: '初期バージョン'
    }
})); 