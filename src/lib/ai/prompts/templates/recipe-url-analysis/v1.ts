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
- servings: 何人分のレシピかを示すテキスト (string, 例: "2人分", "作りやすい分量")
- ingredients: 材料リスト (array of objects)。各オブジェクトは以下のキーを持つ。
    - name: 材料名 (string)
    - quantity: 分量 (string, 例: "100g", "大さじ1", "少々")

制約事項:
- 回答はJSON形式のみとし、前後に説明や追加のテキストは含めないでください。
- 材料リスト(ingredients)には、手順中の調味料などではなく、準備段階でリストアップされている材料のみを含めてください。
- 分量が不明な場合は quantity を null または空文字列にしてください。
- レシピ情報が見つからない場合は、空のJSONオブジェクト {} を返してください。

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