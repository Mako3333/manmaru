import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, ErrorCode } from '@/lib/errors/app-errors';
import { MealService } from '@/lib/services/meal-service';

/**
 * 食事データを削除するAPI
 * DELETE /api/meals/[id]
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    try {
        // セッション確認
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            return NextResponse.json(
                {
                    error: 'ログインしていないか、セッションが無効です。',
                    code: ErrorCode.AUTH_REQUIRED
                },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const mealId = params.id;

        if (!mealId) {
            return NextResponse.json(
                {
                    error: '食事IDが指定されていません。',
                    code: ErrorCode.DATA_VALIDATION_ERROR
                },
                { status: 400 }
            );
        }

        // MealServiceを使用して食事データを削除
        await MealService.deleteMeal(supabase, mealId, userId);

        return NextResponse.json(
            {
                message: '食事データが正常に削除されました',
                data: { id: mealId }
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('食事削除エラー:', error);

        // ApiErrorの場合はそのメッセージとコードを使用
        if (error instanceof ApiError) {
            return NextResponse.json(
                {
                    error: error.userMessage || '食事データの削除中にエラーが発生しました。',
                    code: error.code,
                    details: error.details
                },
                { status: error.statusCode || 500 }
            );
        }

        // その他のエラー
        return NextResponse.json(
            {
                error: '食事データの削除中に予期しないエラーが発生しました。',
                code: ErrorCode.UNKNOWN_ERROR
            },
            { status: 500 }
        );
    }
} 