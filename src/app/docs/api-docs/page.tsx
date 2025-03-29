import ApiDocsComponent from '@/components/docs/api-docs-component';

/**
 * APIドキュメントページ
 */
export default function ApiDocsPage() {
    return (
        <main>
            <ApiDocsComponent />
        </main>
    );
}

export const metadata = {
    title: 'manmaru API v2 ドキュメント',
    description: 'manmaruアプリケーションのAPI v2の使用方法についての説明ドキュメント',
}; 