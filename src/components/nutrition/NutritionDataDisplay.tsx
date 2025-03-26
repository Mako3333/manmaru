import { StandardizedMealNutrition, Nutrient } from '@/types/nutrition';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface NutritionDataDisplayProps {
    nutritionData: StandardizedMealNutrition;
    className?: string;
}

// 重要な栄養素を最初に表示する順序
const IMPORTANT_NUTRIENTS = [
    'タンパク質', 'protein',
    '鉄分', 'iron',
    '葉酸', 'folic_acid',
    'カルシウム', 'calcium',
    'ビタミンD', 'vitamin_d'
];

// 栄養素の日本語表示名マッピング
const NUTRIENT_DISPLAY_NAMES: Record<string, string> = {
    'protein': 'タンパク質',
    'iron': '鉄分',
    'folic_acid': '葉酸',
    'calcium': 'カルシウム',
    'vitamin_d': 'ビタミンD',
    'calories': 'カロリー'
};

// 栄養素の単位表示
const NUTRIENT_UNITS: Record<string, string> = {
    'タンパク質': 'g',
    'protein': 'g',
    '鉄分': 'mg',
    'iron': 'mg',
    '葉酸': 'μg',
    'folic_acid': 'μg',
    'カルシウム': 'mg',
    'calcium': 'mg',
    'ビタミンD': 'μg',
    'vitamin_d': 'μg',
    'カロリー': 'kcal',
    'calories': 'kcal'
};

// 妊婦向け栄養素の推奨摂取量（1日あたり）
const PREGNANCY_RDI: Record<string, number> = {
    'タンパク質': 65, // g
    'protein': 65, // g
    '鉄分': 20, // mg
    'iron': 20, // mg
    '葉酸': 480, // μg
    'folic_acid': 480, // μg
    'カルシウム': 650, // mg
    'calcium': 650, // mg
    'ビタミンD': 8.5, // μg
    'vitamin_d': 8.5 // μg
};

// 栄養素の進捗状況に応じた色分け
function getProgressColor(percentOfRDI: number): string {
    if (percentOfRDI >= 100) {
        return 'bg-green-500'; // 十分
    } else if (percentOfRDI >= 75) {
        return 'bg-lime-400'; // ほぼ十分
    } else if (percentOfRDI >= 50) {
        return 'bg-yellow-400'; // 中程度
    } else if (percentOfRDI >= 25) {
        return 'bg-orange-400'; // やや不足
    } else {
        return 'bg-red-500'; // 不足
    }
}

// 栄養素のソート関数
function sortNutrients(nutrients: Nutrient[]): Nutrient[] {
    return [...nutrients].sort((a, b) => {
        const aIndex = IMPORTANT_NUTRIENTS.findIndex(
            name => name.toLowerCase() === a.name.toLowerCase()
        );
        const bIndex = IMPORTANT_NUTRIENTS.findIndex(
            name => name.toLowerCase() === b.name.toLowerCase()
        );

        // 重要な栄養素を優先
        if (aIndex !== -1 && bIndex === -1) return -1;
        if (aIndex === -1 && bIndex !== -1) return 1;
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;

        // それ以外はアルファベット順
        return a.name.localeCompare(b.name);
    });
}

export function NutritionDataDisplay({ nutritionData, className }: NutritionDataDisplayProps) {
    // 栄養素をソート
    const sortedNutrients = sortNutrients(nutritionData.totalNutrients);

    // 妊婦向け特別データ
    const pregnancyData = nutritionData.pregnancySpecific || {
        folatePercentage: 0,
        ironPercentage: 0,
        calciumPercentage: 0
    };

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="text-lg">栄養データ</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* カロリー情報 */}
                    <div className="mb-4">
                        <div className="flex justify-between items-center">
                            <span className="font-medium">カロリー</span>
                            <span>{Math.round(nutritionData.totalCalories)} kcal</span>
                        </div>
                    </div>

                    {/* 妊婦向け特別栄養素 */}
                    <div className="space-y-3 border rounded-lg p-3 bg-pink-50">
                        <h4 className="font-medium text-sm text-pink-700">妊婦向け重要栄養素</h4>

                        <div className="space-y-2">
                            {/* 葉酸 */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm">葉酸</span>
                                    <span className="text-sm">
                                        {pregnancyData.folatePercentage.toFixed(0)}%
                                    </span>
                                </div>
                                <Progress
                                    value={pregnancyData.folatePercentage}
                                    max={100}
                                    className={`h-2 ${getProgressColor(pregnancyData.folatePercentage)}`}
                                />
                            </div>

                            {/* 鉄分 */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm">鉄分</span>
                                    <span className="text-sm">
                                        {pregnancyData.ironPercentage.toFixed(0)}%
                                    </span>
                                </div>
                                <Progress
                                    value={pregnancyData.ironPercentage}
                                    max={100}
                                    className={`h-2 ${getProgressColor(pregnancyData.ironPercentage)}`}
                                />
                            </div>

                            {/* カルシウム */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm">カルシウム</span>
                                    <span className="text-sm">
                                        {pregnancyData.calciumPercentage.toFixed(0)}%
                                    </span>
                                </div>
                                <Progress
                                    value={pregnancyData.calciumPercentage}
                                    max={100}
                                    className={`h-2 ${getProgressColor(pregnancyData.calciumPercentage)}`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 詳細栄養素 */}
                    <div className="space-y-2 mt-4">
                        <h4 className="font-medium text-sm">その他の栄養素</h4>

                        <div className="grid grid-cols-2 gap-2">
                            {sortedNutrients.map((nutrient, index) => {
                                const displayName = NUTRIENT_DISPLAY_NAMES[nutrient.name] || nutrient.name;
                                const unit = nutrient.unit || NUTRIENT_UNITS[nutrient.name] || '';
                                const rdi = PREGNANCY_RDI[nutrient.name] || null;
                                const percentOfRDI = rdi ? (nutrient.value / rdi) * 100 : null;

                                // 重要な栄養素は別セクションで表示するのでスキップ
                                if (
                                    nutrient.name === '葉酸' ||
                                    nutrient.name === 'folic_acid' ||
                                    nutrient.name === '鉄分' ||
                                    nutrient.name === 'iron' ||
                                    nutrient.name === 'カルシウム' ||
                                    nutrient.name === 'calcium'
                                ) {
                                    return null;
                                }

                                return (
                                    <div key={index} className="flex justify-between text-sm">
                                        <span>{displayName}</span>
                                        <span>
                                            {nutrient.value.toFixed(1)} {unit}
                                            {percentOfRDI !== null && (
                                                <span className="text-xs text-gray-500 ml-1">
                                                    ({percentOfRDI.toFixed(0)}%)
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <p className="text-xs text-gray-500 mt-4">
                        ※ 栄養データは推定値です。実際の値とは異なる場合があります。
                    </p>
                </div>
            </CardContent>
        </Card>
    );
} 