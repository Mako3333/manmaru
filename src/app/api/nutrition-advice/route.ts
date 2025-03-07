import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AdviceType } from "@/types/nutrition";
import { z } from 'zod';
import { AIService } from '@/lib/ai/ai-service';
import { getCurrentSeason, getJapanDate } from '@/lib/utils/date-utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { calculatePregnancyWeek } from '@/lib/date-utils';
import { NextRequest } from 'next/server';

// リクエストスキーマ
const RequestSchema = z.object({
    pregnancyWeek: z.number().min(1).max(42).optional(),
    deficientNutrients: z.array(z.string()).optional(),
    mode: z.enum(['normal', 'force_update']).optional().default('normal'),
    advice_type: z.enum([
        AdviceType.DAILY,
        AdviceType.DEFICIENCY,
        AdviceType.MEAL_SPECIFIC,
        AdviceType.WEEKLY
    ]).optional().default(AdviceType.DAILY)
});

// Supabaseクライアント型定義
type SupabaseClient = any; // 実際の型が利用可能な場合は置き換えてください

// Supabaseクライアント作成関数
function createClient(): SupabaseClient {
    // サーバーサイドでのクライアント作成
    return createRouteHandlerClient({ cookies });
}

// 過去の栄養データを取得する関数（ここに追加）
async function getPastNutritionData(supabase: SupabaseClient, userId: string, days: number = 3) {
    const today = new Date();
    const pastDates = [];

    // 過去n日分の日付を生成
    for (let i = 1; i <= days; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        pastDates.push(format(date, 'yyyy-MM-dd'));
    }

    console.log('過去の栄養データを取得: 対象日付', pastDates);

    // 栄養データを取得
    const { data, error } = await supabase
        .from('nutrition_goal_prog')
        .select('*')
        .eq('user_id', userId)
        .in('meal_date', pastDates)
        .order('meal_date', { ascending: false });

    if (error) {
        console.error('過去の栄養データ取得エラー:', error);
        return [];
    }

    // データがない場合は空配列
    if (!data || data.length === 0) {
        console.log('過去の栄養データが見つかりません');
        return [];
    }

    console.log(`取得した過去の栄養データ: ${data.length}件`);

    // データを整形して返却
    return data.map((record: any) => ({
        date: record.meal_date,
        overallScore: calculateOverallScore(record),
        nutrients: {
            calories: { percentage: record.calories_percent || 0 },
            protein: { percentage: record.protein_percent || 0 },
            iron: { percentage: record.iron_percent || 0 },
            folic_acid: { percentage: record.folic_acid_percent || 0 },
            calcium: { percentage: record.calcium_percent || 0 },
            vitamin_d: { percentage: record.vitamin_d_percent || 0 }
        }
    }));
}
// 総合スコア計算関数
function calculateOverallScore(record: any): number {
    const percentages = [
        record.calories_percent || 0,
        record.protein_percent || 0,
        record.iron_percent || 0,
        record.folic_acid_percent || 0,
        record.calcium_percent || 0,
        record.vitamin_d_percent || 0
    ];

    return Math.round(percentages.reduce((sum, val) => sum + val, 0) / percentages.length);
}
// 栄養アドバイスAPIエンドポイント
export async function GET(request: NextRequest) {
    console.log('栄養アドバイスAPI: リクエスト受信');

    try {
        // リクエストパラメータの取得
        const searchParams = request.nextUrl.searchParams;
        const forceUpdate = searchParams.get('force') === 'true';
        const isDetailedRequest = searchParams.get('detail') === 'true';
        const requestDate = searchParams.get('date') || getJapanDate();
        const adviceType = (searchParams.get('advice_type') as AdviceType) || AdviceType.DAILY;

        console.log('栄養アドバイスAPI: 強制更新モード =', forceUpdate);
        console.log('栄養アドバイスAPI: リクエスト日付 =', requestDate);
        console.log('栄養アドバイスAPI: アドバイスタイプ =', adviceType);

        const supabase = createClient();

        // ユーザー認証確認
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.log('栄養アドバイスAPI: 認証エラー - セッションなし'); // デバッグ用ログ
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // 既存のアドバイスIDを保持する変数
        let existingAdviceId = null;

        // 強制更新モードでない場合は、既存のアドバイスを確認
        if (!forceUpdate) {
            // 指定された日付とタイプのアドバイスを取得
            const { data: existingAdvice, error: adviceError } = await supabase
                .from('daily_nutri_advice')
                .select('*')
                .eq('user_id', userId)
                .eq('advice_date', requestDate)
                .eq('advice_type', adviceType)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            // エラーがなく、既存のアドバイスがある場合
            if (!adviceError && existingAdvice) {
                console.log('栄養アドバイスAPI: 既存アドバイスを返します', {
                    id: existingAdvice.id,
                    type: existingAdvice.advice_type
                }); // デバッグ用ログ
                return NextResponse.json({
                    success: true,
                    ...existingAdvice
                });
            }
        } else {
            // 強制更新モードの場合、既存のアドバイスを確認
            const { data: existingAdvice, error: adviceError } = await supabase
                .from('daily_nutri_advice')
                .select('id')
                .eq('user_id', userId)
                .eq('advice_date', requestDate)
                .eq('advice_type', adviceType)
                .single();

            // 既存のアドバイスがある場合は、後で更新するためにIDを保存
            if (!adviceError && existingAdvice) {
                existingAdviceId = existingAdvice.id;
                console.log('栄養アドバイスAPI: 既存アドバイスを更新します', {
                    id: existingAdviceId,
                    type: adviceType
                }); // デバッグ用ログ
            }
        }

        // 妊婦プロフィール取得
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (profileError) {
            console.error('プロファイル取得エラー:', profileError);
            console.log('栄養アドバイスAPI: プロファイル取得エラー', profileError); // デバッグ用ログ
            return NextResponse.json(
                {
                    error: '妊婦プロフィールが見つかりません',
                    message: 'プロフィールを作成してください。プロフィールページに移動します。',
                    redirect: '/profile'
                },
                { status: 404 }
            );
        }

        // 妊娠週数計算
        const pregnancyWeek = calculatePregnancyWeek(profile.due_date);

        // トライメスター計算
        let trimester = 1;
        if (pregnancyWeek > 27) {
            trimester = 3;
        } else if (pregnancyWeek > 13) {
            trimester = 2;
        }

        // 不足栄養素の取得
        let deficientNutrients: string[] = [];
        try {
            // 栄養進捗データを取得
            const { data: nutritionProgress } = await supabase
                .from('nutrition_goal_prog')
                .select('*')
                .eq('user_id', userId)
                .eq('meal_date', requestDate)
                .single();

            console.log('栄養アドバイスAPI: 現在日の栄養データ存在確認', {
                date: requestDate,
                exists: !!nutritionProgress,
                data: nutritionProgress || '(データなし)'
            });

            if (nutritionProgress) {
                // 70%未満を不足と判定するロジックに修正
                const nutrientMapping = {
                    protein_percent: 'タンパク質',
                    iron_percent: '鉄分',
                    folic_acid_percent: '葉酸',
                    calcium_percent: 'カルシウム',
                    vitamin_d_percent: 'ビタミンD'
                };

                deficientNutrients = Object.entries(nutrientMapping)
                    .filter(([key]) =>
                        typeof nutritionProgress[key] === 'number' &&
                        nutritionProgress[key] < 70
                    )
                    .map(([_, japaneseName]) => japaneseName);

                console.log('栄養アドバイスAPI: 不足栄養素リスト (70%未満)', deficientNutrients);
            } else {
                // デフォルトの不足栄養素（データがない場合）
                deficientNutrients = ['タンパク質', '鉄分', '葉酸', 'カルシウム'];
            }
        } catch (error) {
            console.error('栄養データ取得エラー:', error);
            // エラー時はデフォルト値を使用
            deficientNutrients = ['タンパク質', '鉄分', '葉酸', 'カルシウム'];
        }

        // 現在の季節を取得
        const currentSeason = getCurrentSeason();

        // 日付を日本語フォーマットで
        const formattedDate = format(new Date(requestDate), 'yyyy年MM月dd日', { locale: ja });

        // AIサービスを使用して栄養アドバイスを生成
        console.log('栄養アドバイスAPI: AIサービスによるアドバイス生成開始', {
            pregnancyWeek,
            trimester,
            deficientNutrientsCount: deficientNutrients.length,
            date: requestDate,
            adviceType
        }); // デバッグ用ログ
        // 過去の栄養データを取得
        const pastNutritionData = await getPastNutritionData(supabase, userId);
        console.log('栄養アドバイスAPI: 過去の栄養データ取得完了', pastNutritionData.length);

        // 過去数日間の平均値から不足栄養素を計算 (既存の不足栄養素リストを上書き)
        if (pastNutritionData.length > 0) {
            // インデックスシグネチャ対応の型を定義
            interface NutrientAverages {
                protein: number;
                iron: number;
                folic_acid: number;
                calcium: number;
                vitamin_d: number;
                [key: string]: number; // インデックスシグネチャ追加
            }

            // 栄養素ごとの平均値を計算
            const avgNutrients: NutrientAverages = {
                protein: 0,
                iron: 0,
                folic_acid: 0,
                calcium: 0,
                vitamin_d: 0
            };

            // 型指定を追加
            interface NutritionDay {
                date: string;
                overallScore: number;
                nutrients: {
                    protein: { percentage: number };
                    iron: { percentage: number };
                    folic_acid: { percentage: number };
                    calcium: { percentage: number };
                    vitamin_d: { percentage: number };
                    calories: { percentage: number };
                };
            }

            pastNutritionData.forEach((day: NutritionDay) => {
                avgNutrients.protein += day.nutrients.protein.percentage;
                avgNutrients.iron += day.nutrients.iron.percentage;
                avgNutrients.folic_acid += day.nutrients.folic_acid.percentage;
                avgNutrients.calcium += day.nutrients.calcium.percentage;
                avgNutrients.vitamin_d += day.nutrients.vitamin_d.percentage;
            });

            // 平均値を算出 (型安全なアクセス)
            const keys = Object.keys(avgNutrients) as Array<keyof NutrientAverages>;
            keys.forEach(key => {
                avgNutrients[key] = avgNutrients[key] / pastNutritionData.length;
            });

            // 70%未満の栄養素を抽出
            const nutrientMapping: Record<keyof Omit<NutrientAverages, 'calories'>, string> = {
                protein: 'タンパク質',
                iron: '鉄分',
                folic_acid: '葉酸',
                calcium: 'カルシウム',
                vitamin_d: 'ビタミンD'
            };

            // 既存の不足栄養素リストを上書き
            deficientNutrients = Object.entries(nutrientMapping)
                .filter(([key]) => avgNutrients[key as keyof NutrientAverages] < 70)
                .map(([_, name]) => name);

            console.log('栄養アドバイスAPI: 過去数日間の平均から算出した不足栄養素', deficientNutrients);
        }

        // AIサービス呼び出しの前に変数の再宣言を避けるため、既存の変数を使用
        console.log('栄養アドバイスAPI: 不足栄養素リスト', deficientNutrients);
        console.log('栄養アドバイスAPI: 条件評価', {
            hasDeficientNutrients: deficientNutrients && deficientNutrients.length > 0,
            count: deficientNutrients?.length || 0
        });


        // AIサービス呼び出し
        const aiService = AIService.getInstance();
        const adviceResult = await aiService.getNutritionAdvice({
            pregnancyWeek,
            trimester: calculateTrimester(pregnancyWeek),
            currentSeason: getCurrentSeason(),
            formattedDate: format(new Date(requestDate), 'yyyy年MM月dd日', { locale: ja }),
            deficientNutrients: deficientNutrients || [],
            pastNutritionData: pastNutritionData
        });

        // アドバイスをフォーマット
        const adviceData = {
            user_id: userId,
            advice_date: requestDate,
            advice_type: adviceType,
            advice_summary: adviceResult.summary || '栄養アドバイスが生成されました',
            advice_detail: adviceResult.detailedAdvice || adviceResult.summary || '詳細な栄養アドバイスが生成されました',
            recommended_foods: adviceResult.recommendedFoods?.map(food => food.name) || ['バランスの良い食事を心がけましょう'],
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        console.log('栄養アドバイスAPI: AIサービスからのレスポンス受信', {
            summaryLength: adviceData.advice_summary.length,
            detailLength: adviceData.advice_detail.length,
            foodsCount: adviceData.recommended_foods.length
        }); // デバッグ用ログ

        // アドバイスをデータベースに保存または更新
        let savedAdvice;

        if (existingAdviceId) {
            // 既存のアドバイスを更新
            console.log('栄養アドバイスAPI: 既存アドバイスを更新します', existingAdviceId); // デバッグ用ログ
            const { data: updatedAdvice, error: updateError } = await supabase
                .from('daily_nutri_advice')
                .update({
                    advice_summary: adviceData.advice_summary,
                    advice_detail: adviceData.advice_detail,
                    recommended_foods: adviceData.recommended_foods,
                    is_read: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingAdviceId)
                .select()
                .single();

            if (updateError) {
                console.error('アドバイス更新エラー:', updateError);
                console.log('栄養アドバイスAPI: データベース更新エラー', updateError); // デバッグ用ログ
                throw new Error('アドバイスの更新に失敗しました');
            }

            savedAdvice = updatedAdvice;
        } else {
            // 新規アドバイスを作成
            console.log('栄養アドバイスAPI: 新規アドバイスを作成します'); // デバッグ用ログ
            const { data: newAdvice, error: saveError } = await supabase
                .from('daily_nutri_advice')
                .insert(adviceData)
                .select()
                .single();

            if (saveError) {
                console.error('アドバイス保存エラー:', saveError);
                console.log('栄養アドバイスAPI: データベース保存エラー', saveError); // デバッグ用ログ
                throw new Error('アドバイスの保存に失敗しました');
            }

            savedAdvice = newAdvice;
        }

        return NextResponse.json({
            success: true,
            ...savedAdvice
        });
    } catch (error) {
        console.error("アドバイス生成エラー:", error);
        console.log('栄養アドバイスAPI: 予期せぬエラー', error); // デバッグ用ログ
        return NextResponse.json(
            { success: false, error: "アドバイスの生成に失敗しました" },
            { status: 500 }
        );
    }
}

// 妊娠週数から妊娠期（トリメスター）を計算
function calculateTrimester(pregnancyWeek: number): number {
    if (pregnancyWeek <= 13) return 1;
    if (pregnancyWeek <= 27) return 2;
    return 3;
}

// read状態を更新するPATCHエンドポイント
export async function PATCH(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies });

        // ユーザー認証確認
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: '認証が必要です' },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'アドバイスIDが必要です' },
                { status: 400 }
            );
        }

        // アドバイスの既読状態を更新
        const { error } = await supabase
            .from('daily_nutri_advice')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) {
            console.error('アドバイス更新エラー:', error);
            return NextResponse.json(
                { success: false, error: 'アドバイスの更新に失敗しました' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('栄養アドバイス更新API エラー:', error);
        return NextResponse.json(
            { success: false, error: '栄養アドバイスの更新に失敗しました' },
            { status: 500 }
        );
    }
} 