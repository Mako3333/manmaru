/**
 * APIレスポンスの基本的な検証を行います
 */
//src\lib\validation\response-validators.ts
export function validateApiResponse<T>(
    response: any,
    options: {
        requireData?: boolean;
        requireItems?: boolean;
        itemsValidator?: (items: any[]) => boolean;
    } = {}
): { isValid: boolean; errorMessage?: string; data?: T } {
    const { requireData = true, requireItems = false, itemsValidator } = options;

    // データの存在確認
    if (requireData && !response.data) {
        return { isValid: false, errorMessage: 'レスポンスにデータが含まれていません' };
    }

    // アイテム配列の確認
    if (requireItems) {
        if (!response.data.items) {
            return { isValid: false, errorMessage: 'レスポンスにアイテムが含まれていません' };
        }

        if (!Array.isArray(response.data.items)) {
            return { isValid: false, errorMessage: 'アイテムは配列形式である必要があります' };
        }

        if (response.data.items.length === 0) {
            return { isValid: false, errorMessage: 'アイテムが空です' };
        }

        // カスタム検証
        if (itemsValidator && !itemsValidator(response.data.items)) {
            return { isValid: false, errorMessage: 'アイテムの内容が無効です' };
        }
    }

    return { isValid: true, data: response.data as T };
}

/**
 * 食品アイテムの検証
 */
export function validateFoodItems(items: any[]): boolean {
    return items.every(item =>
        item &&
        typeof item === 'object' &&
        item.name &&
        typeof item.name === 'string'
    );
}

/**
 * レシピデータの検証
 */
export function validateRecipeData(recipe: any): boolean {
    return (
        recipe &&
        typeof recipe === 'object' &&
        recipe.title &&
        typeof recipe.title === 'string' &&
        recipe.ingredients &&
        Array.isArray(recipe.ingredients)
    );
}

/**
 * 栄養データの検証
 */
export function validateNutritionData(nutrition: any): boolean {
    return (
        nutrition &&
        typeof nutrition === 'object' &&
        typeof nutrition.calories === 'number' &&
        typeof nutrition.protein === 'number'
    );
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
    params: any,
    requiredFields: string[] = []
): { isValid: boolean; errorMessage?: string; data?: T } {
    if (!params) {
        return { isValid: false, errorMessage: 'リクエストパラメータが必要です' };
    }

    // 必須フィールドのチェック
    for (const field of requiredFields) {
        if (params[field] === undefined || params[field] === null) {
            return { isValid: false, errorMessage: `${field}は必須項目です` };
        }
    }

    return { isValid: true, data: params as T };
} 