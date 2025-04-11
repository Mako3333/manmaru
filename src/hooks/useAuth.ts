import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useState, useEffect, useCallback } from 'react'
import { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { AppError, ErrorCode } from '@/lib/error'

interface Profile {
    id: string
    user_id: string
    name: string
    due_date: string
    created_at: string
}

interface AuthResponse {
    user: {
        id: string
    } | null
    error: Error | null
}

export const useAuth = () => {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [session, setSession] = useState<Session | null>(null)

    // セッション状態の初期化
    useEffect(() => {
        const initializeSession = async () => {
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession()
                setSession(currentSession)
            } catch (err) {
                console.error('セッション初期化エラー:', err)
            }
        }

        initializeSession()
    }, [])

    // handleAuthRedirect を useCallback でメモ化
    const handleAuthRedirect = useCallback(async () => {
        try {
            setIsLoading(true)
            // getSessionを呼び出す可能性があるため、sessionステートに依存
            const currentSession = session || (await supabase.auth.getSession()).data.session

            if (!currentSession?.user) {
                throw new AppError({
                    code: ErrorCode.Base.AUTH_ERROR,
                    message: 'User information not found in session.',
                    userMessage: '認証情報が見つかりません。再度ログインしてください。'
                });
            }

            const profile = await checkProfile(currentSession.user.id)

            if (profile) {
                router.push('/dashboard')
            } else {
                router.push('/profile')
            }
        } catch (err) {
            console.error('認証リダイレクトエラー:', err)
            setError(err instanceof Error ? err.message : 'ログイン後の処理中にエラーが発生しました')
        } finally {
            setIsLoading(false)
        }
        // session, router, setIsLoading, setError, checkProfile に依存
    }, [session, router]) // checkProfile はフック外の関数なので依存不要, setIsLoading, setError も通常不要だが念のため含めるかは検討

    // handleAuthStateChange を useCallback でメモ化
    const handleAuthStateChange = useCallback(async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event)
        setSession(session)

        try {
            switch (event) {
                case 'SIGNED_IN':
                    if (session) {
                        console.log('ログイン状態を維持')
                        await handleAuthRedirect() // メモ化された関数を使用
                    }
                    break
                case 'SIGNED_OUT':
                    console.log('ログアウトされました')
                    router.push('/auth/login')
                    break
                case 'TOKEN_REFRESHED':
                    console.log('セッションが自動更新されました')
                    break
                case 'USER_UPDATED':
                    console.log('ユーザー情報が更新されました')
                    break
                default:
                    break
            }
        } catch (err) {
            console.error('認証状態変更エラー:', err)
        }
        // handleAuthRedirect, router, setSession に依存
    }, [handleAuthRedirect, router]) // setSession は通常不要

    // 認証状態の監視を設定
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange) // メモ化された関数を使用

        return () => {
            subscription.unsubscribe()
        }
        // 依存配列を修正
    }, [handleAuthStateChange])

    const checkProfile = async (userId: string): Promise<Profile | null> => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    return null
                }
                console.error('プロフィール取得エラー:', error)
                return null
            }

            return data
        } catch (err) {
            if (err instanceof Error) {
                console.error('プロフィール確認エラー:', err.message)
            } else {
                console.error('予期せぬエラー:', err)
            }
            return null
        }
    }

    const signIn = async (email: string, password: string): Promise<AuthResponse> => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw error
            return { user: data.user, error: null }
        } catch (error) {
            console.error('Error signing in:', error)
            return { user: null, error: error as Error }
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
            setIsLoading(true)
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            router.push('/auth/login')
        } catch (error) {
            console.error('Error signing out:', error)
            setError('ログアウト中にエラーが発生しました')
        } finally {
            setIsLoading(false)
        }
    }

    const signInWithOtp = async (email: string) => {
        try {
            setIsLoading(true)
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                    data: {
                        redirectCallback: handleAuthRedirect
                    }
                }
            })
            if (error) throw error
            return { error: null }
        } catch (error) {
            console.error('Error signing in with OTP:', error)
            return { error }
        } finally {
            setIsLoading(false)
        }
    }

    return {
        isLoading,
        error,
        setError,
        session,
        signIn,
        signUp,
        signOut,
        signInWithOtp,
        handleAuthRedirect
    }
}