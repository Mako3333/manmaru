/**
 * APIレスポンスの基本的な検証を行います
 */
//src\lib\validation\response-validators.ts
export function validateApiResponse<T>(
    response: unknown,
    options: {
        requireData?: boolean;
        requireItems?: boolean;
        itemsValidator?: (items: unknown[]) => boolean;
    } = {}
): { isValid: boolean; errorMessage?: string; data?: T } {
    const { requireData = true, requireItems = false, itemsValidator } = options;

    // response がオブジェクトであることを確認
    if (typeof response !== 'object' || response === null) {
        return { isValid: false, errorMessage: '無効なレスポンス形式です' };
    }

    // データの存在確認 (型ガードを兼ねる)
    if (requireData && !('data' in response)) {
        return { isValid: false, errorMessage: 'レスポンスにデータが含まれていません' };
    }
    const data = (response as { data?: unknown }).data; // 型アサーション (安全な場合)

    // アイテム配列の確認
    if (requireItems) {
        // data がオブジェクトであることを確認
        if (typeof data !== 'object' || data === null) {
            return { isValid: false, errorMessage: 'データがオブジェクト形式ではありません' };
        }
        if (!('items' in data)) {
            return { isValid: false, errorMessage: 'データにアイテムが含まれていません' };
        }
        const items = (data as { items?: unknown }).items; // 型アサーション

        if (!Array.isArray(items)) {
            return { isValid: false, errorMessage: 'アイテムは配列形式である必要があります' };
        }

        if (items.length === 0) {
            return { isValid: false, errorMessage: 'アイテムが空です' };
        }

        // カスタム検証
        if (itemsValidator && !itemsValidator(items)) {
            return { isValid: false, errorMessage: 'アイテムの内容が無効です' };
        }
    }

    // data を T 型として返す (必要に応じて追加の検証/アサーションを行う)
    return { isValid: true, data: data as T };
}

/**
 * 食品アイテムの検証
 */
export function validateFoodItems(items: unknown[]): boolean {
    return items.every((item): boolean => {
        if (!item || typeof item !== 'object') {
            return false;
        }
        if (!('name' in item)) {
            return false;
        }
        return typeof (item as { name: unknown }).name === 'string';
    });
}

/**
 * レシピデータの検証
 */
export function validateRecipeData(recipe: unknown): boolean {
    if (!recipe || typeof recipe !== 'object') {
        return false;
    }
    if (!('title' in recipe) || typeof (recipe as { title: unknown }).title !== 'string') {
        return false;
    }
    if (!('ingredients' in recipe) || !Array.isArray((recipe as { ingredients: unknown }).ingredients)) {
        return false;
    }
    return true;
}

/**
 * 栄養データの検証
 */
export function validateNutritionData(nutrition: unknown): boolean {
    if (!nutrition || typeof nutrition !== 'object') {
        return false;
    }
    if (!('calories' in nutrition) || typeof (nutrition as { calories: unknown }).calories !== 'number') {
        return false;
    }
    if (!('protein' in nutrition) || typeof (nutrition as { protein: unknown }).protein !== 'number') {
        return false;
    }
    return true;
}

/**
 * URLの検証
 */
export function validateUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * APIリクエストパラメータの検証
 */
export function validateRequestParams<T>(
    params: unknown,
    requiredFields: string[] = []
): { isValid: boolean; errorMessage?: string; data?: T } {
    if (typeof params !== 'object' || params === null) {
        return { isValid: false, errorMessage: 'リクエストパラメータはオブジェクト形式である必要があります' };
    }

    // 必須フィールドのチェック
    for (const field of requiredFields) {
        if (!(field in params) || params[field as keyof typeof params] === undefined || params[field as keyof typeof params] === null) {
            return { isValid: false, errorMessage: `${field}は必須項目です` };
        }
    }

    return { isValid: true, data: params as T };
} 