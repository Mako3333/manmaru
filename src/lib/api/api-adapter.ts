import { StandardApiResponse } from '@/types/api-interfaces';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { NutritionData, StandardizedMealNutrition, FoodItem, Nutrient, FoodItemNutrition, NutrientUnit } from '@/types/nutrition';
import { convertToLegacyNutrition, convertToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';
import { AppError } from '@/lib/error/types/base-error';

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

// StandardizedMealNutrition の foodItems の型エイリアスを定義（可読性のため）
type StandardFoodItem = StandardizedMealNutrition['foodItems'][number];

// nutrition-utils の findNutrientValue と同様のロジックを実装
const findNutrientValueInStandardized = (nutrients: Nutrient[], nameJP: string, nameEN: string, defaultValue: number = 0): number => {
    const nutrient = nutrients.find(n => {
        if (!n || !n.name) return false;
        const lowerCaseName = n.name.toLowerCase();
        return lowerCaseName === nameJP.toLowerCase() || lowerCaseName === nameEN.toLowerCase();
    });
    return nutrient?.value ?? defaultValue;
};

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
     * エラーレスポンスを生成するヘルパー関数
     *
     * @param message エラーメッセージ
     * @param code エラーコード (デフォルト: 不明なエラー)
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

    convertMealAnalysisResponse(response: unknown): StandardizedMealNutrition {
        // response の型を unknown に変更
        // TODO: Zod などで response の構造を検証するのが望ましい
        if (
            !response ||
            typeof response !== 'object' ||
            !('totalCalories' in response) || typeof response.totalCalories !== 'number' ||
            !('totalNutrients' in response) || !Array.isArray(response.totalNutrients) ||
            !('foodItems' in response) || !Array.isArray(response.foodItems)
            // reliability のチェックも追加
            || !('reliability' in response) || typeof response.reliability !== 'object'
        ) {
            throw new AppError({
                code: ErrorCode.AI.PARSING_ERROR,
                message: 'Invalid meal analysis response structure from external API.',
                details: { responseStructure: JSON.stringify(response, null, 2) } // 詳細情報として構造を文字列化
            });
        }

        // ここで response を StandardizedMealNutrition として扱うが、内部配列の要素も検証が必要
        // foodItems や totalNutrients の各要素が期待する型かどうかのチェックは省略 (要改善)
        return response as StandardizedMealNutrition;
    }

    convertFoodParseResponse(response: unknown): StandardizedMealNutrition[] {
        // response の型を unknown に変更
        if (!Array.isArray(response)) {
            throw new AppError({
                code: ErrorCode.AI.PARSING_ERROR,
                message: 'Invalid food parse response structure (not an array) from external API.',
                details: { responseType: typeof response }
            });
        }

        // 各要素が StandardizedMealNutrition の形式かチェック (簡易)
        return response.map((item, index) => {
            if (
                !item ||
                typeof item !== 'object' ||
                !('totalCalories' in item) || typeof item.totalCalories !== 'number' ||
                !('totalNutrients' in item) || !Array.isArray(item.totalNutrients) ||
                !('foodItems' in item) || !Array.isArray(item.foodItems)
                || !('reliability' in item) || typeof item.reliability !== 'object' // reliability チェック追加
            ) {
                throw new AppError({
                    code: ErrorCode.AI.PARSING_ERROR,
                    message: `Invalid food item structure in parse response (index: ${index}).`,
                    details: { itemStructure: JSON.stringify(item, null, 2) }
                });
            }
            // ここも安全ではないキャスト、要改善
            return item as StandardizedMealNutrition;
        });
    }

    convertToStandardizedNutritionFormat(foods: StandardFoodItem[]): StandardizedMealNutrition {
        const totalCalories = foods.reduce((sum, food) => sum + (food.nutrition.calories ?? 0), 0);
        const totalNutrientsMap = new Map<string, { value: number; unit: NutrientUnit }>();

        foods.forEach(food => {
            food.nutrition.nutrients?.forEach(nutrient => {
                const existing = totalNutrientsMap.get(nutrient.name);
                if (existing) {
                    existing.value += nutrient.value;
                } else {
                    totalNutrientsMap.set(nutrient.name, { value: nutrient.value, unit: nutrient.unit });
                }
            });
        });

        const totalNutrients: Nutrient[] = Array.from(totalNutrientsMap.entries()).map(([name, { value, unit }]) => ({
            name,
            value,
            unit,
        }));

        const calculatedConfidence = foods.reduce((sum, food) => sum + (food.confidence ?? 0.7), 0) / (foods.length || 1);
        const reliability: StandardizedMealNutrition['reliability'] = {
            confidence: Math.min(1, Math.max(0, calculatedConfidence)),
        };

        const standardizedNutrition: StandardizedMealNutrition = {
            totalCalories,
            totalNutrients,
            foodItems: foods,
            reliability,
        };

        return standardizedNutrition;
    }

    convertToLegacyNutritionFormat(nutrition: StandardizedMealNutrition | NutritionData): NutritionData {
        if ('totalCalories' in nutrition && 'totalNutrients' in nutrition) {
            // StandardizedMealNutrition から NutritionData へ変換
            const legacyData: Partial<NutritionData> & { extended_nutrients?: NonNullable<NutritionData['extended_nutrients']> } = {
                calories: nutrition.totalCalories,
                protein: findNutrientValueInStandardized(nutrition.totalNutrients, 'タンパク質', 'protein', 0),
                iron: findNutrientValueInStandardized(nutrition.totalNutrients, '鉄分', 'iron', 0),
                folic_acid: findNutrientValueInStandardized(nutrition.totalNutrients, '葉酸', 'folic_acid', 0),
                calcium: findNutrientValueInStandardized(nutrition.totalNutrients, 'カルシウム', 'calcium', 0),
                vitamin_d: findNutrientValueInStandardized(nutrition.totalNutrients, 'ビタミンD', 'vitamin_d', 0),
                confidence_score: nutrition.reliability?.confidence ?? 0.9,
                extended_nutrients: {
                    fat: findNutrientValueInStandardized(nutrition.totalNutrients, '脂質', 'fat'),
                    carbohydrate: findNutrientValueInStandardized(nutrition.totalNutrients, '炭水化物', 'carbohydrate'),
                    dietary_fiber: findNutrientValueInStandardized(nutrition.totalNutrients, '食物繊維', 'dietary_fiber'),
                    sugars: findNutrientValueInStandardized(nutrition.totalNutrients, '糖質', 'sugars'),
                    salt: findNutrientValueInStandardized(nutrition.totalNutrients, '食塩相当量', 'salt'),
                    minerals: {},
                    vitamins: {},
                }
            };

            nutrition.totalNutrients?.forEach(nut => {
                const nutNameLower = nut.name.toLowerCase();
                const nutValue = nut.value;

                if (!legacyData.extended_nutrients) return;

                switch (nutNameLower) {
                    // Minerals (修正: スプレッド構文ではなく直接代入)
                    case 'ナトリウム': case 'sodium': if (legacyData.extended_nutrients.minerals) legacyData.extended_nutrients.minerals.sodium = nutValue; break;
                    case 'カリウム': case 'potassium': if (legacyData.extended_nutrients.minerals) legacyData.extended_nutrients.minerals.potassium = nutValue; break;
                    case 'マグネシウム': case 'magnesium': if (legacyData.extended_nutrients.minerals) legacyData.extended_nutrients.minerals.magnesium = nutValue; break;
                    case 'リン': case 'phosphorus': if (legacyData.extended_nutrients.minerals) legacyData.extended_nutrients.minerals.phosphorus = nutValue; break;
                    case '亜鉛': case 'zinc': if (legacyData.extended_nutrients.minerals) legacyData.extended_nutrients.minerals.zinc = nutValue; break;
                    // Vitamins (修正: スプレッド構文ではなく直接代入)
                    case 'ビタミンa': case 'vitamin_a': if (legacyData.extended_nutrients.vitamins) legacyData.extended_nutrients.vitamins.vitamin_a = nutValue; break;
                    case 'ビタミンb1': case 'vitamin_b1': if (legacyData.extended_nutrients.vitamins) legacyData.extended_nutrients.vitamins.vitamin_b1 = nutValue; break;
                    case 'ビタミンb2': case 'vitamin_b2': if (legacyData.extended_nutrients.vitamins) legacyData.extended_nutrients.vitamins.vitamin_b2 = nutValue; break;
                    case 'ビタミンb6': case 'vitamin_b6': if (legacyData.extended_nutrients.vitamins) legacyData.extended_nutrients.vitamins.vitamin_b6 = nutValue; break;
                    case 'ビタミンb12': case 'vitamin_b12': if (legacyData.extended_nutrients.vitamins) legacyData.extended_nutrients.vitamins.vitamin_b12 = nutValue; break;
                    case 'ビタミンc': case 'vitamin_c': if (legacyData.extended_nutrients.vitamins) legacyData.extended_nutrients.vitamins.vitamin_c = nutValue; break;
                    case 'ビタミンe': case 'vitamin_e': if (legacyData.extended_nutrients.vitamins) legacyData.extended_nutrients.vitamins.vitamin_e = nutValue; break;
                    case 'ビタミンk': case 'vitamin_k': if (legacyData.extended_nutrients.vitamins) legacyData.extended_nutrients.vitamins.vitamin_k = nutValue; break;
                    case 'コリン': case 'choline': if (legacyData.extended_nutrients.vitamins) legacyData.extended_nutrients.vitamins.choline = nutValue; break;
                }
            });

            return legacyData as NutritionData;
        } else if ('calories' in nutrition) {
            return nutrition as NutritionData;
        } else {
            throw new AppError({
                code: ErrorCode.Base.DATA_PROCESSING_ERROR,
                message: 'Invalid nutrition data format for legacy conversion.',
                details: { inputType: typeof nutrition }
            });
        }
    }
} 