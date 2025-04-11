import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';
import { MealService } from '@/lib/services/meal-service';
import { withErrorHandling } from '@/lib/api/middleware';

/**
 * 食事データを削除するAPI
 * DELETE /api/meals/[id]
 */
export const DELETE = withErrorHandling(async (
    req: NextRequest,
    context: { params: Record<string, string> }
) => {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.delete({ name, ...options });
                },
            },
        }
    );

    // セッション確認
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        throw new AppError({
            code: ErrorCode.Base.AUTH_ERROR,
            message: 'ログインしていないか、セッションが無効です。',
            userMessage: '認証情報が無効です。再度ログインしてください。'
        });
    }

    const userId = session.user.id;
    const mealId = context.params.id as string;

    if (!mealId) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: '食事IDが指定されていません。'
        });
    }

    // MealServiceを使用して食事データを削除
    await MealService.deleteMeal(supabase, mealId, userId);

    // 成功レスポンス
    return NextResponse.json(
        {
            message: '食事データが正常に削除されました',
            data: { id: mealId }
        },
        { status: 200 } // 削除成功時は 200 OK または 204 No Content が一般的
    );
}); 