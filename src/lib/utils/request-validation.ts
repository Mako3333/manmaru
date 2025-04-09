import { AppError, ErrorCode } from '@/lib/error';

/**
 * リクエストデータ検証の結果型
 */
export interface ValidationResult<T> {
    valid: boolean;
    data?: T;
    error?: AppError;
}

/**
 * リクエストデータの検証関数
 * @param data 検証するデータ
 * @param validators 検証関数のリスト
 * @returns 検証結果
 */
export function validateRequestData<T>(
    data: unknown,
    validators: Array<(data: unknown) => ValidationResult<Partial<T>>>
): ValidationResult<T> {
    if (!data) {
        return {
            valid: false,
            error: new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'リクエストデータが空です',
                userMessage: 'リクエストデータが提供されていません',
                severity: 'warning',
                suggestions: ['データを入力してください']
            })
        };
    }

    if (typeof data !== 'object' || data === null) {
        return {
            valid: false,
            error: new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'リクエストデータがオブジェクト形式ではありません',
                userMessage: 'リクエストデータの形式が無効です',
                severity: 'warning',
                suggestions: ['有効なデータを送信してください']
            })
        };
    }

    let validatedData = {} as T;

    for (const validator of validators) {
        const result = validator(data);
        if (!result.valid) {
            return result as ValidationResult<T>;
        }

        if (result.data) {
            validatedData = { ...validatedData, ...result.data };
        }
    }

    return {
        valid: true,
        data: validatedData
    };
}

/**
 * 食品名と量のペアの検証関数
 */
export function validateFoodItems(data: unknown): ValidationResult<{ foodItems: Array<{ name: string; quantity?: string }> }> {
    if (typeof data !== 'object' || data === null) {
        return { valid: false, error: new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: 'データ形式が無効です', userMessage: 'データ形式が無効です' }) };
    }

    if (!('foodItems' in data) || !Array.isArray((data as { foodItems: unknown }).foodItems) || (data as { foodItems: unknown[] }).foodItems.length === 0) {
        return {
            valid: false,
            error: new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '食品アイテムが無効です',
                userMessage: '食品リストが提供されていないか無効です',
                details: { providedData: data },
                severity: 'warning',
                suggestions: ['少なくとも1つの食品アイテムを指定してください']
            })
        };
    }
    const foodItems = (data as { foodItems: Array<{ name?: unknown, quantity?: unknown }> }).foodItems;

    // 食品アイテムの構造を検証
    for (const item of foodItems) {
        if (!item || typeof item !== 'object' || !('name' in item) || typeof item.name !== 'string') {
            return {
                valid: false,
                error: new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: '食品アイテムの形式が無効です',
                    userMessage: '食品アイテムには名前が必要です',
                    details: { invalidItem: item },
                    severity: 'warning',
                    suggestions: ['すべての食品に名前を指定してください']
                })
            };
        }

        if (item.quantity !== undefined && typeof item.quantity !== 'string') {
            return {
                valid: false,
                error: new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: '食品量の形式が無効です',
                    userMessage: '食品量は文字列で指定してください',
                    details: { invalidItem: item },
                    severity: 'warning',
                    suggestions: ['数量は「100g」や「1個」などのテキスト形式で指定してください']
                })
            };
        }
    }

    return {
        valid: true,
        data: { foodItems: foodItems as Array<{ name: string; quantity?: string }> }
    };
}

/**
 * 食品テキスト入力の検証関数
 */
export function validateFoodTextInput(data: unknown): ValidationResult<{ text: string }> {
    if (typeof data !== 'object' || data === null) {
        return { valid: false, error: new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: 'データ形式が無効です', userMessage: 'データ形式が無効です' }) };
    }
    if (!('text' in data) || typeof (data as { text: unknown }).text !== 'string') {
        return {
            valid: false,
            error: new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '食品テキスト入力が無効です',
                userMessage: '食品テキストが提供されていないか無効です',
                details: { providedData: data },
                severity: 'warning',
                suggestions: ['食品の説明を入力してください']
            })
        };
    }
    const text = (data as { text: string }).text;

    if (text.trim() === '') {
        return {
            valid: false,
            error: new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '食品テキスト入力が空です',
                userMessage: '食品テキストが空です',
                details: { providedText: text },
                severity: 'warning',
                suggestions: ['食品の説明を入力してください']
            })
        };
    }

    return {
        valid: true,
        data: { text: text.trim() }
    };
}

/**
 * 画像データの検証関数
 */
export function validateImageData(data: unknown): ValidationResult<{ imageData: string }> {
    if (typeof data !== 'object' || data === null) {
        return { valid: false, error: new AppError({ code: ErrorCode.Base.DATA_VALIDATION_ERROR, message: 'データ形式が無効です', userMessage: 'データ形式が無効です' }) };
    }
    if (!('imageData' in data) || typeof (data as { imageData: unknown }).imageData !== 'string' || !(data as { imageData: string }).imageData.startsWith('data:image/')) {
        return {
            valid: false,
            error: new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: '画像データが無効です',
                userMessage: '有効な画像データが提供されていません',
                severity: 'warning',
                suggestions: ['Base64エンコードされた画像を提供してください']
            })
        };
    }
    const imageData = (data as { imageData: string }).imageData;

    return {
        valid: true,
        data: { imageData }
    };
} 