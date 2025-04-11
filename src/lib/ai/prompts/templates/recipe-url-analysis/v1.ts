// src/lib/ai/prompts/templates/recipe-url-analysis/v1.ts
// import { PromptTemplate } from '../../prompt-utils'; // インポートを削除

// ファイル内でテンプレートの型を定義 (またはインラインで記述)
interface PromptTemplate {
    name: string;
    description: string;
    prompt: (variables: { recipeContent: string }) => string;
    defaultVariables: { recipeContent: string };
}

const template: PromptTemplate = {
    name: 'recipe-url-analysis-v1',
    description: 'ウェブページのテキストコンテンツからレシピ情報を抽出する',
    prompt: (
        variables: { recipeContent: string } // 入力変数名を recipeContent に
    ) => `以下はウェブページから抽出されたテキストコンテンツです。
この内容からレシピ情報をJSON形式で抽出してください。

抽出する情報は以下の通りです。
- title: レシピのタイトル (string)
- servings: 何人分のレシピかを示すテキスト (string, 例: "2人分", "作りやすい分量")。見つからなければ "不明" または null。
- ingredients: 材料リスト (array of objects)。各オブジェクトは以下のキーを持つ。
    - name: 材料名 (string)
    - quantity: 分量 (string, 例: "100g", "大さじ1", "少々")

制約事項:
- 回答はJSON形式のみとし、前後に説明や追加のテキストは含めないでください。
- **材料リスト(ingredients)は、ウェブページの「材料」や「Ingredients」といったセクション、またはそれに類するリスト形式の部分から主に抽出してください。手順中の調味料は含めないでください。**
- **分量が明記されていない、または「適量」「少々」などの場合は quantity を null またはそのテキスト自体にしてください。**
- **材料名は具体的で分かりやすいものにしてください（例：「★醤油」ではなく「醤油」）。**
- レシピ情報（特に材料リスト）が見つからない場合は、空のJSONオブジェクト {} または ingredients が空の配列 [] であるJSONを返してください。
- HTMLタグは除去し、テキスト情報のみを抽出してください。

コンテンツ:
---
${variables.recipeContent}
---

JSON:
`, // ```json とかはモデルによっては不要かも、まずは無しで試す
    defaultVariables: {
        recipeContent: 'ここにウェブページのテキストコンテンツが入ります'
    }
};

export default template;

// メタデータを追加
export const metadata = {
    id: 'recipe-url-analysis', // PromptType と合わせる
    version: 'v1',
    createdAt: new Date(), // 現在日時で作成
    updatedAt: new Date(), // 現在日時で作成
    isActive: true, // アクティブにする
    changelog: '初期バージョン: URLからのレシピ情報抽出'
};