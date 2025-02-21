import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/supabase/types'

export type Profile = Database['public']['Tables']['profiles']['Row']

export async function getProfile(userId: string): Promise<Profile | null> {
    const supabase = createClientComponentClient<Database>()

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // データが見つからない場合は null を返す
                return null
            }
            throw error
        }

        return data
    } catch (error) {
        console.error('Profile fetch error:', error)
        return null
    }
}

export async function createProfile(userId: string, profileData: Partial<Profile>) {
    const supabase = createClientComponentClient<Database>()

    try {
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

        if (error) throw error
        return data
    } catch (error) {
        console.error('Profile creation error:', error)
        throw error
    }
}