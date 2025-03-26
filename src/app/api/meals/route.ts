import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { convertToLegacyNutrition, validateMealData } from '@/lib/nutrition/nutrition-utils';
import { ApiError } from '@/lib/errors/app-errors';

export async function POST(req: Request) {
    try {
        // リクエストボディの解析
        const body = await req.json();
        const { meal_type, meal_date, photo_url, food_description, nutrition_data, nutrition, servings } = body;

        // バリデーション
        if (!meal_type || !meal_date) {
            return NextResponse.json(
                { error: '食事タイプと日付は必須です' },
                { status: 400 }
            );
        }

        // サーバーサイドSupabaseクライアントの初期化
        const cookieStore = cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });

        // 現在のユーザーセッションを取得
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json(
                { error: '認証されていません' },
                { status: 401 }
            );
        }

        // 栄養データのログを記録（デバッグ用）
        console.log('栄養データ受信:', {
            nutrition_data: { ...nutrition_data, dailyRecords: nutrition_data?.daily_records ? '...省略' : undefined },
            nutrition: nutrition
        });

        // トランザクション的に処理するため、まずmealsテーブルに保存
        const { data: mealData, error: mealError } = await supabase
            .from('meals')
            .insert({
                user_id: session.user.id,
                meal_type,
                meal_date,
                photo_url,
                food_description,
                nutrition_data,
                servings: servings || 1
            })
            .select('id')
            .single();

        if (mealError) {
            console.error('Supabase meals保存エラー:', mealError);
            return NextResponse.json(
                { error: '食事の保存に失敗しました', details: mealError.message },
                { status: 500 }
            );
        }

        // 次にmeal_nutrientsテーブルに栄養データを保存
        if (nutrition && mealData) {
            const { error: nutrientError } = await supabase
                .from('meal_nutrients')
                .insert({
                    meal_id: mealData.id,
                    calories: nutrition.calories,
                    protein: nutrition.protein,
                    iron: nutrition.iron,
                    folic_acid: nutrition.folic_acid,
                    calcium: nutrition.calcium,
                    vitamin_d: nutrition.vitamin_d || 0,
                    confidence_score: nutrition.confidence_score || 0.8
                });

            if (nutrientError) {
                console.error('Supabase meal_nutrients保存エラー:', nutrientError);
                // meal_nutrientsの保存に失敗しても、mealsの保存は成功しているので、警告だけ出す
                console.warn('栄養データの保存に失敗しましたが、食事データは保存されました');
            }
        }

        return NextResponse.json({
            success: true,
            message: '食事が保存されました',
            data: { id: mealData.id }
        });
    } catch (error) {
        console.error('食事保存APIエラー:', error);

        if (error instanceof ApiError) {
            return NextResponse.json(
                { error: error.userMessage, details: error.details },
                { status: error.statusCode }
            );
        }

        return NextResponse.json(
            { error: '食事保存中にエラーが発生しました', details: (error as Error).message },
            { status: 500 }
        );
    }
} 