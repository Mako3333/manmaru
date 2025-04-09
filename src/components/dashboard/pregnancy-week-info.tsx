'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, differenceInWeeks, addWeeks } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { UserProfile } from '@/types/user';

interface PregnancyWeekInfoProps {
    className?: string;
    dueDate?: Date;
}

// 妊娠週数に応じた赤ちゃんの成長情報
const BABY_GROWTH_INFO = {
    1: { size: '1mmの細胞', description: '受精卵が着床し、妊娠が始まります。' },
    4: { size: '6-8mm（ブルーベリー）', description: '心臓が形成され始め、羊水の中で浮かんでいます。' },
    8: { size: '3cm（イチゴ）', description: '手足が形成され、指も現れ始めています。' },
    12: { size: '7cm（ライム）', description: '性別の特徴が現れ始め、胎動も始まります。' },
    16: { size: '12cm（アボカド）', description: '羊水の中で目を開け、閉じることができます。' },
    20: { size: '16cm（バナナ）', description: '赤ちゃんの動きを外から感じられるようになります。' },
    24: { size: '21cm（トウモロコシ）', description: '肺が発達し、生存能力が高まります。' },
    28: { size: '25cm（カリフラワー）', description: '脳が急速に発達し、夢を見始めます。' },
    32: { size: '28cm（ココナッツ）', description: '皮下脂肪が増え、丸みを帯びてきます。' },
    36: { size: '32cm（メロン）', description: '肺が成熟し、出産の準備が整います。' },
    40: { size: '35cm（スイカ）', description: '出産予定日です。赤ちゃんは完全に発達しています。' },
};

// トライメスター情報
const TRIMESTER_INFO = {
    1: { name: '第1期', weeks: '1-13週', description: '赤ちゃんの重要な器官が形成される時期です。', color: 'bg-blue-500' },
    2: { name: '第2期', weeks: '14-27週', description: '赤ちゃんの成長が加速し、胎動を感じる時期です。', color: 'bg-green-500' },
    3: { name: '第3期', weeks: '28-40週', description: '赤ちゃんが最終的な準備をする時期です。', color: 'bg-purple-500' },
};

// Supabaseテーブルのプロファイルデータ型（テーブル構造に基づく）
interface DatabaseProfile {
    id: string;
    user_id: string;
    due_date?: string | null;
    // 必要に応じて他のフィールドを追加
}

export default function PregnancyWeekInfo({ className, dueDate: propDueDate }: PregnancyWeekInfoProps) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [pregnancyWeek, setPregnancyWeek] = useState<number | null>(null);
    const [dueDate, setDueDate] = useState<Date | null>(propDueDate ? propDueDate : null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

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

                // 型安全のためにデータを確認してから設定
                if (data) {
                    // DatabaseProfile 型として扱い、必要なプロパティにアクセス
                    const profileData = data as DatabaseProfile;
                    setProfile(profileData as unknown as UserProfile); // 暫定的な型変換（将来的には適切な変換関数を実装）

                    // 出産予定日がある場合、妊娠週数を計算
                    if (profileData.due_date) {
                        const dueDateObj = new Date(profileData.due_date);
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

    return (
        <Card className={`w-full ${className}`}>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg sm:text-xl font-bold">妊娠週数情報</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
                        <div>
                            <div className="text-3xl font-bold">{pregnancyWeek}週目</div>
                            <div className="text-sm text-gray-500">
                                出産予定日: {format(dueDate, 'yyyy年MM月dd日')}
                            </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-white text-sm ${trimesterInfo.color}`}>
                            {trimesterInfo.name} ({trimesterInfo.weeks})
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 flex justify-between text-xs">
                            <span>0週</span>
                            <span>20週</span>
                            <span>40週</span>
                        </div>
                        <Progress value={pregnancyWeek * 2.5} className="h-2" />
                    </div>

                    <div className="p-4 rounded-lg border bg-indigo-50 text-indigo-800 border-indigo-200">
                        <div className="font-semibold mb-1">赤ちゃんの大きさ</div>
                        <div className="flex gap-2 items-center">
                            <span className="text-2xl">🍼</span>
                            <span>{babyInfo.size}</span>
                        </div>
                        <div className="mt-2 text-sm">{babyInfo.description}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 