import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export const useAuth = () => {
    const router = useRouter()

    const signIn = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw error
            router.push('/dashboard')
        } catch (error) {
            console.error('Error signing in:', error)
            throw error
        }
    }

    const signUp = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            })
            if (error) throw error
            router.push('/auth/login?registered=true')
        } catch (error) {
            console.error('Error signing up:', error)
            throw error
        }
    }

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            router.push('/auth/login')
        } catch (error) {
            console.error('Error signing out:', error)
            throw error
        }
    }

    return {
        signIn,
        signUp,
        signOut,
    }
}