'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import HomeClient from '@/components/home/home-client'
import type { User, SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getJapanDate } from '@/lib/date-utils'
import { UserProfile } from '@/types/user'
import { NutritionTarget, NutritionProgress } from '@/types/nutrition'
import { DEFAULT_NUTRITION_TARGETS } from '@/lib/nutrition/nutrition-display-utils'
import { profileFetcher, targetsFetcher, progressFetcher } from '@/lib/fetchers/home-fetchers'

// Define the expected return type for fetchData matching HomeClientProps adjustment
interface FetchDataResult {
    profile: UserProfile | null;
    targets: typeof DEFAULT_NUTRITION_TARGETS | null;
    progress: NutritionProgress | null;
}

// Fetch data on the server using the passed Supabase client
async function fetchData(supabase: SupabaseClient, user: User): Promise<FetchDataResult> {
    const userId = user.id;
    const currentDate = getJapanDate(); // Get current date in JST

    try {
        // Fetch profile first, as targets might depend on due_date from profile
        const profile = await profileFetcher(userId);

        // Fetch targets and progress in parallel after getting profile
        const [targets, progress] = await Promise.all([
            targetsFetcher(profile?.due_date), // Pass due_date from profile
            progressFetcher(userId, currentDate) // Pass current date
        ]);

        console.log("[fetchData] Server fetched data:", { profile, targets, progress });

        return {
            profile,
            targets,
            progress
        };
    } catch (error) {
        console.error("Error fetching home page data:", error);
        // Return nulls or default values in case of error
        return {
            profile: null,
            targets: null, // Ensure null is assignable to typeof DEFAULT_NUTRITION_TARGETS | null
            progress: null
        };
    }
}

export default async function HomePage() {
    const cookieStore = await cookies(); // await を追加して Promise を解決
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    // Use the resolved cookieStore synchronously
                    return cookieStore.get(name)?.value
                },
                // Server Components don't need set/remove for createServerClient
            },
        }
    )
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch initial data on the server using the created server client
    const initialData = await fetchData(supabase, user);

    // Pass user and initialData to the client component
    return <HomeClient user={user} initialData={initialData} />
} 