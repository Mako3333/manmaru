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