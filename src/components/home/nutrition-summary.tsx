import React, { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronRight } from 'lucide-react';
import { StandardizedMealNutrition, Nutrient } from '@/types/nutrition';
import { calculateNutritionScore, calculatePercentage, DEFAULT_NUTRITION_TARGETS, getNutrientBarColor } from '@/lib/nutrition/nutrition-display-utils';
import { calculatePregnancyWeek, getTrimesterNumber, getTrimesterName } from '@/lib/date-utils';

// NutritionTargets 型定義 (home-client.tsx と合わせる)
type NutritionTargets = typeof DEFAULT_NUTRITION_TARGETS;

interface UserProfile {
    name?: string;
    pregnancy_week?: number;
    due_date?: string | null;
}

interface NutritionSummaryProps {
    dailyNutrition: StandardizedMealNutrition | null;
    targets: NutritionTargets;
    isMorningWithNoMeals?: boolean;
    profile?: UserProfile;
}

export function NutritionSummary({ dailyNutrition, targets, isMorningWithNoMeals = false, profile }: NutritionSummaryProps) {
    const router = useRouter();

    // 栄養データがない場合は朝の表示を行う
    if (isMorningWithNoMeals && profile) {
        return <MorningNutritionView profile={profile} />;
    }

    // スコア計算時に targets を渡す (calculateNutritionScore が targets を受け取るように修正されている場合)
    // 現在の実装では calculateNutritionScore は targets を受け取るので渡す
    const nutritionScore = calculateNutritionScore(dailyNutrition, targets);

    // スコアに応じたメッセージ
    const getMessage = (score: number): string => {
        if (score === 0) return "今日も元気に過ごしましょう！";
        if (score < 30) return "食事記録を始めました！";
        if (score < 60) return "バランスよく食べています！";
        return "栄養バランスは良好です！";
    };

    // 表示するメッセージを取得 (不足している栄養素がある場合のメッセージ)
    // ここで props.targets を使うように修正
    const getNutritionMessage = (dailyNutrition: StandardizedMealNutrition | null, currentTargets: NutritionTargets): string => {
        if (!dailyNutrition) return "栄養バランスが良好です！";

        const deficientNutrients: string[] = [];

        // 不足している栄養素を特定
        const items = [
            { key: 'calories' as keyof NutritionTargets, name: 'カロリー' },
            { key: 'protein' as keyof NutritionTargets, name: 'タンパク質' },
            { key: 'iron' as keyof NutritionTargets, name: '鉄分' },
            { key: 'folic_acid' as keyof NutritionTargets, name: '葉酸' },
            { key: 'calcium' as keyof NutritionTargets, name: 'カルシウム' },
            { key: 'vitamin_d' as keyof NutritionTargets, name: 'ビタミンD' }
        ];

        items.forEach(item => {
            const nutrientKey = item.key;
            // props から渡された targets を使用
            const target = currentTargets[nutrientKey];
            let value = 0;

            if (nutrientKey === 'calories') {
                value = dailyNutrition.totalCalories;
            } else {
                // totalNutrients の検索ロジック改善: name と key を直接比較
                const nutrient = dailyNutrition.totalNutrients.find(
                    n => n.name.toLowerCase() === item.key
                );
                value = nutrient ? nutrient.value : 0;
            }

            const percentValue = calculatePercentage(value, target);

            // 70%未満の栄養素を不足としてマーク
            if (percentValue < 70) {
                deficientNutrients.push(item.name);
            }
        });

        if (deficientNutrients.length === 0) {
            return "素晴らしい栄養バランスです！";
        } else {
            return `栄養バランスの改善が必要です\n特に ${deficientNutrients.join('・')} が不足気味です。`;
        }
    };

    return (
        <Card className="mb-4">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">栄養バランス</CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-sm font-normal text-gray-500 h-auto p-1"
                        onClick={() => router.push('/dashboard')}
                    >
                        詳細を見る
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mr-4 relative">
                        {nutritionScore > 0 && (
                            <div
                                className="absolute inset-0 rounded-full border-4 border-green-500"
                                style={{
                                    clipPath: `polygon(0 0, 100% 0, 100% ${nutritionScore}%, 0% ${nutritionScore}%)`,
                                    opacity: 0.7
                                }}
                            ></div>
                        )}
                        <span className="text-2xl font-bold">{nutritionScore}</span>
                    </div>
                    <p className="text-gray-600">{getNutritionMessage(dailyNutrition, targets)}</p>
                </div>

                {/* 栄養素グリッド表示 */}
                <div className="grid grid-cols-3 gap-2">
                    {renderNutritionItems(dailyNutrition, targets)}
                </div>
            </CardContent>
        </Card>
    );
}

// 栄養素アイテム表示
// targets を props として受け取る
function renderNutritionItems(dailyNutrition: StandardizedMealNutrition | null, targets: NutritionTargets) {
    const items = [
        { key: 'calories' as keyof NutritionTargets, name: 'カロリー', icon: '🔥', color: 'orange' },
        { key: 'protein' as keyof NutritionTargets, name: 'タンパク質', icon: '🥩', color: 'red' },
        { key: 'iron' as keyof NutritionTargets, name: '鉄分', icon: 'Fe', color: 'purple' },
        { key: 'folic_acid' as keyof NutritionTargets, name: '葉酸', icon: '🥬', color: 'green' },
        { key: 'calcium' as keyof NutritionTargets, name: 'カルシウム', icon: '🥛', color: 'blue' },
        { key: 'vitamin_d' as keyof NutritionTargets, name: 'ビタミンD', icon: '☀️', color: 'yellow' }
    ];

    const filteredItems = items.map(item => {
        const nutrientKey = item.key;
        // props から渡された targets を使用
        const target = targets[nutrientKey];
        let value = 0;

        if (dailyNutrition) {
            if (nutrientKey === 'calories') {
                value = dailyNutrition.totalCalories;
            } else {
                // totalNutrients の検索ロジック改善: name と key を直接比較
                const nutrient = dailyNutrition.totalNutrients.find(
                    n => n.name.toLowerCase() === item.key
                );
                value = nutrient ? nutrient.value : 0;
            }
        }

        const percentValue = calculatePercentage(value, target);

        return {
            ...item,
            value,
            target,
            percentValue,
            isDeficient: percentValue < 70
        };
    });

    // filteredItemsからfilterを削除し、すべての栄養素を表示

    if (filteredItems.length === 0) {
        return (
            <div className="col-span-3 text-center py-4 text-gray-500">
                すべての栄養素が十分に摂取されています！
            </div>
        );
    }

    return filteredItems.map(item => {
        const colorClass = getNutrientBarColor(item.percentValue);

        return (
            <div key={item.key} className="bg-gray-50 rounded p-2 flex items-center">
                <div className={`w-6 h-6 rounded-full ${getBackgroundColor(item.color)} flex items-center justify-center mr-2`}>
                    <span className={`${getTextColor(item.color)} text-xs`}>{item.icon}</span>
                </div>
                <div className="flex-1">
                    <div className="flex justify-between">
                        <span className="text-sm">{item.name}</span>
                        <span className={`text-sm font-medium ${item.percentValue < 50 ? 'text-red-500' : 'text-orange-500'}`}>
                            {item.percentValue}%
                        </span>
                    </div>
                    <Progress value={item.percentValue} className={`h-1 mt-1 ${colorClass}`} />
                </div>
            </div>
        );
    });
}

// アイコン背景色の取得
function getBackgroundColor(color: string): string {
    const colorMap: Record<string, string> = {
        'orange': 'bg-orange-100',
        'red': 'bg-red-100',
        'green': 'bg-green-100',
        'blue': 'bg-blue-100',
        'purple': 'bg-purple-100',
        'yellow': 'bg-yellow-100'
    };

    return colorMap[color] || 'bg-gray-100';
}

// アイコンテキスト色の取得
function getTextColor(color: string): string {
    const colorMap: Record<string, string> = {
        'orange': 'text-orange-600',
        'red': 'text-red-600',
        'green': 'text-green-600',
        'blue': 'text-blue-600',
        'purple': 'text-purple-600',
        'yellow': 'text-yellow-600'
    };

    return colorMap[color] || 'text-gray-600';
}

// 朝の栄養ビュー（栄養記録がない場合に表示）
function MorningNutritionView({ profile }: { profile: UserProfile }) {
    const router = useRouter();

    // 妊娠週数の計算
    const pregnancyWeekInfo = profile.due_date ? calculatePregnancyWeek(profile.due_date) : { week: profile.pregnancy_week || 0, days: 0 };
    const currentWeek = pregnancyWeekInfo.week;

    // トライメスターの取得
    const trimester = getTrimesterNumber(currentWeek);
    const trimesterName = getTrimesterName(currentWeek);

    // トライメスターに応じた色を返すヘルパー関数
    const getTrimesterColorLocal = (trimester: number): string => {
        if (trimester === 1) return 'bg-blue-100 text-blue-800';
        if (trimester === 2) return 'bg-green-100 text-green-800';
        return 'bg-purple-100 text-purple-800';
    };

    // トライメスターに応じたメッセージを返すヘルパー関数（getTrimesterNameを使用）
    const getTrimesterMessageLocal = (week: number): string => {
        if (week <= 0) return '';
        if (week <= 15) return "赤ちゃんの体が作られる大切な時期";
        if (week <= 27) return "安定期に入り、赤ちゃんの成長が著しい時期";
        return "出産に向けて体が変化する時期";
    };

    return (
        <Card className="mb-4 overflow-hidden border-none shadow-md relative">
            {/* トップバー装飾 - グラデーション */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#36B37E] via-[#2E9E6C] to-[#1A6B47]"></div>

            <CardHeader className="pb-2 pt-5">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center">
                        <span className="mr-2">今日の健康</span>
                        <span className="text-sm bg-[#E3F3ED] text-[#2E9E6C] px-2 py-0.5 rounded-full font-normal">
                            妊娠{currentWeek ?? '??'}週目
                        </span>
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-sm font-normal text-gray-500 h-auto p-1"
                        onClick={() => router.push('/dashboard')}
                    >
                        詳細を見る
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* 健康メッセージカード - 統一されたデザイン */}
                <div className="bg-[#F0F7F4] rounded-lg p-4 mb-3 border border-[#D0E9DF] shadow-sm">
                    <div className="flex items-start">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mr-3 shadow-sm border border-[#E3F3ED]">
                            <span role="img" aria-label="health" className="text-lg">
                                {trimester === 1 ? '🌱' : trimester === 2 ? '🌿' : '🌳'}
                            </span>
                        </div>
                        <div>
                            <p className="font-medium text-[#2E9E6C]">
                                こんにちは{profile.name ? `、${profile.name}さん` : ''}
                            </p>
                            <p className="text-sm text-[#3B7E64] opacity-90 mt-1 leading-relaxed">
                                今日も健やかな一日をお過ごしください。
                                {currentWeek > 0 && `妊娠${currentWeek}週目は${getTrimesterMessageLocal(currentWeek)}です。`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 今日のポイント - 統一されたデザイン */}
                <div className="bg-white rounded-lg p-4 mb-4 border border-[#E6EFE9] shadow-sm">
                    <div className="flex items-start">
                        <div className="w-8 h-8 rounded-full bg-[#E3F3ED] flex items-center justify-center mr-3 mt-0.5">
                            <span role="img" aria-label="light bulb" className="text-[#2E9E6C] text-sm">💡</span>
                        </div>
                        <div>
                            <h4 className="font-medium text-[#2C3F37] mb-1">今日のポイント</h4>
                            <p className="text-sm text-[#4B5D54] leading-relaxed">
                                {getFocusNutrient(currentWeek)}を含む食品を意識して摂るとよいでしょう。バランスの取れた食事が大切です。
                            </p>
                        </div>
                    </div>
                </div>

                {/* アクションボタン - グラデーション */}
                <Button
                    className="w-full shadow-sm bg-gradient-to-r from-[#36B37E] to-[#2E9E6C] hover:from-[#2E9E6C] hover:to-[#1A6B47]"
                    onClick={() => router.push('/meals/log')}
                >
                    食事を記録する
                </Button>
            </CardContent>
        </Card>
    );
}

// 妊娠週数に応じたフォーカス栄養素の提案
function getFocusNutrient(pregnancyWeek: number): string {
    // 第1トライメスター
    if (pregnancyWeek <= 13) {
        return "葉酸や鉄分";
    }
    // 第2トライメスター
    else if (pregnancyWeek <= 27) {
        return "カルシウムとタンパク質";
    }
    // 第3トライメスター
    else {
        return "鉄分とビタミンD";
    }
} 