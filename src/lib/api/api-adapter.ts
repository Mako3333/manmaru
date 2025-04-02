import { StandardApiResponse } from '@/types/api-interfaces';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { NutritionData, StandardizedMealNutrition } from '@/types/nutrition';
import { convertToLegacyNutrition, convertToStandardizedNutrition } from '@/lib/nutrition/nutrition-type-utils';

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
                    code: legacyResponse.errorCode || ErrorCode.Base.UNKNOWN_ERROR,
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
        const data = nutritionData || {};

        // 拡張栄養素を先に展開しておく
        const extended = data.extended_nutrients || {};
        const minerals = extended.minerals || data.minerals || {};
        const vitamins = extended.vitamins || data.vitamins || {};

        return {
            calories: data.calories ?? data.energy ?? 0,
            protein: data.protein ?? 0,
            fat: data.fat ?? extended.fat ?? 0,
            carbohydrate: data.carbohydrate ?? extended.carbohydrate ?? 0,
            iron: data.iron ?? minerals.iron ?? 0,
            folic_acid: data.folic_acid ?? vitamins.folic_acid ?? vitamins.folate ?? 0,
            calcium: data.calcium ?? minerals.calcium ?? 0,
            vitamin_d: data.vitamin_d ?? data.vitaminD ?? vitamins.vitamin_d ?? vitamins.vitaminD ?? 0,
            dietaryFiber: data.dietaryFiber ?? data.dietary_fiber ?? extended.dietary_fiber ?? 0,
            sugars: data.sugars ?? extended.sugars ?? 0,
            salt: data.salt ?? extended.salt ?? 0,
            confidence_score: data.confidence_score ?? data.confidence ?? 0.8,
            not_found_foods: data.not_found_foods ?? data.notFoundFoods ?? [],

            extended_nutrients: {
                minerals: {
                    sodium: minerals.sodium ?? 0,
                    potassium: minerals.potassium ?? 0,
                    magnesium: minerals.magnesium ?? 0,
                    phosphorus: minerals.phosphorus ?? 0,
                    zinc: minerals.zinc ?? 0,
                },
                vitamins: {
                    vitamin_a: vitamins.vitamin_a ?? vitamins.vitaminA ?? 0,
                    vitamin_b1: vitamins.vitamin_b1 ?? vitamins.vitaminB1 ?? 0,
                    vitamin_b2: vitamins.vitamin_b2 ?? vitamins.vitaminB2 ?? 0,
                    vitamin_b6: vitamins.vitamin_b6 ?? vitamins.vitaminB6 ?? 0,
                    vitamin_b12: vitamins.vitamin_b12 ?? vitamins.vitaminB12 ?? 0,
                    vitamin_c: vitamins.vitamin_c ?? vitamins.vitaminC ?? 0,
                    vitamin_e: vitamins.vitamin_e ?? vitamins.vitaminE ?? 0,
                    vitamin_k: vitamins.vitamin_k ?? vitamins.vitaminK ?? 0,
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
     * @param legacyAnalysisResponse 旧形式の食事解析レスポンス
     * @returns 標準API形式の食事解析レスポンス
     */
    static convertMealAnalysisResponse(legacyAnalysisResponse: any): StandardApiResponse<any> {
        const startTime = performance.now();

        // エラーチェック
        if (legacyAnalysisResponse.error) {
            return {
                success: false,
                error: {
                    code: legacyAnalysisResponse.errorCode || ErrorCode.AI.ANALYSIS_ERROR,
                    message: legacyAnalysisResponse.error,
                    details: legacyAnalysisResponse.details
                },
                meta: {
                    processingTimeMs: Math.round(performance.now() - startTime)
                }
            };
        }

        // 警告メッセージの抽出
        let warning = undefined;
        // 既存の警告チェックに加え、nutritionResultやnutritionが存在しない場合も考慮
        const nutritionResultData = legacyAnalysisResponse.nutritionResult;
        const nutritionData = nutritionResultData?.nutrition || legacyAnalysisResponse.nutrition;
        const confidence = nutritionResultData?.reliability?.confidence ?? legacyAnalysisResponse.confidence;

        if (legacyAnalysisResponse.warning || (confidence != null && confidence < 0.7)) {
            warning = legacyAnalysisResponse.warning ||
                '一部の食品の確信度が低いため、栄養計算の結果が不正確な可能性があります。';
        }

        // 処理時間の抽出 (より堅牢に)
        const processingTimeMs = Math.round(
            legacyAnalysisResponse.processingTimeMs ??
            legacyAnalysisResponse.duration ??
            legacyAnalysisResponse.processingTime ??
            (performance.now() - startTime) // フォールバック
        );

        // 栄養データをStandardizedMealNutrition形式に変換
        let standardizedNutrition: StandardizedMealNutrition | null = null;
        let legacyNutritionDataForResponse: NutritionData | null = null;

        if (nutritionData) {
            // まず、どんな形式でも NutritionData (旧標準) に変換しようと試みる
            const intermediateLegacyNutrition = ApiAdapter.convertToStandardNutrition(nutritionData);
            // 次に、NutritionData から StandardizedMealNutrition (新標準) へ変換
            standardizedNutrition = ApiAdapter.convertToStandardizedNutritionFormat(intermediateLegacyNutrition);
            // レスポンス用の legacyNutrition として、元データに近い形（変換前のオブジェクトか、なければ変換後の中間データ）を保持
            legacyNutritionDataForResponse = nutritionData; // 元の形式を保持するのが望ましい場合がある
            // もし元のnutritionDataが標準形式に近ければそちらを使う、なければ中間生成したものを保持
            if (typeof legacyNutritionDataForResponse !== 'object' || legacyNutritionDataForResponse === null) {
                legacyNutritionDataForResponse = intermediateLegacyNutrition;
            }

        }

        // 食品リストの取得 (より堅牢に)
        const foods = legacyAnalysisResponse.foods ?? legacyAnalysisResponse.recognizedFoods ?? [];

        // 標準形式への変換
        return {
            success: true,
            data: {
                // foodsが常に配列であることを保証
                foods: Array.isArray(foods) ? foods : [],
                nutritionResult: {
                    nutrition: standardizedNutrition, // 標準化形式
                    // legacyNutritionは、変換前の入力データか、それがなければ変換後の中間形式を入れる
                    legacyNutrition: legacyNutritionDataForResponse,
                    reliability: nutritionResultData?.reliability || {
                        confidence: confidence ?? 0.8, // confidenceの取得元を修正
                        balanceScore: nutritionResultData?.balanceScore ?? legacyAnalysisResponse.balanceScore ?? 50,
                        completeness: nutritionResultData?.completeness ?? legacyAnalysisResponse.completeness ?? 0.7
                    },
                },
                // processingTimeMs が常に存在するように
                processingTimeMs: processingTimeMs,
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
                    code: legacyFoodParseResponse.errorCode || ErrorCode.Nutrition.FOOD_REPOSITORY_ERROR,
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
        code: string = ErrorCode.Base.UNKNOWN_ERROR,
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