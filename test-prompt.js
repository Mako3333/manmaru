const fs = require('fs');
const path = require('path');

// テンプレートエンジンの簡易実装
class SimpleTemplateEngine {
    static render(template, context = {}) {
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
            return context[key.trim()] || '';
        });
    }
}

// 食品分析プロンプトテンプレート
const foodAnalysisTemplate = `
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

// テスト用のコンテキスト
const context = {
    mealType: '朝食',
    trimester: 2
};

// テンプレートをレンダリング
const renderedPrompt = SimpleTemplateEngine.render(foodAnalysisTemplate, context);

// 結果を表示
console.log('=== 食品分析プロンプト ===');
console.log(renderedPrompt);

// ファイルに保存（オプション）
fs.writeFileSync(path.join(__dirname, 'rendered-prompt.txt'), renderedPrompt);
console.log('\nプロンプトを rendered-prompt.txt に保存しました');
