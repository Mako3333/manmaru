//src\app\api\calculate-nutrition\route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';

// 食品項目のスキーマ定義 (nutritionUtils.ts から移動)
export const FoodItemSchema = z.object({
    name: z.string(),
    quantity: z.string(),
    confidence: z.number().optional()
});

import { NutritionDatabase } from "@/lib/nutrition/database";
import { AIService } from '@/lib/ai/ai-service';

// リクエストの型定義
const RequestSchema = z.object({
    foods: z.array(FoodItemSchema)
});

// テンポラリキャッシュストレージ
const responseCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_VALIDITY_MS = 300000; // 5分間有効
const MAX_CACHE_SIZE = 100; // 最大キャッシュエントリ数

/**
 * 栄養素計算APIエンドポイント
 */
export async function POST(req: Request) {
    console.log('API: 栄養計算リクエスト受信');

    const body = await req.json().catch(error => {
        console.error('API: リクエストJSONパースエラー:', error);
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: 'Failed to parse request JSON.',
            userMessage: 'リクエストデータの形式が不正です。',
            originalError: error
        });
    });

    const validationResult = RequestSchema.safeParse(body);
    if (!validationResult.success) {
        console.error('API: リクエストボディバリデーションエラー:', validationResult.error.errors);
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: 'Request body validation failed.',
            userMessage: 'リクエストデータの形式が正しくありません。',
            details: validationResult.error.flatten()
        });
    }

    const foods = validationResult.data.foods;

    if (foods.length === 0) {
        console.error('API: 空の食品データ');
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: 'Foods array is empty.',
            userMessage: '食品データが必要です。',
            details: 'The provided foods array was empty.'
        });
    }

    const validFoods = foods.filter(food => food.name && food.name.trim() !== '');

    if (validFoods.length === 0) {
        console.error('API: 有効な食品名なし');
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: 'No valid food names provided.',
            userMessage: '有効な食品名が入力されていません。',
            details: 'The filtered foods array (excluding empty names) was empty.'
        });
    }

    const cacheKey = generateCacheKey(validFoods);

    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
        console.log("API: キャッシュから栄養計算結果を取得");
        return NextResponse.json({ success: true, ...cachedResult });
    }

    console.log('API: AIサービスで栄養計算を実行');
    const aiService = AIService.getInstance();
    let result;
    try {
        result = await aiService.analyzeTextInput(validFoods);
    } catch (aiError) {
        console.error('API: AIサービスエラー:', aiError);
        throw new AppError({
            code: ErrorCode.AI.ANALYSIS_FAILED,
            message: `AI service analysis failed: ${aiError instanceof Error ? aiError.message : aiError}`,
            userMessage: '栄養計算中にエラーが発生しました。しばらくしてからお試しください。',
            originalError: aiError instanceof Error ? aiError : undefined,
            severity: 'error'
        });
    }

    const hasValidNutrition =
        result.nutrition.calories > 100 ||
        result.nutrition.protein > 0 ||
        result.nutrition.iron > 0 ||
        result.nutrition.folic_acid > 0 ||
        result.nutrition.calcium > 0;

    if (!hasValidNutrition) {
        console.warn('API: 栄養計算の結果が不十分 - デフォルト値のみ使用されています');
        throw new AppError({
            code: ErrorCode.Nutrition.FOOD_NOT_FOUND,
            message: 'Nutrition calculation result seems insufficient (potentially default values).',
            userMessage: '栄養計算ができませんでした。入力された食品が見つからないか、情報が不足しています。',
            details: { calculatedNutrition: result.nutrition }
        });
    }

    const notFoundFoods = result.meta?.notFoundFoods || [];
    let metaInfo = { ...result.meta, calculationTime: new Date().toISOString() };
    if (notFoundFoods.length > 0) {
        console.warn(`API: 見つからなかった食品: ${notFoundFoods.join(', ')}`);
        metaInfo = {
            ...metaInfo,
            notFoundFoods,
            warning: '一部の食品が見つかりませんでした。結果は近似値です。'
        };
    }

    addToCache(cacheKey, result);

    console.log('API: 栄養計算成功');
    return NextResponse.json({
        success: true,
        ...result,
        meta: metaInfo
    });
}

/**
 * キャッシュキーを生成
 */
function generateCacheKey(foods: any[]): string {
    const sortedFoods = [...foods].sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    const key = sortedFoods.map(food =>
        `${food.name}:${food.quantity || 'default'}`
    ).join('|');

    return key;
}

/**
 * キャッシュから結果を取得
 */
function getFromCache(key: string): any | null {
    const cached = responseCache.get(key);

    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > CACHE_VALIDITY_MS) {
        responseCache.delete(key);
        return null;
    }

    return cached.data;
}

/**
 * キャッシュに結果を追加
 */
function addToCache(key: string, data: any): void {
    if (responseCache.size >= MAX_CACHE_SIZE) {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [k, v] of responseCache.entries()) {
            if (v.timestamp < oldestTime) {
                oldestTime = v.timestamp;
                oldestKey = k;
            }
        }

        if (oldestKey) {
            responseCache.delete(oldestKey);
        }
    }

    responseCache.set(key, {
        data,
        timestamp: Date.now()
    });
}