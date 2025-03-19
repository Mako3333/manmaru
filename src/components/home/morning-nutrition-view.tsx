import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { calculatePregnancyWeek, getTrimesterNumber } from '@/lib/date-utils';

interface UserProfile {
    name?: string;
    pregnancy_week?: number;
    due_date?: string;
}

interface MorningNutritionViewProps {
    profile: UserProfile;
}

export function MorningNutritionView({ profile }: MorningNutritionViewProps) {
    const router = useRouter();

    // 妊娠週数の計算（pregnancy-week-info.tsxと同じロジックを使用）
    const pregnancyWeek = profile.due_date
        ? calculatePregnancyWeek(profile.due_date)
        : profile.pregnancy_week || 0;

    // トライメスターの取得（アイコン表示のみに使用）
    const trimester = getTrimesterNumber(pregnancyWeek);

    return (
        <Card className="mb-4 overflow-hidden border-none shadow-md relative">
            {/* トップバー装飾 - グラデーション */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#36B37E] via-[#2E9E6C] to-[#1A6B47]"></div>

            <CardHeader className="pb-2 pt-5">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center">
                        <span className="mr-2">今日の健康</span>
                        <span className="text-sm bg-[#E3F3ED] text-[#2E9E6C] px-2 py-0.5 rounded-full font-normal">
                            妊娠{pregnancyWeek}週目
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
                                {pregnancyWeek > 0 && `妊娠${pregnancyWeek}週目は赤ちゃんの${getTrimesterMessage(pregnancyWeek)}時期です。`}
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
                                {getFocusNutrient(pregnancyWeek)}を含む食品を意識して摂るとよいでしょう。バランスの取れた食事が大切です。
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

// 妊娠週数に応じたメッセージ
function getTrimesterMessage(pregnancyWeek: number): string {
    if (pregnancyWeek <= 13) {
        return "重要な器官が形成される";
    } else if (pregnancyWeek <= 27) {
        return "成長が加速する";
    } else {
        return "出産に向けて準備が進む";
    }
} 