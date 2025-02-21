export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    user_id: string
                    age: number | null
                    pregnancy_week: number | null
                    height: number | null
                    weight: number | null
                    adult_family_members: number | null
                    child_family_members: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    age?: number | null
                    pregnancy_week?: number | null
                    height?: number | null
                    weight?: number | null
                    adult_family_members?: number | null
                    child_family_members?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    age?: number | null
                    pregnancy_week?: number | null
                    height?: number | null
                    weight?: number | null
                    adult_family_members?: number | null
                    child_family_members?: number | null
                    created_at?: string
                    updated_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}