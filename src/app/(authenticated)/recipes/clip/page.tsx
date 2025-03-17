import RecipeClipClient from './recipe-clip-client';

export const metadata = {
    title: 'レシピをクリップ - manmaru',
    description: 'レシピサイトのURLをクリップして栄養情報を自動計算します。',
};

export default async function RecipeClipPage() {
    return <RecipeClipClient />;
} 