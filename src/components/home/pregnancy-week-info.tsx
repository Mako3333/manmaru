'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, differenceInWeeks, addWeeks } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { CalendarIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

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
    1: { name: '初期', weeks: '1-13週', description: '赤ちゃんの重要な器官が形成される時期です。', color: 'from-pink-400 to-rose-500', bgColor: 'bg-rose-50', textColor: 'text-rose-700', borderColor: 'border-rose-200' },
    2: { name: '安定期', weeks: '14-27週', description: '赤ちゃんの成長が加速し、胎動を感じる時期です。', color: 'from-purple-400 to-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', borderColor: 'border-indigo-200' },
    3: { name: '後期', weeks: '28-40週', description: '赤ちゃんが最終的な準備をする時期です。', color: 'from-teal-400 to-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
};

// 週数マーカーのデータ
const WEEK_MARKERS = [
    { week: 0, label: '0週' },
    { week: 13, label: '13週' },
    { week: 27, label: '27週' },
    { week: 40, label: '40週' },
];

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
            <Card className={`w-full shadow-md ${className}`}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg sm:text-xl font-bold">妊娠週数情報</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className={`w-full shadow-md ${className}`}>
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
            <Card className={`w-full shadow-md ${className}`}>
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
        <Card className={`w-full overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 ${className}`}>
            <div className={`h-2 bg-gradient-to-r ${trimesterInfo.color}`}></div>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                            <span>妊娠 {pregnancyWeek}週目</span>
                            <Badge variant="outline" className={`${trimesterInfo.textColor} ${trimesterInfo.bgColor} border-none`}>
                                {trimesterInfo.name}
                            </Badge>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                            <CalendarIcon className="h-4 w-4" />
                            <span>出産予定日: {format(dueDate, 'yyyy年MM月dd日')} (あと{daysRemaining}日)</span>
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-5">
                    {/* 妊娠進捗バー */}
                    <div className="relative pt-6 pb-2">
                        <div className="absolute top-0 left-0 right-0 flex justify-between text-xs text-gray-500">
                            {WEEK_MARKERS.map((marker) => (
                                <TooltipProvider key={marker.week}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div
                                                className="flex flex-col items-center"
                                                style={{
                                                    position: 'absolute',
                                                    left: `${(marker.week / 40) * 100}%`,
                                                    transform: 'translateX(-50%)'
                                                }}
                                            >
                                                <div className={`w-1 h-2 ${marker.week === 0 ? 'bg-gray-300' : marker.week === 13 ? 'bg-rose-400' : marker.week === 27 ? 'bg-indigo-400' : 'bg-emerald-400'}`}></div>
                                                <span className="mt-1">{marker.label}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {marker.week === 0 ? '妊娠開始' :
                                                marker.week === 13 ? '第1期終了' :
                                                    marker.week === 27 ? '第2期終了' :
                                                        '出産予定日'}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                        </div>
                        <Progress
                            value={progressPercentage}
                            className="h-4 mt-6 bg-gray-100"
                            indicatorClassName={`bg-gradient-to-r ${trimesterInfo.color}`}
                        />
                        <motion.div
                            className="absolute"
                            style={{
                                left: `${progressPercentage}%`,
                                top: '1.5rem',
                                transform: 'translateX(-50%)'
                            }}
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{
                                repeat: Infinity,
                                repeatType: "reverse",
                                duration: 1.5
                            }}
                        >
                            <div className="text-2xl">{babyInfo.icon}</div>
                        </motion.div>
                    </div>

                    {/* 赤ちゃん情報カード */}
                    <motion.div
                        className={`p-4 rounded-lg border ${trimesterInfo.borderColor} ${trimesterInfo.bgColor}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`w-16 h-16 flex items-center justify-center text-4xl bg-white rounded-full shadow-sm border ${trimesterInfo.borderColor}`}>
                                {babyInfo.icon}
                            </div>
                            <div className="flex-1">
                                <div className={`font-semibold ${trimesterInfo.textColor} mb-1`}>赤ちゃんの大きさ</div>
                                <div className={`${trimesterInfo.textColor} font-medium`}>{babyInfo.size}</div>
                                <div className={`mt-1 text-sm ${trimesterInfo.textColor} opacity-90`}>{babyInfo.description}</div>
                            </div>
                        </div>
                    </motion.div>

                    {/* 今週のポイント */}
                    <motion.div
                        className={`p-4 rounded-lg border ${trimesterInfo.borderColor} ${trimesterInfo.bgColor}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <div className={`font-semibold ${trimesterInfo.textColor} mb-1`}>今週のポイント</div>
                        <div className={`text-sm ${trimesterInfo.textColor} opacity-90`}>{trimesterInfo.description}</div>
                    </motion.div>
                </div>
            </CardContent>
        </Card>
    );
} 