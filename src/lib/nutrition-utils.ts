// 栄養素の表示名を取得
export const getNutrientDisplayName = (key: string): string => {
    const nameMap: Record<string, string> = {
        'calories': 'カロリー',
        'protein': 'タンパク質',
        'iron': '鉄分',
        'folic_acid': '葉酸',
        'calcium': 'カルシウム',
        'vitamin_d': 'ビタミンD'
    };
    return nameMap[key] || key;
};

// 栄養素の単位を取得
export const getNutrientUnit = (key: string): string => {
    const unitMap: Record<string, string> = {
        'calories': 'kcal',
        'protein': 'g',
        'iron': 'mg',
        'folic_acid': 'μg',
        'calcium': 'mg',
        'vitamin_d': 'μg'
    };
    return unitMap[key] || '';
}; 