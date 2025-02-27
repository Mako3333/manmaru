'use client'

import { useState, useEffect, FormEvent } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MealTypeSelector, type MealType } from '@/components/meals/meal-type-selector'
import { MealPhotoInput } from '@/components/meals/meal-photo-input'
import { RecognitionEditor } from '@/components/meals/recognition-editor'
import { analyzeMealPhoto } from '@/lib/api'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Camera, Type, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// 入力モードの型定義
type InputMode = 'photo' | 'text';

// 食品アイテムの型定義
interface FoodItem {
    id: string;
    name: string;
    quantity: string;
    confidence: number;
}

// 初期の栄養情報
const initialNutrition = {
    calories: 0,
    protein: 0,
    iron: 0,
    folic_acid: 0,
    calcium: 0,
    confidence_score: 0
};

export default function MealLogPage() {
    const [profile, setProfile] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)
    const [mealType, setMealType] = useState<MealType>('breakfast')

    // 入力モード状態
    const [inputMode, setInputMode] = useState<InputMode>('photo')

    // 画像解析関連の状態
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [base64Image, setBase64Image] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [recognitionData, setRecognitionData] = useState<any | null>(null)

    // テキスト入力関連の状態
    const [foodItems, setFoodItems] = useState<FoodItem[]>([])
    const [newFoodName, setNewFoodName] = useState('')
    const [newFoodQuantity, setNewFoodQuantity] = useState('')
    const [nameError, setNameError] = useState('')

    // 保存関連の状態
    const [saving, setSaving] = useState(false)

    const router = useRouter()
    const supabase = createClientComponentClient()

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return

                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .single()

                if (error) throw error
                setProfile(data)
            } catch (error) {
                console.error('Error fetching profile:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchProfile()
    }, [])

    // 写真が選択されたときの処理
    const handlePhotoCapture = async (file: File, base64: string) => {
        setSelectedFile(file);
        setBase64Image(base64);

        // 画像解析を開始
        await analyzePhoto(base64);
    };

    // 画像解析処理
    const analyzePhoto = async (base64Image: string) => {
        setAnalyzing(true);
        setRecognitionData(null);

        try {
            // 画像解析APIを呼び出し
            const result = await analyzeMealPhoto(base64Image, mealType);
            setRecognitionData(result);
        } catch (error) {
            console.error('画像解析エラー:', error);
            toast.error('画像の解析に失敗しました。もう一度お試しください。');
        } finally {
            setAnalyzing(false);
        }
    };

    // 編集結果の保存処理
    const handleSaveRecognition = async (data: any) => {
        setSaving(true);

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                toast.error('ログインセッションが無効です。再ログインしてください。');
                return;
            }

            // 食事データを保存
            const { error } = await supabase
                .from('meals')
                .insert({
                    user_id: session.user.id,
                    meal_type: mealType,
                    food_description: {
                        items: data.foods
                    },
                    nutrition_data: data.nutrition,
                    image_url: base64Image // 実際のプロダクションでは画像はストレージに保存し、URLを参照するべき
                });

            if (error) throw error;

            // 成功メッセージを表示
            toast.success('食事を記録しました！');

            // ホームページにリダイレクト
            router.push('/home');
        } catch (error) {
            console.error('食事保存エラー:', error);
            toast.error('食事の記録に失敗しました。もう一度お試しください。');
        } finally {
            setSaving(false);
        }
    };

    // テキスト入力の食品を追加
    const addFoodItem = (e: FormEvent) => {
        e.preventDefault();

        // バリデーション
        if (!newFoodName.trim()) {
            setNameError('食品名を入力してください');
            return;
        }

        // 新しい食品アイテムを作成
        const newItem: FoodItem = {
            id: crypto.randomUUID(),
            name: newFoodName.trim(),
            quantity: newFoodQuantity.trim() || '1人前',
            confidence: 1.0
        };

        // 食品リストに追加
        setFoodItems(prev => [...prev, newItem]);

        // フォームをリセット
        setNewFoodName('');
        setNewFoodQuantity('');
        setNameError('');
    };

    // 食品アイテムを削除
    const removeFoodItem = (id: string) => {
        setFoodItems(prev => prev.filter(item => item.id !== id));
    };

    // テキスト入力の食品を更新
    const updateFoodItem = (id: string, field: keyof FoodItem, value: string) => {
        setFoodItems(prev =>
            prev.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
    };

    // テキスト入力の保存処理
    const handleSaveTextInput = async () => {
        // バリデーション
        if (foodItems.length === 0) {
            toast.error('少なくとも1つの食品を追加してください');
            return;
        }

        setSaving(true);

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                toast.error('ログインセッションが無効です。再ログインしてください。');
                return;
            }

            // APIに送信するデータ形式に変換（IDを除外）
            const foodsData = foodItems.map(({ id, ...rest }) => rest);

            // 食事データを保存
            const { error } = await supabase
                .from('meals')
                .insert({
                    user_id: session.user.id,
                    meal_type: mealType,
                    food_description: {
                        items: foodsData
                    },
                    nutrition_data: initialNutrition, // テキスト入力では栄養情報は計算されない
                });

            if (error) throw error;

            // 成功メッセージを表示
            toast.success('食事を記録しました！');

            // ホームページにリダイレクト
            router.push('/home');
        } catch (error) {
            console.error('食事保存エラー:', error);
            toast.error('食事の記録に失敗しました。もう一度お試しください。');
        } finally {
            setSaving(false);
        }
    };

    // 食事タイプが変更されたときに画像解析をリセット
    useEffect(() => {
        if (base64Image && recognitionData && inputMode === 'photo') {
            // 食事タイプが変更されたら再解析
            analyzePhoto(base64Image);
        }
    }, [mealType]);

    // 入力モードが変更されたときの処理
    const handleInputModeChange = (mode: InputMode) => {
        setInputMode(mode);

        // 写真モードからテキストモードに切り替えたとき、認識結果があれば食品リストに変換
        if (mode === 'text' && recognitionData && recognitionData.foods.length > 0) {
            const foodsWithIds = recognitionData.foods.map((food: any) => ({
                ...food,
                id: crypto.randomUUID()
            }));
            setFoodItems(foodsWithIds);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-zinc-600">読み込み中...</p>
            </div>
        )
    }

    if (!profile) {
        router.push('/profile')
        return null
    }

    return (
        <div className="container mx-auto px-4 py-6 max-w-3xl">
            <h1 className="text-2xl font-bold mb-6 text-green-600">食事を記録</h1>

            <div className="space-y-6">
                {/* 食事タイプ選択 */}
                <Card className="border-green-100 shadow-sm">
                    <CardContent className="pt-6">
                        <MealTypeSelector
                            selected={mealType}
                            onChange={setMealType}
                        />
                    </CardContent>
                </Card>

                {/* 入力モード切替 */}
                <div className="flex rounded-lg overflow-hidden border">
                    <button
                        onClick={() => handleInputModeChange('photo')}
                        className={cn(
                            "flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-colors",
                            inputMode === 'photo'
                                ? "bg-green-600 text-white font-medium"
                                : "bg-white hover:bg-green-50 text-gray-700"
                        )}
                    >
                        <Camera className="h-5 w-5" />
                        <span>写真で記録</span>
                    </button>
                    <button
                        onClick={() => handleInputModeChange('text')}
                        className={cn(
                            "flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-colors",
                            inputMode === 'text'
                                ? "bg-green-600 text-white font-medium"
                                : "bg-white hover:bg-green-50 text-gray-700"
                        )}
                    >
                        <Type className="h-5 w-5" />
                        <span>テキストで入力</span>
                    </button>
                </div>

                {/* 写真入力モード */}
                {inputMode === 'photo' && (
                    <>
                        {/* 写真入力 */}
                        <Card className="border-green-100 shadow-sm">
                            <CardContent className="pt-6">
                                <MealPhotoInput
                                    onPhotoCapture={handlePhotoCapture}
                                    isLoading={analyzing}
                                />
                            </CardContent>
                        </Card>

                        {/* 解析中の表示 */}
                        {analyzing && (
                            <Card className="border-green-100 shadow-sm">
                                <CardContent className="py-8">
                                    <div className="flex flex-col items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-green-600 mb-2" />
                                        <p className="text-muted-foreground">画像を解析中...</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* 認識結果エディタ */}
                        {!analyzing && recognitionData && (
                            <RecognitionEditor
                                initialData={recognitionData}
                                onSave={handleSaveRecognition}
                                mealType={mealType}
                            />
                        )}

                        {/* 初期状態のガイダンス */}
                        {!analyzing && !recognitionData && !base64Image && (
                            <Card className="border-green-100 shadow-sm">
                                <CardContent className="py-6">
                                    <div className="text-center text-muted-foreground">
                                        <p>食事の写真を撮影または選択してください。</p>
                                        <p className="text-sm mt-2">AIが自動で食品を認識します。</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}

                {/* テキスト入力モード */}
                {inputMode === 'text' && (
                    <Card className="border-green-100 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-green-700">食事内容を入力</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* 食品入力フォーム */}
                            <form onSubmit={addFoodItem} className="space-y-4">
                                <div className="grid grid-cols-12 gap-3">
                                    <div className="col-span-7 space-y-1">
                                        <Label htmlFor="food-name" className="text-sm font-medium">
                                            食品名
                                        </Label>
                                        <Input
                                            id="food-name"
                                            value={newFoodName}
                                            onChange={(e) => {
                                                setNewFoodName(e.target.value);
                                                if (e.target.value.trim()) setNameError('');
                                            }}
                                            placeholder="例: ご飯、サラダ、味噌汁"
                                            className={nameError ? "border-red-500" : ""}
                                        />
                                        {nameError && (
                                            <p className="text-xs text-red-500">{nameError}</p>
                                        )}
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <Label htmlFor="food-quantity" className="text-sm font-medium">
                                            量
                                        </Label>
                                        <Input
                                            id="food-quantity"
                                            value={newFoodQuantity}
                                            onChange={(e) => setNewFoodQuantity(e.target.value)}
                                            placeholder="例: 1杯"
                                        />
                                    </div>
                                    <div className="col-span-2 flex items-end">
                                        <Button
                                            type="submit"
                                            className="w-full bg-green-600 hover:bg-green-700"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            </form>

                            {/* 食品リスト */}
                            <div className="space-y-3">
                                <h3 className="text-base font-medium text-gray-700">食品リスト</h3>

                                {foodItems.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-2">
                                        食品が追加されていません。上のフォームから食品を追加してください。
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {foodItems.map((item) => (
                                            <div key={item.id} className="flex items-center gap-2 p-3 rounded-md border border-gray-200 bg-white">
                                                <div className="flex-1">
                                                    <Input
                                                        value={item.name}
                                                        onChange={(e) => updateFoodItem(item.id, 'name', e.target.value)}
                                                        className="border-none shadow-none focus-visible:ring-0 p-0 h-auto text-base"
                                                    />
                                                </div>
                                                <div className="w-1/4">
                                                    <Input
                                                        value={item.quantity}
                                                        onChange={(e) => updateFoodItem(item.id, 'quantity', e.target.value)}
                                                        className="border-none shadow-none focus-visible:ring-0 p-0 h-auto text-sm text-gray-500"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeFoodItem(item.id)}
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 保存ボタン */}
                            <Button
                                onClick={handleSaveTextInput}
                                disabled={foodItems.length === 0 || saving}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 mt-4"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        保存中...
                                    </>
                                ) : (
                                    '記録を保存する'
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
} 