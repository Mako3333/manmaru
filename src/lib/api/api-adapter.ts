import { StandardApiResponse } from '@/types/api-interfaces';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { NutritionData, StandardizedMealNutrition, FoodItemNutrition } from '@/types/nutrition';
import { convertToLegacyNutrition, convertToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';

// Helper type guard to check if an object has a specific property
function hasProperty<K extends string>(obj: unknown, key: K): obj is { [P in K]: unknown } {
    return typeof obj === 'object' && obj !== null && key in obj;
}

// Helper type guard to check if a value is a string
function isString(value: unknown): value is string {
    return typeof value === 'string';
}

// Helper type guard to check if a value is an object (and not null)
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * APIアダプターユーティリティクラス
 * 新旧APIフォーマット間の変換を行う
 */
export class ApiAdapter {
    /**
     * 旧API形式から新API形式（StandardApiResponse）への変換
     *
     * @param legacyResponse 旧形式のレスポンス (型は不明)
     * @returns 標準API形式のレスポンス
     */
    static convertLegacyToStandard<T>(legacyResponse: unknown): StandardApiResponse<T> {
        const startTime = performance.now();

        // エラーコードとメッセージを取得するヘルパー関数
        const getLegacyError = (): { code: string; message: string; details: unknown; suggestions: string[] } => {
            let code: string = ErrorCode.Base.UNKNOWN_ERROR;
            let message = '不明なエラーが発生しました';
            let details: unknown = {};
            let suggestions: string[] = [];

            if (isObject(legacyResponse)) {
                if (hasProperty(legacyResponse, 'errorCode') && isString(legacyResponse.errorCode) && legacyResponse.errorCode) {
                    code = legacyResponse.errorCode;
                }
                if (hasProperty(legacyResponse, 'error') && isString(legacyResponse.error) && legacyResponse.error) {
                    message = legacyResponse.error;
                } else if (hasProperty(legacyResponse, 'message') && isString(legacyResponse.message) && legacyResponse.message) {
                    message = legacyResponse.message;
                }
                if (hasProperty(legacyResponse, 'details')) {
                    details = legacyResponse.details;
                }
                if (hasProperty(legacyResponse, 'suggestions') && Array.isArray(legacyResponse.suggestions)) {
                    suggestions = legacyResponse.suggestions.filter(isString);
                }
            }
            return { code, message, details, suggestions };
        };

        // エラーの検出 (errorCode または error プロパティの存在を確認)
        const isError = isObject(legacyResponse) && (
            (hasProperty(legacyResponse, 'errorCode') && legacyResponse.errorCode) ||
            (hasProperty(legacyResponse, 'error') && legacyResponse.error)
        );


        if (isError) {
            const { code, message, details, suggestions } = getLegacyError();
            return {
                success: false,
                error: {
                    code,
                    message,
                    details,
                    suggestions
                },
                meta: {
                    processingTimeMs: Math.round(performance.now() - startTime)
                }
            };
        }

        // 警告メッセージの取得
        const warning = (isObject(legacyResponse) && hasProperty(legacyResponse, 'warning') && isString(legacyResponse.warning))
            ? legacyResponse.warning
            : undefined;

        // 成功レスポンスの変換
        // T 型へのキャストは呼び出し元の責任とするが、基本的な構造は保証する
        const data = (isObject(legacyResponse) && hasProperty(legacyResponse, 'data'))
            ? legacyResponse.data
            : legacyResponse; // data プロパティがない場合は legacyResponse 全体を data とする

        return {
            success: true,
            data: data as T, // キャストは必要だが、型安全ではない点に注意
            meta: {
                processingTimeMs: Math.round(performance.now() - startTime),
                ...(warning ? { warning } : {})
            }
        };
    }

    /**
     * 新API形式（StandardApiResponse）から旧API形式への変換
     *
     * @param standardResponse 標準API形式のレスポンス
     * @returns 旧形式のレスポンス (型は保証されない)
     */
    static convertStandardToLegacy<T>(standardResponse: StandardApiResponse<T>): Record<string, unknown> {
        if (!standardResponse.success) {
            // エラー情報を旧形式にマッピング
            const errorData: Record<string, unknown> = {
                error: standardResponse.error?.message || '不明なエラーが発生しました',
                errorCode: standardResponse.error?.code || ErrorCode.Base.UNKNOWN_ERROR
            };
            if (standardResponse.error?.details) {
                errorData.details = standardResponse.error.details;
            }
            if (standardResponse.error?.suggestions && standardResponse.error.suggestions.length > 0) {
                errorData.suggestions = standardResponse.error.suggestions;
            }
            return errorData;
        }

        // 成功時、data フィールドの内容を返す
        // data がオブジェクトでない場合もそのまま返す (旧APIの仕様に依存)
        return isObject(standardResponse.data)
            ? { ...standardResponse.data } // スプレッド構文でオブジェクトとして返す
            : { data: standardResponse.data }; // オブジェクトでない場合は data プロパティに入れる (旧API形式に合わせる必要があるか要確認)
    }


    /**
     * 栄養データの標準形式への変換（特化型ヘルパー）
     * 旧形式の NutritionData (プロパティが snake_case や camelCase が混在) を
     * NutritionData (camelCase) に正規化する。
     *
     * @param nutritionData 任意の形式の栄養データ (型は不明)
     * @returns NutritionData (camelCase) 形式の栄養データ
     */
    static convertToStandardNutrition(nutritionData: unknown): NutritionData {
        const data = isObject(nutritionData) ? nutritionData : {}; // オブジェクトでなければ空オブジェクト

        // 安全に値を取得するヘルパー関数
        const safeGetNumber = (obj: Record<string, unknown>, ...keys: string[]): number => {
            for (const key of keys) {
                if (hasProperty(obj, key) && typeof obj[key] === 'number') {
                    return obj[key] as number;
                }
            }
            return 0;
        };
        const safeGetArray = <ItemType>(obj: Record<string, unknown>, ...keys: string[]): ItemType[] => {
            for (const key of keys) {
                if (hasProperty(obj, key) && Array.isArray(obj[key])) {
                    return obj[key] as ItemType[];
                }
            }
            return [];
        };
        const safeGetObject = (obj: Record<string, unknown>, ...keys: string[]): Record<string, unknown> => {
            for (const key of keys) {
                if (hasProperty(obj, key) && isObject(obj[key])) {
                    return obj[key] as Record<string, unknown>;
                }
            }
            return {};
        };


        // 拡張栄養素オブジェクトを安全に取得
        const extended = safeGetObject(data, 'extended_nutrients', 'extendedNutrients');
        const minerals = safeGetObject(extended, 'minerals');
        const vitamins = safeGetObject(extended, 'vitamins');

        return {
            calories: safeGetNumber(data, 'calories', 'energy'),
            protein: safeGetNumber(data, 'protein'),
            fat: safeGetNumber(data, 'fat') || safeGetNumber(extended, 'fat'), // extendedからも取得
            carbohydrate: safeGetNumber(data, 'carbohydrate') || safeGetNumber(extended, 'carbohydrate'),
            iron: safeGetNumber(data, 'iron') || safeGetNumber(minerals, 'iron'),
            folic_acid: safeGetNumber(data, 'folic_acid', 'folicAcid') || safeGetNumber(vitamins, 'folic_acid', 'folicAcid', 'folate'),
            calcium: safeGetNumber(data, 'calcium') || safeGetNumber(minerals, 'calcium'),
            vitamin_d: safeGetNumber(data, 'vitamin_d', 'vitaminD') || safeGetNumber(vitamins, 'vitamin_d', 'vitaminD'),
            // dietaryFiber は NutritionData 型に存在しない -> extended_nutrients 内に移動
            // sugars は NutritionData 型に存在しない -> extended_nutrients 内に移動
            // salt は NutritionData 型に存在しない -> extended_nutrients 内に移動
            confidence_score: safeGetNumber(data, 'confidence_score', 'confidence') || 0.8, // デフォルト値も設定
            not_found_foods: safeGetArray<string>(data, 'not_found_foods', 'notFoundFoods'),

            extended_nutrients: {
                // NutritionData 型に合わせて camelCase で統一
                dietaryFiber: safeGetNumber(data, 'dietaryFiber', 'dietary_fiber') || safeGetNumber(extended, 'dietary_fiber', 'dietaryFiber'),
                sugars: safeGetNumber(data, 'sugars') || safeGetNumber(extended, 'sugars'),
                salt: safeGetNumber(data, 'salt') || safeGetNumber(extended, 'salt'),
                minerals: {
                    sodium: safeGetNumber(minerals, 'sodium'),
                    potassium: safeGetNumber(minerals, 'potassium'),
                    magnesium: safeGetNumber(minerals, 'magnesium'),
                    phosphorus: safeGetNumber(minerals, 'phosphorus'),
                    zinc: safeGetNumber(minerals, 'zinc'),
                },
                vitamins: {
                    vitaminA: safeGetNumber(vitamins, 'vitamin_a', 'vitaminA'),
                    vitaminB1: safeGetNumber(vitamins, 'vitamin_b1', 'vitaminB1'),
                    vitaminB2: safeGetNumber(vitamins, 'vitamin_b2', 'vitaminB2'),
                    vitaminB6: safeGetNumber(vitamins, 'vitamin_b6', 'vitaminB6'),
                    vitaminB12: safeGetNumber(vitamins, 'vitamin_b12', 'vitaminB12'),
                    vitaminC: safeGetNumber(vitamins, 'vitamin_c', 'vitaminC'),
                    vitaminE: safeGetNumber(vitamins, 'vitamin_e', 'vitaminE'),
                    vitaminK: safeGetNumber(vitamins, 'vitamin_k', 'vitaminK'),
                },
            },
        };
    }

    /**
     * 栄養データを標準化フォーマットに変換するV2ヘルパー
     * @param nutritionData NutritionData形式の栄養データ
     * @returns StandardizedMealNutrition形式の栄養データ
     */
    static convertToStandardizedNutritionFormat(nutritionData: NutritionData): StandardizedMealNutrition {
        return convertToStandardizedNutrition(nutritionData);
    }

    /**
     * 標準化された栄養データをレガシーフォーマットに変換するV2ヘルパー
     * @param standardizedData StandardizedMealNutrition形式の栄養データ
     * @returns NutritionData形式の栄養データ
     */
    static convertToLegacyNutritionFormat(standardizedData: StandardizedMealNutrition): NutritionData {
        return convertToLegacyNutrition(standardizedData);
    }

    /**
     * 食事解析APIのレスポンスを変換（旧形式→新形式）
     * @param legacyAnalysisResponse 旧形式の食事解析レスポンス (型は不明)
     * @returns 標準API形式の食事解析レスポンス (データ型は StandardizedMealNutrition | null)
     */
    static convertMealAnalysisResponse(legacyAnalysisResponse: unknown): StandardApiResponse<StandardizedMealNutrition | null> {
        const startTime = performance.now();

        // オブジェクトでない場合はエラーとして扱う
        if (!isObject(legacyAnalysisResponse)) {
            return {
                success: false,
                error: {
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: '無効なレスポンス形式です (オブジェクトではありません)',
                },
                meta: { processingTimeMs: Math.round(performance.now() - startTime) }
            };
        }

        // エラーチェック
        const isError = (hasProperty(legacyAnalysisResponse, 'error') && legacyAnalysisResponse.error) ||
            (hasProperty(legacyAnalysisResponse, 'errorCode') && legacyAnalysisResponse.errorCode);

        if (isError) {
            const code = (hasProperty(legacyAnalysisResponse, 'errorCode') && isString(legacyAnalysisResponse.errorCode))
                ? legacyAnalysisResponse.errorCode
                : ErrorCode.AI.ANALYSIS_ERROR;
            const message = (hasProperty(legacyAnalysisResponse, 'error') && isString(legacyAnalysisResponse.error))
                ? legacyAnalysisResponse.error
                : '食事解析中にエラーが発生しました';
            const details = hasProperty(legacyAnalysisResponse, 'details') ? legacyAnalysisResponse.details : undefined;

            return {
                success: false,
                error: { code, message, details },
                meta: { processingTimeMs: Math.round(performance.now() - startTime) }
            };
        }

        // 警告メッセージの抽出
        let warning: string | undefined = undefined;
        // 確信度を安全に取得
        const confidence = (hasProperty(legacyAnalysisResponse, 'nutritionResult') && isObject(legacyAnalysisResponse.nutritionResult) &&
            hasProperty(legacyAnalysisResponse.nutritionResult, 'reliability') && isObject(legacyAnalysisResponse.nutritionResult.reliability) &&
            hasProperty(legacyAnalysisResponse.nutritionResult.reliability, 'confidence') && typeof legacyAnalysisResponse.nutritionResult.reliability.confidence === 'number')
            ? legacyAnalysisResponse.nutritionResult.reliability.confidence
            : (hasProperty(legacyAnalysisResponse, 'confidence') && typeof legacyAnalysisResponse.confidence === 'number')
                ? legacyAnalysisResponse.confidence
                : undefined;

        if (hasProperty(legacyAnalysisResponse, 'warning') && isString(legacyAnalysisResponse.warning)) {
            warning = legacyAnalysisResponse.warning;
        } else if (confidence != null && confidence < 0.7) {
            warning = '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }

        // 処理時間を安全に取得
        const processingTimeMs = Math.round(
            (hasProperty(legacyAnalysisResponse, 'processingTimeMs') && typeof legacyAnalysisResponse.processingTimeMs === 'number') ? legacyAnalysisResponse.processingTimeMs :
                (hasProperty(legacyAnalysisResponse, 'duration') && typeof legacyAnalysisResponse.duration === 'number') ? legacyAnalysisResponse.duration :
                    (hasProperty(legacyAnalysisResponse, 'processingTime') && typeof legacyAnalysisResponse.processingTime === 'number') ? legacyAnalysisResponse.processingTime :
                        (performance.now() - startTime) // フォールバック
        );

        // 栄養データを StandardizedMealNutrition 形式に変換
        let standardizedNutrition: StandardizedMealNutrition | null = null;
        const nutritionResultData = (hasProperty(legacyAnalysisResponse, 'nutritionResult') && isObject(legacyAnalysisResponse.nutritionResult))
            ? legacyAnalysisResponse.nutritionResult : null;
        const nutritionData = nutritionResultData && hasProperty(nutritionResultData, 'nutrition')
            ? nutritionResultData.nutrition
            : (hasProperty(legacyAnalysisResponse, 'nutrition')) ? legacyAnalysisResponse.nutrition : null;

        if (nutritionData) {
            // どのような形式の入力であっても NutritionData (camelCase) 形式に変換を試みる
            const intermediateLegacyNutrition = ApiAdapter.convertToStandardNutrition(nutritionData);
            // その後、StandardizedMealNutrition 形式に変換
            standardizedNutrition = ApiAdapter.convertToStandardizedNutritionFormat(intermediateLegacyNutrition);
        }

        // 食品リストを安全に取得
        const foods = (hasProperty(legacyAnalysisResponse, 'foods') && Array.isArray(legacyAnalysisResponse.foods))
            ? legacyAnalysisResponse.foods
            : (hasProperty(legacyAnalysisResponse, 'recognizedFoods') && Array.isArray(legacyAnalysisResponse.recognizedFoods))
                ? legacyAnalysisResponse.recognizedFoods
                : [];

        // standardizedNutrition の foodItems を更新（もし foods があれば）
        if (standardizedNutrition && foods.length > 0) {
            standardizedNutrition.foodItems = foods.map(food => food as any);
        }


        // 標準形式への変換
        return {
            success: true,
            data: standardizedNutrition, // 変換後のデータ
            meta: {
                processingTimeMs,
                ...(warning ? { warning } : {})
                // foods は StandardizedMealNutrition.foodItems に含まれるため、metaからは削除しても良いか検討
                // ...(foods.length > 0 ? { recognizedFoods: foods } : {})
            }
        };
    }

    /**
     * 食品解析APIのレスポンスを変換（旧形式→新形式）
     * @param legacyFoodParseResponse 旧形式の食品解析レスポンス (型は不明)
     * @returns 標準API形式の食品解析レスポンス (データ型はFoodItemNutrition[])
     */
    static convertFoodParseResponse(legacyFoodParseResponse: unknown): StandardApiResponse<FoodItemNutrition[]> {
        const startTime = performance.now();

        // オブジェクトでない場合はエラー
        if (!isObject(legacyFoodParseResponse)) {
            return {
                success: false,
                error: {
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: '無効なレスポンス形式です (オブジェクトではありません)',
                },
                meta: { processingTimeMs: Math.round(performance.now() - startTime) }
            };
        }

        // エラーチェック
        const isError = (hasProperty(legacyFoodParseResponse, 'error') && legacyFoodParseResponse.error) ||
            (hasProperty(legacyFoodParseResponse, 'errorCode') && legacyFoodParseResponse.errorCode);

        if (isError) {
            const code = (hasProperty(legacyFoodParseResponse, 'errorCode') && isString(legacyFoodParseResponse.errorCode))
                ? legacyFoodParseResponse.errorCode
                : ErrorCode.AI.PARSING_ERROR;
            const message = (hasProperty(legacyFoodParseResponse, 'error') && isString(legacyFoodParseResponse.error))
                ? legacyFoodParseResponse.error
                : '食品解析中にエラーが発生しました';
            return {
                success: false,
                error: { code, message },
                meta: { processingTimeMs: Math.round(performance.now() - startTime) }
            };
        }

        // 食品リストを安全に取得
        const foodItems = (hasProperty(legacyFoodParseResponse, 'foods') && Array.isArray(legacyFoodParseResponse.foods))
            ? legacyFoodParseResponse.foods
            : (hasProperty(legacyFoodParseResponse, 'parsed_foods') && Array.isArray(legacyFoodParseResponse.parsed_foods))
                ? legacyFoodParseResponse.parsed_foods
                : [];

        // foodItems を FoodItemNutrition[] にキャスト (適切な変換が必要だが、一旦 any キャストで対応)
        // TODO: foodItems の各要素を FoodItemNutrition に変換する関数を実装する
        const standardizedFoodItems: FoodItemNutrition[] = foodItems.map(item => item as any); // any キャストは一時的


        return {
            success: true,
            data: standardizedFoodItems,
            meta: {
                processingTimeMs: Math.round(performance.now() - startTime)
            }
        };
    }


    /**
     * 標準化されたエラーレスポンスを作成
     * @param message エラーメッセージ
     * @param code エラーコード (デフォルト: UNKNOWN_ERROR)
     * @param details エラー詳細 (任意)
     * @returns 標準API形式のエラーレスポンス
     */
    static createErrorResponse(
        message: string,
        code: string = ErrorCode.Base.UNKNOWN_ERROR,
        details?: unknown // details は任意の型を受け入れる
    ): StandardApiResponse<null> {
        return {
            success: false,
            error: {
                code,
                message,
                details
            },
            meta: {
                processingTimeMs: 0 // エラー生成時は0でよいか、または計測するか
            }
        };
    }
} 