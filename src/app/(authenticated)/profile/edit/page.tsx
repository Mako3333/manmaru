'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DietaryRestriction, UserProfile, ProfileUpdateData } from '@/types/user' // ProfileUpdateData をインポート
import { calculatePregnancyWeek } from '@/lib/date-utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InfoIcon } from 'lucide-react'
import { toast } from 'sonner'; // Sonner を使用する場合

// 食事制限の日本語表示マッピング (profile/page.tsx と同じ)
const dietaryRestrictionLabels: Record<string, string> = {
    'vegetarian': 'ベジタリアン',
    'vegan': 'ビーガン',
    'gluten_free': 'グルテンフリー',
    'dairy_free': '乳製品不使用',
    'nut_allergy': 'ナッツアレルギー',
    'seafood_allergy': '魚介アレルギー',
    'egg_allergy': '卵アレルギー',
    'soy_allergy': '大豆アレルギー',
    'low_sodium': '減塩食',
    'diabetic': '糖尿病食'
};

// フォームデータの型を定義
type ProfileEditFormData = {
    age: number;
    height: number;
    weight: number;
    adult_family_members: number;
    child_family_members: number;
    due_date: string | null;
    dietary_restrictions: string[] | null;
};


export default function ProfileEditPage() {
    const [loading, setLoading] = useState(true); // 初期ロード状態
    const [saving, setSaving] = useState(false); // 保存中状態
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<ProfileEditFormData>({
        age: 0,
        height: 0,
        weight: 0, // 妊娠前体重 or 現在体重かは要検討 (現状は `profiles` にある weight を使う)
        adult_family_members: 1,
        child_family_members: 0,
        due_date: null,
        dietary_restrictions: null
    });
    const router = useRouter();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // --- データ取得 ---
    const fetchProfile = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('セッションが見つかりません');
            }

            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single<UserProfile>(); // 型を指定

            if (fetchError) throw fetchError;

            if (data) {
                // DB の due_date (timestampz) を yyyy-MM-dd 形式の文字列に変換
                const formattedDueDate = data.due_date ? data.due_date.split('T')[0] : null;
                setFormData({
                    age: data.age,
                    height: data.height,
                    weight: data.weight,
                    adult_family_members: data.adult_family_members,
                    child_family_members: data.child_family_members,
                    due_date: formattedDueDate || null,
                    dietary_restrictions: data.dietary_restrictions || []
                });
            } else {
                // プロファイルがない場合は新規登録ページへリダイレクト？
                // またはエラー表示
                console.warn("プロフィールが見つかりません。新規登録ページにリダイレクトします。");
                router.push('/profile');
            }
        } catch (err) {
            console.error('Profile fetch error:', err);
            setError(err instanceof Error ? err.message : 'プロフィールの読み込みに失敗しました');
            toast.error('プロフィールの読み込みに失敗しました。'); // Sonner
        } finally {
            setLoading(false);
        }
    }, [supabase, router]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    // --- フォームハンドラー ---
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value
        }));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value || null
        }));
    };

    const handleDietaryRestrictionChange = (value: DietaryRestriction, checked: boolean) => {
        setFormData(prev => {
            const currentRestrictions = prev.dietary_restrictions || [];
            let updatedRestrictions;

            if (checked) {
                updatedRestrictions = [...currentRestrictions, value];
            } else {
                updatedRestrictions = currentRestrictions.filter(item => item !== value);
            }
            // null ではなく空配列 [] にする
            return {
                ...prev,
                dietary_restrictions: updatedRestrictions.length > 0 ? updatedRestrictions : []
            };
        });
    };


    // 出産予定日から妊娠週数を計算する表示用関数
    const getCurrentPregnancyWeek = (): number => {
        if (!formData.due_date) return 0;
        return calculatePregnancyWeek(formData.due_date).week;
    };

    // --- データ保存 ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        // バリデーション (API 側と重複するがUX向上のためクライアントでも行う)
        if (formData.age < 15 || formData.age > 60) {
            setError('年齢は15歳から60歳の間で入力してください');
            setSaving(false);
            return;
        }
        if (formData.height < 130 || formData.height > 200) {
            setError('身長は130cmから200cmの間で入力してください');
            setSaving(false);
            return;
        }
        if (formData.weight < 30 || formData.weight > 150) {
            setError('体重は30kgから150kgの間で入力してください');
            setSaving(false);
            return;
        }

        // 更新データのみを抽出 (ProfileUpdateData に合わせて不要なキーを除外)
        const updatePayload: ProfileUpdateData = {};
        if (formData.age !== undefined) updatePayload.age = formData.age;
        if (formData.height !== undefined) updatePayload.height = formData.height;
        if (formData.weight !== undefined) updatePayload.weight = formData.weight;
        if (formData.due_date !== undefined) updatePayload.due_date = formData.due_date; // null も含む
        if (formData.dietary_restrictions !== undefined) updatePayload.dietary_restrictions = formData.dietary_restrictions; // null も含む
        if (formData.adult_family_members !== undefined) updatePayload.adult_family_members = formData.adult_family_members;
        if (formData.child_family_members !== undefined) updatePayload.child_family_members = formData.child_family_members;


        try {
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatePayload),
            });

            const result = await response.json();

            if (!response.ok) {
                // API からのエラーメッセージを表示
                throw new Error(result.userMessage || result.message || 'プロフィールの更新に失敗しました');
            }

            toast.success('プロフィールが更新されました！'); // Sonner
            // 更新成功後、設定ページなどに戻る
            router.push('/settings'); // または '/dashboard' など

        } catch (err) {
            console.error('Profile update error:', err);
            const errorMessage = err instanceof Error ? err.message : '予期せぬエラーが発生しました';
            setError(errorMessage);
            toast.error(`更新失敗: ${errorMessage}`); // Sonner
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-zinc-600">プロフィール情報を読み込み中...</p>
            </div>
        );
    }

    // --- レンダリング ---
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
            <Card className="w-full max-w-2xl shadow-lg border-green-100">
                <CardHeader>
                    <h1 className="text-3xl font-bold text-center text-green-700">プロフィール編集</h1>
                    <p className="text-sm text-center text-muted-foreground mt-2">
                        登録情報を更新してください
                    </p>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
                                {error}
                            </div>
                        )}

                        {/* フォームフィールド (profile/page.tsx を参考に、value と onChange を設定) */}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            {/* 年齢 */}
                            <div className="space-y-2">
                                <Label htmlFor="age">年齢</Label>
                                <div className="relative">
                                    <Input
                                        id="age"
                                        name="age"
                                        type="number"
                                        value={formData.age === 0 ? '' : formData.age}
                                        onChange={handleChange}
                                        required
                                        min="15"
                                        max="60"
                                        className="pr-8"
                                        placeholder="30"
                                    />
                                    <span className="absolute right-3 top-2 text-zinc-500">歳</span>
                                </div>
                            </div>

                            {/* 出産予定日 */}
                            <div className="space-y-2">
                                <Label htmlFor="due_date">出産予定日</Label>
                                <Input
                                    id="due_date"
                                    name="due_date"
                                    type="date"
                                    value={formData.due_date || ''}
                                    onChange={handleDateChange}
                                    placeholder="2024-12-31"
                                />
                            </div>

                            {/* 妊娠週数 (表示のみ) */}
                            {formData.due_date ? (
                                <div className="space-y-2 sm:col-span-2"> {/* 横幅いっぱいに */}
                                    <Label>妊娠週数（自動計算）</Label>
                                    <Alert className="bg-green-50 border-green-200">
                                        <InfoIcon className="h-4 w-4 text-green-600" />
                                        <AlertDescription className="text-green-700">
                                            現在の妊娠週数: <strong>{getCurrentPregnancyWeek()}週</strong>
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            ) : null}

                            {/* 身長 */}
                            <div className="space-y-2">
                                <Label htmlFor="height">身長</Label>
                                <div className="relative">
                                    <Input
                                        id="height"
                                        name="height"
                                        type="number"
                                        value={formData.height === 0 ? '' : formData.height}
                                        onChange={handleChange}
                                        required
                                        min="130"
                                        max="200"
                                        step="0.1"
                                        className="pr-8"
                                        placeholder="160"
                                    />
                                    <span className="absolute right-3 top-2 text-zinc-500">cm</span>
                                </div>
                            </div>

                            {/* 体重 */}
                            <div className="space-y-2">
                                <Label htmlFor="weight">体重</Label>
                                <div className="relative">
                                    <Input
                                        id="weight"
                                        name="weight"
                                        type="number"
                                        value={formData.weight === 0 ? '' : formData.weight}
                                        onChange={handleChange}
                                        required
                                        min="30"
                                        max="150"
                                        step="0.1"
                                        className="pr-8"
                                        placeholder="55"
                                    />
                                    <span className="absolute right-3 top-2 text-zinc-500">kg</span>
                                </div>
                            </div>

                            {/* 同居の大人 */}
                            <div className="space-y-2">
                                <Label htmlFor="adult_family_members">同居の大人の人数</Label>
                                <Input
                                    id="adult_family_members"
                                    name="adult_family_members"
                                    type="number"
                                    value={formData.adult_family_members}
                                    onChange={handleChange}
                                    required
                                    min="1"
                                    max="10"
                                    placeholder="1"
                                />
                            </div>

                            {/* 同居の子ども */}
                            <div className="space-y-2">
                                <Label htmlFor="child_family_members">同居の子どもの人数</Label>
                                <Input
                                    id="child_family_members"
                                    name="child_family_members"
                                    type="number"
                                    value={formData.child_family_members}
                                    onChange={handleChange}
                                    required
                                    min="0"
                                    max="10"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* 食事制限 */}
                        <div className="space-y-2">
                            <Label>食事制限</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(DietaryRestriction).map(([key, value]) => (
                                    <div key={value} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`restriction-${value}`}
                                            checked={(formData.dietary_restrictions || []).includes(value)}
                                            onCheckedChange={(checked) =>
                                                handleDietaryRestrictionChange(value, checked === true)
                                            }
                                        />
                                        <label
                                            htmlFor={`restriction-${value}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            {dietaryRestrictionLabels[value] || key}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4">
                        <Button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={saving || loading}
                        >
                            {saving ? '保存中...' : '変更を保存'}
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => router.back()} // キャンセルして戻る
                            disabled={saving}
                        >
                            キャンセル
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
