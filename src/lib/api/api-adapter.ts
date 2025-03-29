import { StandardApiResponse } from '@/types/api-interfaces';
import { ErrorCode } from '@/lib/errors/app-errors';
import { NutritionData } from '@/types/nutrition';

/**
 * APIアダプターユーティリティクラス
 * 新旧APIフォーマット間の変換を行う
 */
export class ApiAdapter {
    /**
     * 旧API形式から新API形式（StandardApiResponse）への変換
     * 
     * @param legacyResponse 旧形式のレスポンス
     * @returns 標準API形式のレスポンス
     */
    static convertLegacyToStandard<T>(legacyResponse: any): StandardApiResponse<T> {
        const startTime = performance.now();

        // エラーの検出
        const isError = legacyResponse.error || legacyResponse.errorCode;

        if (isError) {
            return {
                success: false,
                error: {
                    code: legacyResponse.errorCode || ErrorCode.UNKNOWN_ERROR,
                    message: legacyResponse.error || '不明なエラーが発生しました',
                    details: legacyResponse.details || {},
                    suggestions: legacyResponse.suggestions || []
                },
                meta: {
                    processingTimeMs: Math.round(performance.now() - startTime)
                }
            };
        }

        // 成功レスポンスの変換
        return {
            success: true,
            data: legacyResponse.data || legacyResponse as T,
            meta: {
                processingTimeMs: Math.round(performance.now() - startTime),
                ...(legacyResponse.warning ? { warning: legacyResponse.warning } : {})
            }
        };
    }

    /**
     * 新API形式（StandardApiResponse）から旧API形式への変換
     * 
     * @param standardResponse 標準API形式のレスポンス
     * @returns 旧形式のレスポンス
     */
    static convertStandardToLegacy<T>(standardResponse: StandardApiResponse<T>): any {
        if (!standardResponse.success) {
            return {
                error: standardResponse.error?.message || '不明なエラーが発生しました',
                errorCode: standardResponse.error?.code || 'UNKNOWN_ERROR',
                details: standardResponse.error?.details
            };
        }

        return standardResponse.data;
    }

    /**
     * 栄養データの標準形式への変換（特化型ヘルパー）
     * 
     * @param nutritionData 任意の形式の栄養データ
     * @returns 標準化された栄養データ
     */
    static convertToStandardNutrition(nutritionData: any): NutritionData {
        // null/undefined の場合は空のオブジェクトを使用
        const data = nutritionData || {};

        return {
            // 基本栄養素
            calories: data.calories ?? data.energy ?? 0,
            protein: data.protein ?? 0,
            iron: data.iron ?? data.minerals?.iron ?? 0,
            folic_acid: data.folic_acid ?? data.vitamins?.folicAcid ?? 0,
            calcium: data.calcium ?? data.minerals?.calcium ?? 0,
            vitamin_d: data.vitamin_d ?? data.vitamins?.vitaminD ?? 0,

            // 拡張栄養素
            extended_nutrients: {
                fat: data.fat ?? data.extended_nutrients?.fat ?? 0,
                carbohydrate: data.carbohydrate ?? data.extended_nutrients?.carbohydrate ?? 0,
                dietary_fiber: data.dietary_fiber ?? data.dietaryFiber ??
                    data.extended_nutrients?.dietary_fiber ?? 0,
                sugars: data.sugars ?? data.extended_nutrients?.sugars ?? 0,
                salt: data.salt ?? data.extended_nutrients?.salt ?? 0,

                minerals: {
                    sodium: data.minerals?.sodium ?? data.extended_nutrients?.minerals?.sodium ?? 0,
                    potassium: data.minerals?.potassium ??
                        data.extended_nutrients?.minerals?.potassium ?? 0,
                    magnesium: data.minerals?.magnesium ??
                        data.extended_nutrients?.minerals?.magnesium ?? 0,
                    phosphorus: data.minerals?.phosphorus ??
                        data.extended_nutrients?.minerals?.phosphorus ?? 0,
                    zinc: data.minerals?.zinc ?? data.extended_nutrients?.minerals?.zinc ?? 0
                },

                vitamins: {
                    vitamin_a: data.vitamins?.vitaminA ??
                        data.extended_nutrients?.vitamins?.vitamin_a ?? 0,
                    vitamin_b1: data.vitamins?.vitaminB1 ??
                        data.extended_nutrients?.vitamins?.vitamin_b1 ?? 0,
                    vitamin_b2: data.vitamins?.vitaminB2 ??
                        data.extended_nutrients?.vitamins?.vitamin_b2 ?? 0,
                    vitamin_b6: data.vitamins?.vitaminB6 ??
                        data.extended_nutrients?.vitamins?.vitamin_b6 ?? 0,
                    vitamin_b12: data.vitamins?.vitaminB12 ??
                        data.extended_nutrients?.vitamins?.vitamin_b12 ?? 0,
                    vitamin_c: data.vitamins?.vitaminC ??
                        data.extended_nutrients?.vitamins?.vitamin_c ?? 0,
                    vitamin_e: data.vitamins?.vitaminE ??
                        data.extended_nutrients?.vitamins?.vitamin_e ?? 0,
                    vitamin_k: data.vitamins?.vitaminK ??
                        data.extended_nutrients?.vitamins?.vitamin_k ?? 0
                }
            },

            // メタデータ
            confidence_score: data.confidence_score ?? data.confidence ?? 0.8,
            not_found_foods: data.not_found_foods ?? data.notFoundFoods ?? []
        };
    }

    /**
     * 食事解析APIのレスポンスを変換（旧形式→新形式）
     * @param legacyAnalysisResponse 旧形式の食事解析レスポンス
     * @returns 標準API形式の食事解析レスポンス
     */
    static convertMealAnalysisResponse(legacyAnalysisResponse: any): StandardApiResponse<any> {
        // エラーチェック
        if (legacyAnalysisResponse.error) {
            return {
                success: false,
                error: {
                    code: legacyAnalysisResponse.errorCode || 'ANALYSIS_ERROR',
                    message: legacyAnalysisResponse.error,
                    details: legacyAnalysisResponse.details
                }
            };
        }

        // 警告メッセージの抽出
        let warning = undefined;
        if (legacyAnalysisResponse.warning ||
            (legacyAnalysisResponse.nutritionResult?.reliability?.confidence < 0.7)) {
            warning = legacyAnalysisResponse.warning ||
                '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }

        // 処理時間の抽出
        const processingTimeMs = legacyAnalysisResponse.processingTimeMs ||
            legacyAnalysisResponse.duration ||
            legacyAnalysisResponse.processingTime;

        // 標準形式への変換
        return {
            success: true,
            data: {
                foods: legacyAnalysisResponse.foods || legacyAnalysisResponse.recognizedFoods,
                nutritionResult: legacyAnalysisResponse.nutritionResult || legacyAnalysisResponse.nutrition,
                processingTimeMs
            },
            meta: {
                processingTimeMs,
                ...(warning ? { warning } : {})
            }
        };
    }

    /**
     * 食品テキスト解析APIのレスポンスを変換（旧形式→新形式）
     * @param legacyFoodParseResponse 旧形式の食品テキスト解析レスポンス
     * @returns 標準API形式の食品テキスト解析レスポンス
     */
    static convertFoodParseResponse(legacyFoodParseResponse: any): StandardApiResponse<any> {
        if (legacyFoodParseResponse.error) {
            return {
                success: false,
                error: {
                    code: legacyFoodParseResponse.errorCode || 'FOOD_PARSE_ERROR',
                    message: legacyFoodParseResponse.error,
                    details: legacyFoodParseResponse.details
                }
            };
        }

        return {
            success: true,
            data: {
                foods: legacyFoodParseResponse.foods || legacyFoodParseResponse.parsedFoods,
                originalText: legacyFoodParseResponse.originalText || legacyFoodParseResponse.text,
                confidence: legacyFoodParseResponse.confidence ||
                    legacyFoodParseResponse.reliability?.confidence ||
                    0.9
            },
            meta: {
                processingTimeMs: legacyFoodParseResponse.processingTimeMs ||
                    legacyFoodParseResponse.duration
            }
        };
    }

    /**
     * エラーレスポンスを生成
     * @param message エラーメッセージ
     * @param code エラーコード
     * @param details 詳細情報
     * @returns 標準API形式のエラーレスポンス
     */
    static createErrorResponse(
        message: string,
        code: string = 'UNKNOWN_ERROR',
        details?: any
    ): StandardApiResponse<null> {
        return {
            success: false,
            error: {
                code,
                message,
                details
            }
        };
    }
} 