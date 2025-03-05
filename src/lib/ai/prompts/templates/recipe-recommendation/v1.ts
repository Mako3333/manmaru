/**
 * レシピ推薦プロンプトテンプレート v1
 */

// メタデータ
export const metadata = {
    version: 'v1',
    created: '2024-03-10',
    description: '妊婦向けレシピ推薦プロンプト',
    author: 'manmaru開発チーム'
};

// テンプレート
export const template = `
あなたは妊婦向けの栄養士です。以下の栄養素が不足している妊婦に適したレシピを3つ提案してください。

不足している栄養素: {{deficientNutrients}}
妊娠週数: {{pregnancyWeek}}週（第{{trimester}}期）
除外したい食材: {{excludeIngredients}}
{{#if isFirstTimeUser}}※これは初めてアプリを使用するユーザーです。基本的な栄養情報も含めてください。{{/if}}
今日は{{formattedDate}}で、現在は{{currentSeason}}です。季節に合わせたレシピも提案してください。

提案するレシピは以下の条件を満たすこと:
- {{servings}}人分の分量
- 調理時間30分以内
- 一般的な食材を使用
- 妊婦に安全な食材のみ使用
- 季節の食材を優先的に使用

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

// デフォルトエクスポート
export default { template, metadata }; 