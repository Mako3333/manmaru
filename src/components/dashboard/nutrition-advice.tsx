'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NutritionAdvice } from '@/types/nutrition';
import { AdviceType } from '@/types/nutrition';

interface NutritionAdviceProps {
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

export default function NutritionAdvice({ date, className }: NutritionAdviceProps) {
    const [advices, setAdvices] = useState<NutritionAdvice[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClientComponentClient();

    useEffect(() => {
        const fetchAdvices = async () => {
            try {
                setLoading(true);

                // セッションの有効性を確認
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setError('ログインが必要です。再度ログインしてください。');
                    setLoading(false);
                    return;
                }

                const { data, error: fetchError } = await supabase
                    .from('daily_nutri_advice')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('advice_date', date)
                    .order('created_at', { ascending: false });

                if (fetchError) throw fetchError;

                setAdvices(data || []);
            } catch (err) {
                console.error('栄養アドバイス取得エラー:', err);
                setError('栄養アドバイスの取得に失敗しました');
            } finally {
                setLoading(false);
            }
        };

        fetchAdvices();
    }, [date, supabase]);

    return (
        <Card className={`w-full ${className}`}>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg sm:text-xl font-bold">栄養アドバイス</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                ) : error ? (
                    <div className="text-center text-red-500 py-8">{error}</div>
                ) : advices.length > 0 ? (
                    <div className="space-y-4">
                        {advices.map((advice) => (
                            <div
                                key={advice.id}
                                className="p-4 rounded-lg border bg-indigo-50 text-indigo-800 border-indigo-200"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="text-2xl">
                                        {ADVICE_TYPE_INFO[advice.advice_type]?.icon || '📋'}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm sm:text-base mb-1">
                                            {ADVICE_TYPE_INFO[advice.advice_type]?.title || 'アドバイス'}
                                        </h3>
                                        <p className="text-sm">{advice.advice_content}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 rounded-lg border bg-indigo-50 text-indigo-800 border-indigo-200">
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">{ADVICE_TYPE_INFO[DEFAULT_ADVICE.type].icon}</div>
                            <div>
                                <h3 className="font-semibold text-sm sm:text-base mb-1">{ADVICE_TYPE_INFO[DEFAULT_ADVICE.type].title}</h3>
                                <p className="text-sm">{DEFAULT_ADVICE.content}</p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
} 