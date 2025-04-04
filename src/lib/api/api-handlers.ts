import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { AppError, ErrorCode } from '@/lib/error';
import { validateRequestParams } from '@/lib/validation/response-validators';
import { z, ZodSchema } from 'zod';

/**
 * APIエンドポイントハンドラの型定義
 */
type ApiHandler = (
    req: NextRequest,
    context: { params: Record<string, string>; user: any }
) => Promise<NextResponse>;

/**
 * セッション認証とエラーハンドリングを備えたAPIハンドララッパー
 */
export function withAuthAndErrorHandling(handler: ApiHandler) {
    return async (req: NextRequest, { params }: { params: Record<string, string> }) => {
        try {
            // ユーザー認証確認
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

            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                return NextResponse.json(
                    { error: '認証が必要です', code: ErrorCode.Base.AUTH_ERROR },
                    { status: 401 }
                );
            }

            // ハンドラ実行
            return await handler(req, { params, user });

        } catch (error) {
            console.error('API error:', error);

            // AppErrorの場合
            if (error instanceof AppError) {
                return NextResponse.json(
                    {
                        error: error.userMessage,
                        code: error.code,
                        details: process.env.NODE_ENV === 'development' ? error.details : undefined
                    },
                    { status: getStatusCodeFromAppError(error) }
                );
            }

            // その他のエラー
            return NextResponse.json(
                {
                    error: 'サーバーエラーが発生しました',
                    code: ErrorCode.Base.UNKNOWN_ERROR,
                    details: process.env.NODE_ENV === 'development'
                        ? error instanceof Error ? error.message : String(error)
                        : undefined
                },
                { status: 500 }
            );
        }
    };
}

/**
 * リクエストデータを検証するヘルパー関数
 */
export async function validateRequestData<T>(
    request: NextRequest,
    requiredFields: string[] = []
): Promise<T> {
    try {
        const data = await request.json();
        const validation = validateRequestParams<T>(data, requiredFields);

        if (!validation.isValid) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: `リクエストデータ検証エラー: ${validation.errorMessage}`,
                userMessage: validation.errorMessage || '無効なデータが含まれています',
                details: { validationError: validation.errorMessage }
            });
        }

        return validation.data as T;
    } catch (error) {
        if (error instanceof AppError) throw error;

        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: `リクエストデータ検証エラー: ${error instanceof Error ? error.message : String(error)}`,
            userMessage: '無効なリクエストデータです',
            details: { originalError: error }
        });
    }
}

/**
 * エラーコードからHTTPステータスコードを取得
 */
function getStatusCodeFromAppError(error: AppError): number {
    // codeはエラーコードの文字列値
    const errorCode = error.code;

    // auth系エラー
    if (errorCode === ErrorCode.Base.AUTH_ERROR) {
        return 401;
    }

    // データバリデーションエラー
    if (errorCode === ErrorCode.Base.DATA_VALIDATION_ERROR) {
        return 400;
    }

    // データ不存在エラー
    if (errorCode === ErrorCode.Base.DATA_NOT_FOUND) {
        return 404;
    }

    // レート制限エラー
    if (errorCode === 'rate_limit_exceeded' || errorCode === 'quota_exceeded') {
        return 429;
    }

    // その他のエラー
    return 500;
}

/**
 * レスポンスデータの作成
 */
export function createSuccessResponse<T>(data: T, message?: string) {
    return {
        success: true,
        data,
        ...(message ? { message } : {})
    };
}

/**
 * 認証とリクエスト検証を行うAPIハンドラを作成する高階関数
 */
export function createApiHandler<TParams extends ZodSchema, TResult>(
    schema: TParams,
    handler: (params: z.infer<TParams>, userId: string) => Promise<TResult>,
    authRequired: boolean = true
) {
    return async (request: Request): Promise<Response> => {
        let userId: string | null = null;
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

        if (authRequired) {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                const error = new AppError({
                    code: ErrorCode.Base.AUTH_ERROR,
                    message: '認証が必要です',
                    userMessage: 'ログインしてください。'
                });
                return new Response(JSON.stringify({ success: false, error: error.toJSON() }), { status: 401 });
            }
            userId = user.id;
        }

        try {
            // スキーマを使用してリクエストデータを検証
            let params: z.infer<TParams>;

            try {
                const requestData = await request.json();
                params = schema.parse(requestData);
            } catch (error) {
                if (error instanceof z.ZodError) {
                    throw new AppError({
                        code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                        message: 'リクエストパラメータが無効です',
                        details: error.flatten()
                    });
                }
                throw error;
            }

            const result = await handler(params, userId!);
            return new Response(JSON.stringify({ success: true, data: result }), { status: 200 });
        } catch (error: unknown) {
            console.error('API Handler Error:', error);

            let appError: AppError;

            if (error instanceof AppError) {
                appError = error;
            } else if (error instanceof z.ZodError) {
                appError = new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: 'リクエストパラメータが無効です',
                    details: error.flatten()
                });
            } else {
                appError = new AppError({
                    code: ErrorCode.Base.UNKNOWN_ERROR,
                    message: 'サーバー内部でエラーが発生しました',
                    originalError: error instanceof Error ? error : undefined
                });
            }

            const statusCode = getStatusCodeFromAppError(appError);
            return new Response(JSON.stringify({ success: false, error: appError.toJSON() }), { status: statusCode });
        }
    };
}

// 使用例
/*
const sampleSchema = z.object({ id: z.string() });
type SampleParams = z.infer<typeof sampleSchema>;

async function handleGetItem(params: SampleParams, userId: string): Promise<{ item: string }> {
    // ... 実際の処理
    return { item: `Item ${params.id} for user ${userId}` };
}

export const GET = createApiHandler(sampleSchema, handleGetItem);
*/ 