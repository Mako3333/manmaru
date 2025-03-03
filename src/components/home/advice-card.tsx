import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NutritionAdvice } from '@/types/nutrition';
import { AdviceType } from '@/types/nutrition';

interface AdviceCardProps {
    date: string;
    className?: string;
}

// アドバイスタイプごとの表示情報
const ADVICE_TYPE_INFO: Record<string, { title: string; icon: string; }> = {
    [AdviceType.IRON_DEFICIENCY]: { title: '鉄分不足', icon: '⚙️' },
    [AdviceType.FOLIC_ACID_REMINDER]: { title: '葉酸摂取', icon: '🍃' },
    [AdviceType.CALCIUM_RECOMMENDATION]: { title: 'カルシウム摂取', icon: '🥛' },
    [AdviceType.PROTEIN_INTAKE]: { title: 'タンパク質摂取', icon: '🥩' },
    [AdviceType.VITAMIN_D_SUGGESTION]: { title: 'ビタミンD補給', icon: '☀️' },
    [AdviceType.CALORIE_BALANCE]: { title: 'カロリーバランス', icon: '🔥' },
    [AdviceType.GENERAL_NUTRITION]: { title: '栄養バランス', icon: '📝' }
};

// デフォルトのアドバイス（データがない場合に表示）
const DEFAULT_ADVICE = {
    type: AdviceType.GENERAL_NUTRITION,
    content: '毎日バランスの良い食事を心がけましょう。特に妊娠中は鉄分、葉酸、カルシウム、タンパク質の摂取が重要です。'
};

export const AdviceCard: React.FC<AdviceCardProps> = ({ date, className = '' }) => {
    const [advice, setAdvice] = useState<NutritionAdvice | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const supabase = createClientComponentClient();

    useEffect(() => {
        const fetchAdvice = async () => {
            try {
                setLoading(true);

                // セッションの有効性を確認
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setLoading(false);
                    return;
                }

                const { data, error: fetchError } = await supabase
                    .from('daily_nutri_advice')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('advice_date', date)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    throw fetchError;
                }

                setAdvice(data || null);
            } catch (err) {
                console.error('栄養アドバイス取得エラー:', err);
            } finally {
                setLoading(false);
            }
        };

        if (date) {
            fetchAdvice();
        }
    }, [date, supabase]);

    // 表示するアドバイス情報
    const displayAdvice = advice || {
        id: 'default',
        advice_type: DEFAULT_ADVICE.type,
        advice_content: DEFAULT_ADVICE.content
    };

    const adviceInfo = ADVICE_TYPE_INFO[displayAdvice.advice_type] ||
        { title: 'アドバイス', icon: '📝' };

    return (
        <Card className={`w-full ${className}`}>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center">
                    <span className="mr-2 text-xl">{adviceInfo.icon}</span>
                    今日のアドバイス
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-16">
                        <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                ) : (
                    <div className="p-3 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">
                        <h3 className="font-semibold text-sm mb-1">{adviceInfo.title}</h3>
                        <p className="text-sm">{displayAdvice.advice_content}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}; 