//src\app\api\calculate-nutrition\route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { FoodItemSchema } from "@/lib/nutrition/nutritionUtils";
import { NutritionDatabase } from "@/lib/nutrition/database";
import { AIService } from '@/lib/ai/ai-service';
import { FoodAnalysisError, ErrorCode } from '@/lib/errors/food-analysis-error';

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

    try {
        const body = await req.json().catch(error => {
            console.error('API: リクエストJSONパースエラー:', error);
            throw new FoodAnalysisError(
                'リクエストデータの形式が不正です',
                ErrorCode.PARSE_ERROR,
                error
            );
        });

        const foods = body.foods;

        // バリデーション
        if (!Array.isArray(foods)) {
            console.error('API: 無効な食品データ形式:', foods);
            return NextResponse.json(
                {
                    success: false,
                    error: "食品データは配列形式で指定してください"
                },
                { status: 400 }
            );
        }

        if (foods.length === 0) {
            console.error('API: 空の食品データ');
            return NextResponse.json(
                {
                    success: false,
                    error: "食品データが必要です"
                },
                { status: 400 }
            );
        }

        // 空の食品名をフィルタリング
        const validFoods = foods.filter(food => food.name && food.name.trim() !== '');

        if (validFoods.length === 0) {
            console.error('API: 有効な食品名なし');
            return NextResponse.json(
                {
                    success: false,
                    error: "有効な食品名が入力されていません"
                },
                { status: 400 }
            );
        }

        // キャッシュキー生成
        const cacheKey = generateCacheKey(validFoods);

        // キャッシュチェック
        const cachedResult = getFromCache(cacheKey);
        if (cachedResult) {
            console.log("API: キャッシュから栄養計算結果を取得");
            return NextResponse.json({ success: true, ...cachedResult });
        }

        // AIサービスを使用して栄養を計算
        console.log('API: AIサービスで栄養計算を実行');
        const aiService = AIService.getInstance();
        const result = await aiService.analyzeTextInput(validFoods);

        // 栄養値が正しく計算されたか確認
        const hasValidNutrition =
            result.nutrition.calories > 100 ||
            result.nutrition.protein > 0 ||
            result.nutrition.iron > 0 ||
            result.nutrition.folic_acid > 0 ||
            result.nutrition.calcium > 0;

        // 栄養値が無効な場合はエラーを返す
        if (!hasValidNutrition) {
            console.warn('API: 栄養計算の結果が不十分 - デフォルト値のみ使用されています');
            return NextResponse.json(
                {
                    success: false,
                    error: '栄養計算ができませんでした。入力された食品が見つかりません。',
                    errorCode: 'FOOD_NOT_FOUND',
                    data: null
                },
                { status: 400 }
            );
        }

        // 見つからなかった食品の情報を追加
        const notFoundFoods = result.meta?.notFoundFoods || [];
        if (notFoundFoods.length > 0) {
            console.warn(`API: 見つからなかった食品: ${notFoundFoods.join(', ')}`);
            result.meta = {
                ...result.meta,
                notFoundFoods,
                warning: '一部の食品が見つかりませんでした。結果は近似値です。'
            };
        }

        // 拡張栄養素データがある場合は、レスポンスに含める
        if (result.nutrition && 'extended_nutrients' in result.nutrition) {
            console.log('API: 拡張栄養素データを含めて返信');
        }

        // キャッシュに結果を保存
        addToCache(cacheKey, result);

        console.log('API: 栄養計算成功');
        return NextResponse.json({
            success: true,
            ...result,
            meta: {
                ...result.meta,
                calculationTime: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("API: 栄養計算エラー:", error);

        // エラーの種類に応じたレスポンス
        if (error instanceof FoodAnalysisError) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.getUserFriendlyMessage(),
                    code: error.code
                },
                { status: error.code === ErrorCode.VALIDATION_ERROR ? 400 : 500 }
            );
        } else {
            return NextResponse.json(
                {
                    success: false,
                    error: "栄養計算に失敗しました。しばらく経ってからお試しください。"
                },
                { status: 500 }
            );
        }
    }
}

/**
 * キャッシュキーを生成
 */
function generateCacheKey(foods: any[]): string {
    // 食品名と量に基づくキャッシュキーを生成
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

    // キャッシュ有効期限チェック
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
    // キャッシュサイズ制限チェック
    if (responseCache.size >= MAX_CACHE_SIZE) {
        // 最も古いエントリを削除
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

    // キャッシュに追加
    responseCache.set(key, {
        data,
        timestamp: Date.now()
    });
}