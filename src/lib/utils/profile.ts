import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

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

export async function getProfile(userId: string): Promise<Profile | null> {
    const supabase = createClientComponentClient()

    try {
        console.log('プロフィール取得開始: userId =', userId)

        if (!userId) {
            console.error('プロフィール取得エラー: userIdが空です')
            return null
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // データが見つからない場合は null を返す
                console.log('プロフィールが存在しません: userId =', userId)
                return null
            }
            console.error('プロフィール取得エラー:', error)
            throw error
        }

        console.log('プロフィール取得成功: userId =', userId)
        return data as Profile
    } catch (error) {
        console.error('プロフィール取得例外:', error)
        return null
    }
}

export async function createProfile(userId: string, profileData: Partial<Profile>) {
    const supabase = createClientComponentClient()

    try {
        console.log('プロフィール作成開始: userId =', userId)

        if (!userId) {
            console.error('プロフィール作成エラー: userIdが空です')
            throw new Error('ユーザーIDが必要です')
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