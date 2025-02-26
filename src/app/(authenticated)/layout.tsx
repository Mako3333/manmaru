'use client'

import { useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { BottomNavigation } from '@/components/layout/bottom-navigation'

export default function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClientComponentClient()
    const router = useRouter()

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/auth/login')
            }
        }

        checkSession()
    }, [router])

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <main className="flex-grow pb-16">
                {children}
            </main>
            <BottomNavigation />
        </div>
    )
} 