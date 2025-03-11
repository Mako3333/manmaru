import { NextResponse } from "next/server";
import { z } from "zod";
import { FoodItemSchema } from "@/lib/nutrition/nutritionUtils";
import { NutritionDatabase } from "@/lib/nutrition/database";

// リクエストの型定義
const RequestSchema = z.object({
    foods: z.array(FoodItemSchema)
});

// レスポンスキャッシュのための一時的なストレージ（メモリ内）
// 注: 大規模アプリでは、Redisなどの外部キャッシュサービスを検討すべき
const responseCache = new Map<string, {
    timestamp: number,
    result: any
}>();

// キャッシュ有効期限（5分 = 300000ms）
const CACHE_VALIDITY_TIME = 300000;

/**
 * 栄養素計算APIエンドポイント
 */
export async function POST(req: Request) {
    try {
        // リクエストデータの検証
        const body = await req.json();
        const validatedData = RequestSchema.parse(body);
        const { foods } = validatedData;

        // 食品データのバリデーション
        if (!foods || foods.length === 0) {
            return Response.json({ error: '食品データが必要です' }, { status: 400 });
        }

        // キャッシュキーの生成（食品名と量の組み合わせからハッシュを作成）
        const cacheKey = generateCacheKey(foods);

        // キャッシュをチェック
        const cachedResult = getFromCache(cacheKey);
        if (cachedResult) {
            console.log('栄養計算API: キャッシュから結果を返します');
            return NextResponse.json({
                nutrition: cachedResult,
                cached: true
            });
        }

        // NutritionDatabaseのインスタンスを取得
        const nutritionDb = NutritionDatabase.getInstance();

        // データベースの初期化状態を確認
        const dbStatus = nutritionDb.getDatabaseStatus();
        if (!dbStatus.isReady) {
            console.log('栄養計算API: データベースを初期化します');
            await nutritionDb.loadExternalDatabase();
        }

        // 栄養計算を実行
        console.log('栄養計算API: 計算を実行します');
        const nutritionData = await nutritionDb.calculateNutrition(foods);

        // 結果をキャッシュに保存
        addToCache(cacheKey, nutritionData);

        // 結果を返す
        return NextResponse.json({
            nutrition: nutritionData
        });

    } catch (error) {
        console.error('栄養計算エラー:', error);

        // Zodエラーの場合（リクエストデータが不正）
        if (error instanceof z.ZodError) {
            return Response.json({
                error: 'リクエストデータが不正です',
                details: error.errors
            }, { status: 400 });
        }

        // その他のエラー
        return Response.json({
            error: '栄養計算中にエラーが発生しました',
            details: (error as Error).message
        }, { status: 500 });
    }
}

/**
 * 食品リストからキャッシュキーを生成
 */
function generateCacheKey(foods: any[]): string {
    // 食品名と量のみを含むシンプルな配列に変換してJSON文字列化
    const simplifiedFoods = foods.map(food => ({
        name: food.name,
        quantity: food.quantity || ''
    }));

    return JSON.stringify(simplifiedFoods);
}

/**
 * キャッシュから結果を取得
 */
function getFromCache(key: string): any | null {
    const cached = responseCache.get(key);

    if (cached) {
        const currentTime = Date.now();
        // キャッシュが有効期限内なら結果を返す
        if (currentTime - cached.timestamp < CACHE_VALIDITY_TIME) {
            return cached.result;
        } else {
            // 期限切れならキャッシュから削除
            responseCache.delete(key);
        }
    }

    return null;
}

/**
 * キャッシュに結果を保存
 */
function addToCache(key: string, data: any): void {
    // キャッシュサイズ制限（100エントリーまで）
    if (responseCache.size >= 100) {
        // 最も古いエントリーを削除
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

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
        timestamp: Date.now(),
        result: data
    });
}