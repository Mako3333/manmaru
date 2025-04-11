import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { AppError, ErrorCode } from '@/lib/error'

export interface Profile {
    id: string;
    user_id: string;
    name?: string;
    age: number | null;
    pregnancy_week: number | null;
    height: number | null;
    weight: number | null;
    adult_family_members: number | null;
    child_family_members: number | null;
    created_at: string;
    updated_at: string;
    full_name?: string;
    due_date?: string;
    dietary_restrictions?: string[];
}

export async function getProfile(): Promise<Profile | null> {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.error('プロフィール取得エラー: ユーザーが認証されていません')
        return null;
    }

    try {
        console.log('プロフィール取得開始: userId =', user.id)

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('プロフィールが存在しません: userId =', user.id)
                return null
            }
            console.error('プロフィール取得エラー:', error)
            throw error
        }

        console.log('プロフィール取得成功: userId =', user.id)
        return data as Profile
    } catch (error) {
        console.error('予期せぬプロフィール取得エラー:', error)
        return null
    }
}

export async function createProfile(userId: string, profileData: Partial<Profile>) {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
        console.log('プロフィール作成開始: userId =', userId)

        if (!userId) {
            console.error('プロフィール作成エラー: userIdが空です')
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'ユーザーIDが空です',
                userMessage: 'ユーザーIDが取得できませんでした。再度お試しください。'
            });
        }

        const { data, error } = await supabase
            .from('profiles')
            .insert([
                {
                    user_id: userId,
                    ...profileData,
                },
            ])
            .select()
            .single()

        if (error) {
            console.error('プロフィール作成エラー:', error)
            throw error
        }

        console.log('プロフィール作成成功: userId =', userId)
        return data as Profile
    } catch (error) {
        console.error('プロフィール作成例外:', error)
        throw error
    }
}

export async function getUserProfile(user: User): Promise<Profile | null> {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // データが見つからない場合は null を返す
            console.log('プロフィールが存在しません: userId =', user.id)
            return null
        }
        console.error('プロフィール取得エラー:', error)
        throw error
    }

    console.log('プロフィール取得成功: userId =', user.id)
    return data as Profile
}