/**
 * ユーザープロファイルの基本インターフェース
 */
export interface UserProfile {
    id: string
    user_id: string
    age: number
    pregnancy_week: number
    trimester: number
    height: number
    weight: number
    due_date: string | null
    dietary_restrictions: string[] | null
    adult_family_members: number
    child_family_members: number
    auto_update_week: boolean
    created_at: string
    updated_at: string | null
}

/**
 * プロファイル更新時のデータ
 */
export interface ProfileUpdateData {
    age?: number
    pregnancy_week?: number
    height?: number
    weight?: number
    due_date?: string | null
    dietary_restrictions?: string[] | null
    adult_family_members?: number
    child_family_members?: number
    auto_update_week?: boolean
}

/**
 * 体重記録の基本インターフェース
 */
export interface WeightLog {
    id: string
    user_id: string
    log_date: string
    weight: number
    comment: string | null
    created_at: string
}

/**
 * 体重記録作成時のデータ
 */
export interface WeightLogCreateData {
    log_date?: string
    weight: number
    comment?: string | null
}

/**
 * 食事制限の種類
 */
export enum DietaryRestriction {
    VEGETARIAN = 'vegetarian',
    VEGAN = 'vegan',
    GLUTEN_FREE = 'gluten_free',
    DAIRY_FREE = 'dairy_free',
    NUT_ALLERGY = 'nut_allergy',
    SEAFOOD_ALLERGY = 'seafood_allergy',
    EGG_ALLERGY = 'egg_allergy',
    SOY_ALLERGY = 'soy_allergy',
    LOW_SODIUM = 'low_sodium',
    DIABETIC = 'diabetic'
}