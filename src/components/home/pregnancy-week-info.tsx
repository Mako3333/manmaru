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
import { calculatePregnancyWeek, getTrimesterNumber } from '@/lib/date-utils';

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

                    // 共通関数を使用して妊娠週数を計算
                    const week = calculatePregnancyWeek(data.due_date);
                    setPregnancyWeek(week);
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

    // 現在のトライメスターを判定（共通関数を使用）
    const getCurrentTrimester = (week: number) => {
        return getTrimesterNumber(week);
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
        <Card className={`w-full overflow-hidden bg-[#F8FAFA] relative pb-3 max-w-sm mx-auto shadow-sm ${className}`}>
            <div className="absolute bottom-[-60px] right-[-60px] w-[120px] h-[120px] bg-[rgba(46,158,108,0.08)] rounded-full z-0"></div>
            <CardHeader className="pb-2 relative z-10 px-4 pt-4">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="inline-block px-3 py-0.5 bg-[#2E9E6C] text-white font-medium text-[13px] rounded-[20px] shadow-[0_1px_3px_rgba(46,158,108,0.15)]">
                                妊娠 {pregnancyWeek}週目
                            </span>
                            <span className="text-[13px] text-gray-600 font-medium">
                                {trimesterInfo.name}
                            </span>
                        </div>
                        <CardDescription className="text-[12px] text-[#6C7A7D]">
                            <span>出産予定日: {format(dueDate, 'yyyy年MM月dd日')} (あと{daysRemaining}日)</span>
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="relative z-10 px-4 pt-0">
                <div className="space-y-3">
                    <div className="relative pb-1">
                        {/* マイルストーンマーカー */}
                        <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                            <span style={{ marginLeft: '-2px' }}>{WEEK_MARKERS[0].label}</span>
                            <span style={{ position: 'absolute', left: '32.5%', transform: 'translateX(-50%)' }}>{WEEK_MARKERS[1].label}</span>
                            <span style={{ position: 'absolute', left: '67.5%', transform: 'translateX(-50%)' }}>{WEEK_MARKERS[2].label}</span>
                            <span style={{ marginRight: '-2px' }}>{WEEK_MARKERS[3].label}</span>
                        </div>

                        {/* プログレスバー */}
                        <div className="h-4 bg-[rgba(46,158,108,0.15)] rounded-full relative">
                            {/* マーカーの点 */}
                            {WEEK_MARKERS.map((marker) => (
                                <div
                                    key={`dot-${marker.week}`}
                                    className={`absolute w-0.5 h-4 ${marker.week === 0 ? 'bg-gray-300' :
                                        marker.week === 13 ? 'bg-rose-400' :
                                            marker.week === 27 ? 'bg-indigo-400' :
                                                'bg-emerald-400'
                                        }`}
                                    style={{
                                        left: `${(marker.week / 40) * 100}%`,
                                        top: '0',
                                        transform: 'translateX(-50%)',
                                        zIndex: 10
                                    }}
                                ></div>
                            ))}

                            {/* プログレスバー本体 */}
                            <div
                                className="h-full bg-gradient-to-r from-[#2E9E6C] to-[#237D54] rounded-full"
                                style={{
                                    width: `${progressPercentage}%`,
                                    zIndex: 5,
                                    position: 'relative'
                                }}
                            ></div>

                            {/* つまみ */}
                            <div
                                className="absolute flex items-center justify-center w-6 h-6 bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.15)] border-[1.5px] border-[#2E9E6C] z-20"
                                style={{
                                    left: `${progressPercentage}%`,
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)'
                                }}
                            >
                                <motion.span
                                    className="text-sm"
                                    animate={{
                                        rotate: [0, 10, 0, -10, 0],
                                        scale: [1, 1.1, 1, 1.1, 1]
                                    }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: 2,
                                        ease: "easeInOut"
                                    }}
                                >
                                    {babyInfo.icon}
                                </motion.span>
                            </div>
                        </div>
                    </div>

                    <motion.div
                        className="p-3 rounded-xl bg-[#E0F7FA]/20 backdrop-blur-sm shadow-sm"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 flex items-center justify-center text-2xl bg-white rounded-full shadow-sm">
                                {babyInfo.icon}
                            </div>
                            <div className="flex-1">
                                <div className="font-medium text-[#0276aa] mb-0.5 text-[14px]">赤ちゃんの大きさ</div>
                                <div className="text-[#0276aa] font-medium text-[13px]">{babyInfo.size}</div>
                                <div className="mt-0.5 text-[11px] text-[#0276aa] leading-relaxed">{babyInfo.description}</div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </CardContent>
        </Card>
    );
} 