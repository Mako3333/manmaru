//src\lib\services\recipe-service.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { AppError, ErrorCode } from '@/lib/error';
import { validateUrl } from '@/lib/validation/response-validators';
import { convertToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';
import { SupabaseClient } from '@supabase/supabase-js';

export class RecipeService {
    /**
     * レシピをIDで取得
     */
    static async getRecipeById(recipeId: string, userId?: string) {
        try {
            const cookieStore = cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        get(name: string) {
                            return cookieStore.get(name)?.value;
                        },
                        set(name: string, value: string, options: CookieOptions) {
                            cookieStore.set({ name, value, ...options });
                        },
                        remove(name: string, options: CookieOptions) {
                            cookieStore.delete({ name, ...options });
                        },
                    },
                }
            );

            // レシピデータ取得
            const { data: recipe, error } = await supabase
                .from('clipped_recipes')
                .select('*')
                .eq('id', recipeId)
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new AppError({
                        code: ErrorCode.Base.DATA_NOT_FOUND,
                        message: `レシピが見つかりません: ${recipeId}`,
                        userMessage: 'レシピが見つかりませんでした',
                        details: error,
                        severity: 'error',
                        suggestions: ['レシピIDを確認してください']
                    });
                }
                throw new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: `レシピ取得エラー: ${error.message}`,
                    userMessage: 'レシピの取得中にエラーが発生しました',
                    details: error,
                    severity: 'error'
                });
            }

            if (!recipe) {
                throw new AppError({
                    code: ErrorCode.Base.DATA_NOT_FOUND,
                    message: `レシピが見つかりません: ${recipeId}`,
                    userMessage: 'レシピが見つかりませんでした',
                    details: { recipeId },
                    severity: 'error'
                });
            }

            // 栄養データを標準化フォーマットに変換
            if (recipe.nutrition_per_serving) {
                // DB形式からStandardizedMealNutrition形式に変換
                const standardizedNutrition = convertToStandardizedNutrition(recipe.nutrition_per_serving);
                return {
                    ...recipe,
                    nutrition_per_serving: standardizedNutrition
                };
            }

            return recipe;
        } catch (error) {
            if (error instanceof AppError) throw error;

            throw new AppError({
                code: ErrorCode.Base.API_ERROR,
                message: `レシピ取得エラー: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: 'レシピの取得中にエラーが発生しました',
                details: error,
                severity: 'error'
            });
        }
    }

    /**
     * レシピのお気に入り状態を切り替え
     */
    static async toggleFavorite(recipeId: string, userId: string) {
        try {
            const cookieStore = cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        get(name: string) {
                            return cookieStore.get(name)?.value;
                        },
                        set(name: string, value: string, options: CookieOptions) {
                            cookieStore.set({ name, value, ...options });
                        },
                        remove(name: string, options: CookieOptions) {
                            cookieStore.delete({ name, ...options });
                        },
                    },
                }
            );

            // レシピの存在確認
            await RecipeService.getRecipeById(recipeId, userId);

            // お気に入り状態の更新
            const { data: updatedRecipe, error } = await supabase
                .from('clipped_recipes')
                .update({
                    is_favorite: true, // 一旦trueにし、後で反転させる
                    updated_at: new Date().toISOString()
                })
                .eq('id', recipeId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                throw new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: `お気に入り更新エラー: ${error.message}`,
                    userMessage: 'お気に入り状態の更新中にエラーが発生しました',
                    details: error,
                    severity: 'error',
                    suggestions: ['しばらく経ってからもう一度お試しください']
                });
            }

            // 状態を反転
            const { data: finalRecipe, error: toggleError } = await supabase
                .from('clipped_recipes')
                .update({
                    is_favorite: !updatedRecipe.is_favorite,
                    updated_at: new Date().toISOString()
                })
                .eq('id', recipeId)
                .eq('user_id', userId)
                .select()
                .single();

            if (toggleError) {
                throw new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: `お気に入り更新エラー: ${toggleError.message}`,
                    userMessage: 'お気に入り状態の更新中にエラーが発生しました',
                    details: toggleError,
                    severity: 'error',
                    suggestions: ['しばらく経ってからもう一度お試しください']
                });
            }

            return {
                recipeId,
                isFavorite: finalRecipe.is_favorite
            };
        } catch (error) {
            if (error instanceof AppError) throw error;

            throw new AppError({
                code: ErrorCode.Base.API_ERROR,
                message: `お気に入り更新エラー: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: 'お気に入り状態の更新中にエラーが発生しました',
                details: error,
                severity: 'error',
                suggestions: ['しばらく経ってからもう一度お試しください']
            });
        }
    }

    /**
     * 外部URLからレシピデータを解析
     */
    static async parseRecipeFromUrl(url: string) {
        try {
            // URLの妥当性チェック
            if (!url || !validateUrl(url)) {
                throw new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: '無効なURL',
                    userMessage: '有効なURLを入力してください',
                    severity: 'warning'
                });
            }

            // URLのドメインを確認
            const domain = new URL(url).hostname;

            // ソーシャルメディアの判断
            let platform = '';
            let contentId: string | undefined = '';

            if (url.includes('instagram.com')) {
                platform = 'instagram';
                // Instagram IDの抽出
                const match = url.match(/instagram\.com\/(?:p|reel)\/([^\/\?]+)/);
                contentId = match ? match[1] : undefined;
            } else if (url.includes('tiktok.com')) {
                platform = 'tiktok';
                // TikTok IDの抽出
                const match = url.match(/tiktok\.com\/[@\w]+\/video\/(\d+)/);
                contentId = match ? match[1] : undefined;
            } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
                platform = 'youtube';
                // YouTube IDの抽出
                const match = url.includes('youtu.be')
                    ? url.match(/youtu\.be\/([^\/\?]+)/)
                    : url.match(/youtube\.com\/watch\?v=([^&]+)/);
                contentId = match ? match[1] : undefined;
            } else if (url.includes('pinterest.com') || url.includes('pin.it')) {
                platform = 'pinterest';
                // Pinterest IDの抽出
                const match = url.match(/pinterest\.com\/pin\/(\d+)/);
                contentId = match ? match[1] : undefined;
            } else if (domain.includes('cookpad.com')) {
                platform = 'cookpad';
                // クックパッドIDの抽出
                const match = url.match(/cookpad\.com\/recipe\/(\d+)/);
                contentId = match ? match[1] : '';
            } else if (domain.includes('kurashiru.com')) {
                platform = 'kurashiru';
                // クラシルIDの抽出
                const match = url.match(/kurashiru\.com\/recipes\/([^\/\?]+)/);
                contentId = match ? match[1] : '';
            } else {
                platform = 'other';
            }

            // コンテンツIDがない場合はエラー（ソーシャルの場合のみ）
            if ((platform === 'instagram' || platform === 'tiktok') && !contentId) {
                throw new AppError(
                    'URLからコンテンツIDを抽出できませんでした',
                    ErrorCode.DATA_VALIDATION_ERROR,
                    '正しいSNS投稿URLを入力してください',
                    {},
                    'error',
                    [],
                    400
                );
            }

            // OGPデータの取得
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            }).catch(error => {
                throw new AppError(
                    `URLからのデータ取得エラー: ${error.message}`,
                    ErrorCode.API_REQUEST_FAILED,
                    'URLからデータを取得できませんでした',
                    {},
                    'error',
                    [],
                    400
                );
            });

            if (!response || !response.ok) {
                throw new AppError(
                    `URLからのデータ取得に失敗しました (${response?.status || 'Unknown'})`,
                    ErrorCode.API_REQUEST_FAILED,
                    'URLからデータを取得できませんでした',
                    {},
                    'error',
                    [],
                    400
                );
            }

            const html = await response.text();

            // HTMLからメタデータを抽出
            const title = (extractMetaContent(html, 'og:title') ||
                extractMetaContent(html, 'twitter:title')) ??
                `${platform}のレシピ`;

            const imageUrl = (extractMetaContent(html, 'og:image') ||
                extractMetaContent(html, 'twitter:image')) ?? '';

            const description = (extractMetaContent(html, 'og:description') ||
                extractMetaContent(html, 'twitter:description')) ??
                '';

            // レシピデータの構築（サイトタイプによって処理が異なる）
            const recipeData = {
                title,
                image_url: imageUrl,
                source_url: url,
                source_platform: getPlatformName(platform),
                content_id: contentId,
                ingredients: [], // 対応サイトの場合は後ほど抽出
                nutrition_per_serving: {
                    calories: 0,
                    protein: 0,
                    iron: 0,
                    folic_acid: 0,
                    calcium: 0,
                    vitamin_d: 0
                },
                is_social_media: platform === 'instagram' || platform === 'tiktok',
                description
            };

            // サイト別の追加処理
            if (platform === 'cookpad' || platform === 'kurashiru') {
                // ここで材料抽出などのサイト別処理を行う
                // 今回は簡易的な実装のため省略
            }

            return recipeData;
        } catch (error) {
            if (error instanceof AppError) throw error;

            throw new AppError({
                code: ErrorCode.Base.API_ERROR,
                message: `レシピ解析エラー: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: 'レシピの解析中にエラーが発生しました',
                details: error,
                severity: 'error'
            });
        }
    }

    /**
     * ユーザーのお気に入りレシピを取得
     */
    static async getUserFavorites(userId: string, options: {
        page?: number;
        limit?: number;
        includeNutrition?: boolean;
    } = {}) {
        const { page = 1, limit = 10, includeNutrition = false } = options;
        const offset = (page - 1) * limit;

        try {
            const cookieStore = cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        get(name: string) {
                            return cookieStore.get(name)?.value;
                        },
                        set(name: string, value: string, options: CookieOptions) {
                            cookieStore.set({ name, value, ...options });
                        },
                        remove(name: string, options: CookieOptions) {
                            cookieStore.delete({ name, ...options });
                        },
                    },
                }
            );

            let query = supabase
                .from('clipped_recipes')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .eq('is_favorite', true)
                .order('updated_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (includeNutrition) {
                query = query.select('nutrition_per_serving');
            }

            const { data: recipes, error, count } = await query;

            if (error) {
                throw new AppError(
                    `お気に入りレシピ取得エラー: ${error.message}`,
                    ErrorCode.API_ERROR,
                    'お気に入りレシピの取得中にエラーが発生しました',
                    {},
                    'error',
                    [],
                    500
                );
            }

            return {
                recipes: recipes || [],
                pagination: {
                    total: count || 0,
                    page,
                    limit,
                    totalPages: Math.ceil((count || 0) / limit)
                }
            };
        } catch (error) {
            if (error instanceof AppError) throw error;

            throw new AppError(
                `お気に入りレシピ取得エラー: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.API_ERROR,
                'お気に入りレシピの取得中にエラーが発生しました',
                {},
                'error',
                [],
                500
            );
        }
    }
}

/**
 * HTMLからメタコンテンツを抽出する関数
 */
function extractMetaContent(html: string, name: string): string | null {
    const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']|<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, 'i');
    const match = html.match(regex);
    return match ? match[1] || match[2] : null;
}

/**
 * プラットフォーム名を取得する関数
 */
function getPlatformName(platform: string): string {
    switch (platform) {
        case 'instagram': return 'Instagram';
        case 'tiktok': return 'TikTok';
        case 'cookpad': return 'クックパッド';
        case 'kurashiru': return 'クラシル';
        default: return 'その他のサイト';
    }
} 