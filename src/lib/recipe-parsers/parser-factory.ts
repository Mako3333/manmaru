import { RecipeParser } from './parser-interface';
import { CookpadParser } from './cookpad';
import { DelishKitchenParser } from './delishkitchen';
import { KurashiruParser } from './kurashiru';
import { ShirogohanParser } from './shirogohan';
import { GenericParser } from './generic';

/**
 * URLに基づいて適切なレシピパーサーを取得する
 * @param url レシピのURL
 * @returns 適切なRecipeParserの実装
 */
export function getRecipeParser(url: string): RecipeParser {
    try {
        const hostname = new URL(url).hostname.toLowerCase();

        // クックパッド
        if (hostname.includes('cookpad.com')) {
            return new CookpadParser();
        }

        // デリッシュキッチン
        if (hostname.includes('delishkitchen.tv')) {
            return new DelishKitchenParser();
        }

        // クラシル
        if (hostname.includes('kurashiru.com')) {
            return new KurashiruParser();
        }

        // 白ごはん.com
        if (hostname.includes('shirogohan.com') || hostname.includes('shirogoghan.com')) {
            return new ShirogohanParser();
        }

        // その他のサイト → 汎用パーサー
        return new GenericParser();
    } catch (error) {
        // URLが不正な場合など、エラー時も汎用パーサーを返す
        console.warn('URL解析エラー、汎用パーサーを使用します:', error);
        return new GenericParser();
    }
}

/**
 * URLからサイト名を取得する
 * @param url レシピのURL
 * @returns サイト名
 */
export function getSourcePlatformName(url: string): string {
    try {
        const hostname = new URL(url).hostname.toLowerCase();

        if (hostname.includes('cookpad.com')) {
            return 'クックパッド';
        } else if (hostname.includes('delishkitchen.tv')) {
            return 'デリッシュキッチン';
        } else if (hostname.includes('kurashiru.com')) {
            return 'クラシル';
        } else if (hostname.includes('shirogohan.com') || hostname.includes('shirogoghan.com')) {
            return '白ごはん.com';
        } else {
            // ドメイン名をそのまま表示（www. は除去）
            return hostname.replace('www.', '');
        }
    } catch (error) {
        return '不明なサイト';
    }
} 