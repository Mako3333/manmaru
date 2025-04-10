import { createBrowserClient } from '@supabase/ssr';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile } from '@/types/user';
import { NutritionTarget, NutritionProgress } from '@/types/nutrition';
import { DEFAULT_NUTRITION_TARGETS } from '@/lib/nutrition/nutrition-display-utils';
import { calculatePregnancyWeek, getTrimesterNumber, getJapanDate } from '@/lib/date-utils';

// Supabase クライアントをここで初期化するか、外部から渡す
const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// プロファイル取得 Fetcher
export const profileFetcher = async (userId: string): Promise<UserProfile | null> => {
    console.log('[Fetcher] profileFetcher called for user:', userId);
    if (!userId) {
        console.log('[Fetcher] profileFetcher: No userId, returning null.');
        return null;
    }
    try {
        console.log('[Fetcher] profileFetcher: Attempting Supabase query...');
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle<UserProfile>();

        console.log('[Fetcher] profileFetcher: Supabase response - data:', data);
        console.log('[Fetcher] profileFetcher: Supabase response - error:', error);

        if (error) {
            console.error('[Fetcher] profileFetcher: Supabase query error detected.');
            throw error;
        }

        console.log('[Fetcher] profileFetcher: Success, returning data:', data);
        return data;
    } catch (error) {
        console.error('[Fetcher] profileFetcher: Error caught in catch block:', error);
        // SWR はエラーを throw することを期待する
        throw error;
    }
};

// 目標栄養素取得 Fetcher
export const targetsFetcher = async (dueDate: string | null | undefined): Promise<typeof DEFAULT_NUTRITION_TARGETS> => {
    console.log('[Fetcher] targetsFetcher called with dueDate:', dueDate);
    if (!dueDate) {
        console.log('[Fetcher] No dueDate, returning default targets.');
        return DEFAULT_NUTRITION_TARGETS;
    }
    try {
        const week = calculatePregnancyWeek(dueDate);
        const currentTrimester = getTrimesterNumber(week);
        console.log(`[Fetcher] Fetching targets for trimester: ${currentTrimester}`);

        const { data: targetData, error: targetError } = await supabase
            .from('nutrition_targets')
            .select('*')
            .eq('trimester', currentTrimester)
            .maybeSingle<NutritionTarget>();

        if (targetError) throw targetError;

        if (targetData) {
            const extractedTargets = {
                calories: targetData.calories ?? DEFAULT_NUTRITION_TARGETS.calories,
                protein: targetData.protein ?? DEFAULT_NUTRITION_TARGETS.protein,
                iron: targetData.iron ?? DEFAULT_NUTRITION_TARGETS.iron,
                folic_acid: targetData.folic_acid ?? DEFAULT_NUTRITION_TARGETS.folic_acid,
                calcium: targetData.calcium ?? DEFAULT_NUTRITION_TARGETS.calcium,
                vitamin_d: targetData.vitamin_d ?? DEFAULT_NUTRITION_TARGETS.vitamin_d,
            };
            console.log('[Fetcher] targetsFetcher success:', extractedTargets);
            return extractedTargets;
        } else {
            console.log('[Fetcher] No specific targets found, returning default.');
            return DEFAULT_NUTRITION_TARGETS;
        }
    } catch (error) {
        console.error('[Fetcher] Error fetching targets:', error);
        throw error; // Re-throw for SWR
    }
};

// 栄養進捗取得 Fetcher: データがない場合は null を返すように変更
export const progressFetcher = async (userId: string, date: string): Promise<NutritionProgress | null> => {
    console.log('[Fetcher] progressFetcher called for user:', userId, 'date:', date);
    if (!userId) {
        console.log('[Fetcher] No userId provided to progressFetcher.');
        // ユーザーIDがない場合は null を返すかエラー
        // throw new Error("User ID is required to fetch progress.");
        return null;
    }
    try {
        const { data, error } = await supabase
            .from('nutrition_goal_prog')
            .select('*')
            .eq('user_id', userId)
            .eq('meal_date', date)
            .maybeSingle<NutritionProgress>();

        if (error) throw error;

        console.log('[Fetcher] progressFetcher DB response:', data);
        // データがない場合は null を返す
        return data; // data は NutritionProgress | null
    } catch (error) {
        console.error('[Fetcher] Error fetching progress:', error);
        throw error;
    }
};
