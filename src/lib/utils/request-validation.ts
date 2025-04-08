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
    data: any,
    validators: Array<(data: any) => ValidationResult<Partial<T>>>
): ValidationResult<T> {
    if (!data) {
        return {
            valid: false,
            error: new AppError(
                'リクエストデータが空です',
                ErrorCode.DATA_VALIDATION_ERROR,
                'リクエストデータが提供されていません',
                {},
                'warning',
                ['データを入力してください']
            )
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
export function validateFoodItems(data: any): ValidationResult<{ foodItems: Array<{ name: string; quantity?: string }> }> {
    if (!data.foodItems || !Array.isArray(data.foodItems) || data.foodItems.length === 0) {
        return {
            valid: false,
            error: new AppError(
                '食品アイテムが無効です',
                ErrorCode.DATA_VALIDATION_ERROR,
                '食品リストが提供されていないか無効です',
                { providedData: data },
                'warning',
                ['少なくとも1つの食品アイテムを指定してください']
            )
        };
    }

    // 食品アイテムの構造を検証
    for (const item of data.foodItems) {
        if (!item || typeof item !== 'object' || !item.name || typeof item.name !== 'string') {
            return {
                valid: false,
                error: new AppError(
                    '食品アイテムの形式が無効です',
                    ErrorCode.DATA_VALIDATION_ERROR,
                    '食品アイテムには名前が必要です',
                    { invalidItem: item },
                    'warning',
                    ['すべての食品に名前を指定してください']
                )
            };
        }

        if (item.quantity !== undefined && typeof item.quantity !== 'string') {
            return {
                valid: false,
                error: new AppError(
                    '食品量の形式が無効です',
                    ErrorCode.DATA_VALIDATION_ERROR,
                    '食品量は文字列で指定してください',
                    { invalidItem: item },
                    'warning',
                    ['数量は「100g」や「1個」などのテキスト形式で指定してください']
                )
            };
        }
    }

    return {
        valid: true,
        data: { foodItems: data.foodItems }
    };
}

/**
 * 食品テキスト入力の検証関数
 */
export function validateFoodTextInput(data: any): ValidationResult<{ text: string }> {
    if (!data.text || typeof data.text !== 'string' || data.text.trim() === '') {
        return {
            valid: false,
            error: new AppError(
                '食品テキスト入力が無効です',
                ErrorCode.DATA_VALIDATION_ERROR,
                '食品テキストが提供されていないか無効です',
                { providedText: data.text },
                'warning',
                ['食品の説明を入力してください']
            )
        };
    }

    return {
        valid: true,
        data: { text: data.text.trim() }
    };
}

/**
 * 画像データの検証関数
 */
export function validateImageData(data: any): ValidationResult<{ imageData: string }> {
    if (!data.imageData || typeof data.imageData !== 'string' || !data.imageData.startsWith('data:image/')) {
        return {
            valid: false,
            error: new AppError(
                '画像データが無効です',
                ErrorCode.DATA_VALIDATION_ERROR,
                '有効な画像データが提供されていません',
                {},
                'warning',
                ['Base64エンコードされた画像を提供してください']
            )
        };
    }

    return {
        valid: true,
        data: { imageData: data.imageData }
    };
} 