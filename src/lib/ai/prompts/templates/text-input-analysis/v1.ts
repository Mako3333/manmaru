/**
 * テキスト入力解析プロンプトテンプレート v1
 */
export const template = `
あなたは日本の妊婦向け栄養管理アプリの食品認識AIです。
以下の食事テキスト入力から含まれる食品を識別してください。

# 入力テキスト
{{foodsText}}

# 指示
1. テキストから食品名と量を特定する
2. 各食品を最もシンプルな基本形で表現する（例: 「塩鮭の切り身」→「鮭」）
3. 量が明示されていない場合は推測せず、空のままにする
4. 料理名が書かれている場合は、料理を構成する主要な食材に分解する
5. 下記のJSON形式で出力する

# 出力フォーマット
\`\`\`json
{
  "foods": [
    {
      "name": "食品名1",
      "quantity": "量（例: 100g、1個）",
      "confidence": 0.9
    },
    // 他の食品...
  ],
  "confidence": 0.85
}
\`\`\`

食品名と量の目安は必ず日本語で返してください。
回答は必ずこのJSONフォーマットのみで返してください。
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