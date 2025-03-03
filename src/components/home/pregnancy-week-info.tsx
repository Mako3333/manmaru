'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, differenceInWeeks, addWeeks } from 'date-fns';
import { Progress } from '@/components/ui/progress';

interface PregnancyWeekInfoProps {
    className?: string;
}

// 妊娠週数に応じた赤ちゃんの成長情報
const BABY_GROWTH_INFO = {
    1: { size: '1mmの細胞', description: '受精卵が着床し、妊娠が始まります。', icon: '🔬' },
    4: { size: '6-8mm（ブルーベリー）', description: '心臓が形成され始め、羊水の中で浮かんでいます。', icon: '🫐' },
    8: { size: '3cm（イチゴ）', description: '手足が形成され、指も現れ始めています。', icon: '🍓' },
    12: { size: '7cm（ライム）', description: '性別の特徴が現れ始め、胎動も始まります。', icon: '🍋' },
    16: { size: '12cm（アボカド）', description: '羊水の中で目を開け、閉じることができます。', icon: '🥑' },
    20: { size: '16cm（バナナ）', description: '赤ちゃんの動きを外から感じられるようになります。', icon: '🍌' },
    24: { size: '21cm（トウモロコシ）', description: '肺が発達し、生存能力が高まります。', icon: '🌽' },
    28: { size: '25cm（カリフラワー）', description: '脳が急速に発達し、夢を見始めます。', icon: '🥦' },
    32: { size: '28cm（ココナッツ）', description: '皮下脂肪が増え、丸みを帯びてきます。', icon: '🥥' },
    36: { size: '32cm（メロン）', description: '肺が成熟し、出産の準備が整います。', icon: '🍈' },
    40: { size: '35cm（スイカ）', description: '出産予定日です。赤ちゃんは完全に発達しています。', icon: '🍉' },
};

// トライメスター情報
const TRIMESTER_INFO = {
    1: { name: '第1期', weeks: '1-13週', description: '赤ちゃんの重要な器官が形成される時期です。', color: 'from-blue-400 to-blue-600' },
    2: { name: '第2期', weeks: '14-27週', description: '赤ちゃんの成長が加速し、胎動を感じる時期です。', color: 'from-green-400 to-green-600' },
    3: { name: '第3期', weeks: '28-40週', description: '赤ちゃんが最終的な準備をする時期です。', color: 'from-purple-400 to-purple-600' },
};

export default function PregnancyWeekInfo({ className }: PregnancyWeekInfoProps) {
    const [profile, setProfile] = useState<any>(null);
    const [pregnancyWeek, setPregnancyWeek] = useState<number | null>(null);
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClientComponentClient();

    useEffect(() => {
        const fetchProfileData = async () => {
            try {
                setLoading(true);

                // セッションの有効性を確認
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setError('ログインが必要です');
                    setLoading(false);
                    return;
                }

                // プロフィール情報の取得
                const { data, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .single();

                if (profileError) {
                    throw profileError;
                }

                setProfile(data);

                // 出産予定日がある場合、妊娠週数を計算
                if (data.due_date) {
                    const dueDateObj = new Date(data.due_date);
                    setDueDate(dueDateObj);

                    // 妊娠週数の計算（出産予定日から逆算：出産予定日は妊娠40週目）
                    const today = new Date();
                    const conceptionDate = addWeeks(dueDateObj, -40);
                    const weeksPregnant = differenceInWeeks(today, conceptionDate);

                    // 妊娠週数が正の値かつ41未満の場合のみ設定
                    if (weeksPregnant >= 0 && weeksPregnant <= 40) {
                        setPregnancyWeek(weeksPregnant);
                    } else if (weeksPregnant > 40) {
                        // 出産予定日を過ぎている場合
                        setPregnancyWeek(40);
                    } else {
                        // まだ妊娠していない場合（将来の出産予定日）
                        setPregnancyWeek(0);
                    }
                }
            } catch (err) {
                console.error('プロフィール取得エラー:', err);
                setError('プロフィール情報の取得に失敗しました');
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, [supabase]);

    // 現在のトライメスターを判定
    const getCurrentTrimester = (week: number) => {
        if (week < 14) return 1;
        if (week < 28) return 2;
        return 3;
    };

    // 週数に応じた赤ちゃんの成長情報を取得
    const getBabyGrowthInfo = (week: number) => {
        // 最も近い週数の情報を取得
        const availableWeeks = Object.keys(BABY_GROWTH_INFO).map(Number);
        const closestWeek = availableWeeks.reduce((prev, curr) => {
            return (Math.abs(curr - week) < Math.abs(prev - week)) ? curr : prev;
        });
        return BABY_GROWTH_INFO[closestWeek as keyof typeof BABY_GROWTH_INFO];
    };

    // 出産予定日までの日数を計算
    const calculateDaysLeft = (dueDate: Date) => {
        const today = new Date();
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    if (loading) {
        return (
            <Card className={`w-full ${className}`}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg sm:text-xl font-bold">妊娠週数情報</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className={`w-full ${className}`}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg sm:text-xl font-bold">妊娠週数情報</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-red-500 py-8">{error}</div>
                </CardContent>
            </Card>
        );
    }

    if (!profile || !dueDate || pregnancyWeek === null) {
        return (
            <Card className={`w-full ${className}`}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg sm:text-xl font-bold">妊娠週数情報</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-gray-500 py-8">
                        プロフィールに出産予定日が設定されていません。
                        <br />
                        <a href="/profile" className="text-blue-500 hover:underline">
                            プロフィール設定へ
                        </a>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const currentTrimester = getCurrentTrimester(pregnancyWeek);
    const trimesterInfo = TRIMESTER_INFO[currentTrimester as keyof typeof TRIMESTER_INFO];
    const babyInfo = getBabyGrowthInfo(pregnancyWeek);
    const daysRemaining = calculateDaysLeft(dueDate);
    const progressPercentage = Math.min((pregnancyWeek / 40) * 100, 100);

    return (
        <Card className={`w-full overflow-hidden ${className}`}>
            <div className={`h-2 bg-gradient-to-r ${trimesterInfo.color}`}></div>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-lg sm:text-xl font-bold">妊娠 {pregnancyWeek}週目</CardTitle>
                        <CardDescription>
                            出産予定日まであと {daysRemaining}日
                        </CardDescription>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-white text-sm bg-gradient-to-r ${trimesterInfo.color}`}>
                        {trimesterInfo.name} ({trimesterInfo.weeks})
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <div className="mb-2 flex justify-between text-xs text-gray-500">
                            <span>0週</span>
                            <span>20週</span>
                            <span>40週</span>
                        </div>
                        <Progress
                            value={progressPercentage}
                            className="h-3 bg-gray-100"
                            style={{
                                background: 'linear-gradient(to right, #f0f9ff, #e0f2fe, #bae6fd)',
                            }}
                        />
                    </div>

                    <div className="p-4 rounded-lg border bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100">
                        <div className="flex items-start gap-3">
                            <div className="w-16 h-16 flex items-center justify-center text-4xl bg-white rounded-full shadow-sm">
                                {babyInfo.icon}
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-indigo-900 mb-1">赤ちゃんの大きさ</div>
                                <div className="text-indigo-800 font-medium">{babyInfo.size}</div>
                                <div className="mt-1 text-sm text-indigo-700">{babyInfo.description}</div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg border bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100">
                        <div className="font-semibold text-amber-900 mb-1">今週のポイント</div>
                        <div className="text-sm text-amber-800">{trimesterInfo.description}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 