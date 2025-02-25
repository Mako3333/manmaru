export function getGoogleApiKey(): string {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_API_KEY が設定されていません");
    }
    return apiKey;
}

export const getSupabaseUrl = (): string => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL環境変数が設定されていません");
    }
    return url;
};

export const getSupabaseServiceKey = (): string => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY環境変数が設定されていません");
    }
    return key;
};

export const getSupabaseAnonKey = (): string => {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) {
        throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY環境変数が設定されていません");
    }
    return key;
}; 