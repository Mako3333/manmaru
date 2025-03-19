/**
 * ソーシャルメディアのディープリンクを生成するユーティリティ
 */

/**
 * プラットフォームとコンテンツIDからディープリンクを生成
 * @param platform プラットフォーム ('instagram' | 'tiktok')
 * @param contentId コンテンツID
 * @param fallbackUrl フォールバック用のWeb URL
 * @returns void
 */
export const openDeepLink = (
    platform: 'instagram' | 'tiktok',
    contentId: string,
    fallbackUrl: string
): void => {
    // モバイルかどうかを検出
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (!isMobile) {
        // PCの場合は直接Webブラウザで開く
        window.open(fallbackUrl, '_blank');
        return;
    }

    // モバイルの場合はディープリンクを試す
    let deepLink = '';

    if (platform === 'instagram') {
        // Instagram
        if (fallbackUrl.includes('/p/')) {
            // 投稿
            deepLink = `instagram://p/${contentId}`;
        } else if (fallbackUrl.includes('/reel/')) {
            // リール
            deepLink = `instagram://reel/${contentId}`;
        } else {
            // その他
            deepLink = `instagram://media?id=${contentId}`;
        }
    } else if (platform === 'tiktok') {
        // TikTok
        deepLink = `tiktok://video/${contentId}`;
    }

    if (deepLink) {
        // ディープリンクを試行
        window.location.href = deepLink;

        // 一定時間後にフォールバック（アプリが開かない場合）
        setTimeout(() => {
            // 現在のURLと異なる場合のみフォールバック（アプリが開いた場合は不要）
            if (document.hidden === false) {
                window.location.href = fallbackUrl;
            }
        }, 2000);
    } else {
        // ディープリンクが生成できない場合は直接Webで開く
        window.open(fallbackUrl, '_blank');
    }
};

/**
 * オリジナルのソーシャルメディアリンクを開く
 * @param recipe レシピオブジェクト
 */
export const openOriginalSocialMedia = (
    sourceUrl: string,
    sourcePlatform?: string,
    contentId?: string
): void => {
    if (!sourceUrl) return;

    // プラットフォーム判定
    if (sourcePlatform === 'Instagram' && contentId) {
        openDeepLink('instagram', contentId, sourceUrl);
    } else if (sourcePlatform === 'TikTok' && contentId) {
        openDeepLink('tiktok', contentId, sourceUrl);
    } else {
        // その他のプラットフォーム（普通のWebサイト）
        window.open(sourceUrl, '_blank');
    }
}; 