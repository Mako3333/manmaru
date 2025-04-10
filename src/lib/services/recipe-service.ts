//src\lib\services\recipe-service.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { AppError, ErrorCode } from '@/lib/error';
import { validateUrl } from '@/lib/validation/response-validators';
import { convertDbFormatToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';
import { SupabaseClient } from '@supabase/supabase-js';

export class RecipeService {
    /**
     * レシピをIDで取得
     */
    static async getRecipeById(recipeId: string, userId?: string) {
        try {
            const cookieStore = await cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        get(name: string) {
                            return cookieStore.get(name)?.value;
                        },
                        set(name: string, value: string, options: CookieOptions) {
                            // cookieStore.set({ name, value, ...options }); // 変更前: ガイドライン違反
                            // Service層からはCookie書き込みを行わないため no-op
                        },
                        remove(name: string, options: CookieOptions) {
                            // cookieStore.delete({ name, ...options }); // 変更前: ガイドライン違反
                            // Service層からはCookie書き込みを行わないため no-op
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
                const standardizedNutrition = convertDbFormatToStandardizedNutrition(recipe.nutrition_per_serving as Record<string, unknown> | null);
                return {
                    ...recipe,
                    nutrition_per_serving: standardizedNutrition
                };
            }

            return recipe;
        } catch (error) {
            if (error instanceof AppError) {
                // すでに AppError の場合はそのままスロー
                throw error;
            }

            // AppError でない場合は UNKNOWN_ERROR としてラップしてスロー
            throw new AppError({
                code: ErrorCode.Base.API_ERROR, // API_ERROR がより適切か
                message: `レシピ取得中に予期せぬエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: 'レシピの取得中に予期しない問題が発生しました。',
                details: { originalError: error },
                severity: 'error' // 深刻度を追加
            });
        }
    }

    /**
     * レシピのお気に入り状態を切り替え
     */
    static async toggleFavorite(recipeId: string, userId: string) {
        try {
            const cookieStore = await cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        get(name: string) {
                            return cookieStore.get(name)?.value;
                        },
                        set(name: string, value: string, options: CookieOptions) {
                            // cookieStore.set({ name, value, ...options }); // 変更前: ガイドライン違反
                            // Service層からはCookie書き込みを行わないため no-op
                        },
                        remove(name: string, options: CookieOptions) {
                            // cookieStore.delete({ name, ...options }); // 変更前: ガイドライン違反
                            // Service層からはCookie書き込みを行わないため no-op
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
            if (error instanceof AppError) {
                // すでに AppError の場合はそのままスロー
                throw error;
            }

            // AppError でない場合は UNKNOWN_ERROR としてラップしてスロー
            throw new AppError({
                code: ErrorCode.Base.API_ERROR, // API_ERROR がより適切か
                message: `お気に入り更新中に予期せぬエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: 'お気に入り状態の更新中に予期しない問題が発生しました。',
                details: { originalError: error },
                severity: 'error',
                suggestions: ['しばらく経ってからもう一度お試しください'] // 提案を追加
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
                throw new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: 'URLからコンテンツIDを抽出できませんでした',
                    userMessage: '正しいSNS投稿URLを入力してください',
                    details: { url },
                    severity: 'error'
                });
            }

            // OGPデータの取得
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            }).catch(error => {
                throw new AppError({
                    code: ErrorCode.Base.NETWORK_ERROR,
                    message: `URLからのデータ取得エラー: ${error.message}`,
                    userMessage: 'URLからデータを取得できませんでした',
                    details: { error },
                    severity: 'error'
                });
            });

            if (!response || !response.ok) {
                throw new AppError({
                    code: ErrorCode.Base.NETWORK_ERROR,
                    message: `URLからのデータ取得に失敗しました (${response?.status || 'Unknown'})`,
                    userMessage: 'URLからデータを取得できませんでした',
                    details: { status: response?.status },
                    severity: 'error'
                });
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
            if (error instanceof AppError) {
                // すでに AppError の場合はそのままスロー
                throw error;
            }

            console.error('parseRecipeFromUrl error:', error);
            // AppError でない場合は UNKNOWN_ERROR としてラップしてスロー
            throw new AppError({
                code: ErrorCode.Base.DATA_PROCESSING_ERROR, // データ処理中のエラーとする
                message: `URL解析中に予期せぬエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: 'レシピURLの解析中に予期しない問題が発生しました。',
                details: { originalError: error },
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
            const cookieStore = await cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        get(name: string) {
                            return cookieStore.get(name)?.value;
                        },
                        set(name: string, value: string, options: CookieOptions) {
                            // cookieStore.set({ name, value, ...options }); // 変更前: ガイドライン違反
                            // Service層からはCookie書き込みを行わないため no-op
                        },
                        remove(name: string, options: CookieOptions) {
                            // cookieStore.delete({ name, ...options }); // 変更前: ガイドライン違反
                            // Service層からはCookie書き込みを行わないため no-op
                        },
                    },
                }
            );

            // Supabaseクエリを構築
            let selectColumns = '*'; // デフォルトは全カラム
            if (includeNutrition) {
                selectColumns = '*'; // 全カラム取得
            } else {
                // nutrition_per_serving を除外するロジックが必要な場合はここで具体的なカラムを指定
                selectColumns = 'id, user_id, title, image_url, source_url, source_platform, content_id, recipe_type, ingredients, caution_foods, caution_level, is_favorite, servings, clipped_at, last_used_at, created_at, updated_at, is_social_media, use_placeholder';
            }

            const query = supabase
                .from('clipped_recipes')
                .select(selectColumns, { count: 'exact' })
                .eq('user_id', userId)
                .eq('is_favorite', true)
                .order('updated_at', { ascending: false })
                .range(offset, offset + limit - 1);

            const { data: recipes, error, count } = await query;

            if (error) {
                throw new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: `お気に入りレシピ取得エラー: ${error.message}`,
                    userMessage: 'お気に入りレシピの取得中にエラーが発生しました',
                    details: error,
                    severity: 'error'
                });
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
            if (error instanceof AppError) {
                // すでに AppError の場合はそのままスロー
                throw error;
            }

            console.error('お気に入りレシピ取得エラー:', error);
            // AppError でない場合は UNKNOWN_ERROR としてラップしてスロー
            throw new AppError({
                code: ErrorCode.Base.API_ERROR, // API_ERROR がより適切か
                message: `お気に入りレシピ取得中に予期せぬエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: 'お気に入りレシピの取得中に予期しない問題が発生しました。',
                details: { originalError: error },
                severity: 'error'
            });
        }
    }
}

/**
 * HTMLからメタコンテンツを抽出する関数
 */
function extractMetaContent(html: string, name: string): string | null {
    const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']|<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, 'i');
    const match = html.match(regex);
    return match ? (match[1] || match[2] || null) : null;
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