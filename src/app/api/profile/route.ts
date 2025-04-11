import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/api/middleware'
import { AppError } from '@/lib/error/types/base-error'
import { ErrorCode } from '@/lib/error/codes/error-codes'

// 入力値バリデーションスキーマ (Zodを使用)
const profileUpdateSchema = z.object({
    age: z.number().min(15, '年齢は15歳以上で入力してください').max(60, '年齢は60歳以下で入力してください').optional(),
    height: z.number().min(130, '身長は130cm以上で入力してください').max(200, '身長は200cm以下で入力してください').optional(),
    weight: z.number().min(30, '体重は30kg以上で入力してください').max(150, '体重は150kg以下で入力してください').optional(),
    due_date: z.string().nullable().optional(), // YYYY-MM-DD形式 or null
    dietary_restrictions: z.array(z.string()).nullable().optional(),
    adult_family_members: z.number().min(1, '同居の大人は1人以上で入力してください').max(10).optional(),
    child_family_members: z.number().min(0).max(10).optional(),
}).strict(); // スキーマにないプロパティはエラーとする

async function handleProfileUpdate(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    // NextResponse を直接操作できないため、ミドルウェアや認証済みレイアウトでCookieを設定する前提
                    // ここでの set/remove はサーバーサイドでの状態更新のみ
                    // No-op for Route Handlers
                },
                remove(name: string, options: CookieOptions) {
                    // No-op for Route Handlers
                },
            },
        }
    )

    // 認証済みユーザー情報を取得
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        throw new AppError({
            code: ErrorCode.Base.AUTH_ERROR,
            message: '認証が必要です',
            userMessage: '認証されていません',
        });
    }

    // リクエストボディを取得
    const body = await req.json();

    // バリデーション
    const validationResult = profileUpdateSchema.safeParse(body);
    if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: `入力値エラー: ${firstError?.message || '不明なエラー'} (path: ${firstError?.path.join('.') || ''})`,
            userMessage: firstError?.message || '入力データに問題があります',
            details: { validationErrors: validationResult.error.flatten() }
        });
    }

    const updateData = validationResult.data;

    // 更新データがない場合は何もしない
    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ message: '更新するデータがありません' }, { status: 200 });
    }

    // DB更新
    const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .single(); // 更新されたレコードを返す

    if (updateError) {
        console.error('Supabase profile update error:', updateError);
        throw new AppError({
            code: ErrorCode.Base.API_ERROR,
            message: 'プロフィールの更新に失敗しました',
            userMessage: 'プロフィールの更新中にエラーが発生しました。',
            originalError: updateError
        });
    }

    if (!data) {
        throw new AppError({
            code: ErrorCode.Base.DATA_NOT_FOUND,
            message: '更新対象のプロフィールが見つかりません',
            userMessage: 'プロフィールが見つかりませんでした。',
        });
    }

    return NextResponse.json({ message: 'プロフィールが更新されました', profile: data }, { status: 200 });
}

// withErrorHandling ミドルウェアを適用してエクスポート
export const PATCH = withErrorHandling(handleProfileUpdate);
