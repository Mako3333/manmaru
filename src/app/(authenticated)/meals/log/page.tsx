'use client'
// ライブラリのインポート
import { useState, useEffect, FormEvent } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

// UIコンポーネントのインポート
import { Button } from '@/components/ui/button'
import { MealTypeSelector, type MealType } from '@/components/meals/meal-type-selector'
import { MealPhotoInput } from '@/components/meals/meal-photo-input'
import { RecognitionEditor } from '@/components/meals/recognition-editor'
import { analyzeMealPhoto, analyzeTextInput } from '@/lib/api'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Camera, Type, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AppError } from '@/lib/error'
import {
    normalizeNutritionData,
    validateMealData,
    prepareForApiRequest,
    convertToStandardizedNutrition
} from '@/lib/nutrition/nutrition-utils';
import { StandardizedMealData, StandardizedMealNutrition, Nutrient } from '@/types/nutrition';


// 入力モードの型定義
type InputMode = 'photo' | 'text';

// 食品アイテムの型定義
interface FoodItem {
    id: string;
    name: string;
    quantity: string;
    confidence: number;
}

// 栄養情報の型定義 - レガシーAPIとの互換性のため一時的に保持
interface LegacyNutritionData {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d?: number;
    confidence_score: number;
}

// 解析結果の食品アイテム型
interface RecognitionFoodItem {
    name: string;
    quantity: string;
    confidence: number;
}

// 認識データの型定義 (RecognitionEditorコンポーネントと互換性のある形式)
interface RecognitionData {
    foods: RecognitionFoodItem[];
    nutrition: LegacyNutritionData;
}

// APIからのレスポンスデータのラッパー型
interface ApiRecognitionResponse {
    data: {
        foods: RecognitionFoodItem[];
    };
    nutrition: LegacyNutritionData;
}

// 初期の栄養情報
const initialNutrition: LegacyNutritionData = {
    calories: 0,
    protein: 0,
    iron: 0,
    folic_acid: 0,
    calcium: 0,
    confidence_score: 0
};

export default function MealLogPage() {
    // ユーザープロフィール関連の状態
    const [profile, setProfile] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)

    // 食事タイプの状態(朝食・昼食・夕食・間食)
    const [mealType, setMealType] = useState<MealType>('breakfast')

    // 日付の状態
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())

    // 入力モードの状態(写真モード・テキストモード)
    const [inputMode, setInputMode] = useState<InputMode>('photo')

    // 画像解析関連の状態
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [base64Image, setBase64Image] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [recognitionData, setRecognitionData] = useState<RecognitionData | null>(null)

    // テキスト入力関連の状態
    const [foodItems, setFoodItems] = useState<FoodItem[]>([])
    const [newFoodName, setNewFoodName] = useState('')
    const [newFoodQuantity, setNewFoodQuantity] = useState('')
    const [nameError, setNameError] = useState('')

    // 保存関連の状態
    const [saving, setSaving] = useState(false)

    // ルーティング関連
    const router = useRouter()
    const supabase = createClientComponentClient()

    // ユーザープロフィールの取得
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                // セッションの取得
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return

                // ユーザープロフィールの取得
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .single()

                if (error) throw error
                setProfile(data)// プロフィールデータをセット
            } catch (error) {
                console.error('Error fetching profile:', error)
            } finally {
                setLoading(false)// ローディングを終了
            }
        }

        fetchProfile()
    }, [])//

    // 写真が選択されたときの処理
    const handlePhotoCapture = async (file: File, base64: string) => {
        setSelectedFile(file);
        setBase64Image(base64);

        // 画像解析を開始
        await analyzePhoto(base64);
    };

    // 画像解析処理
    const analyzePhoto = async (base64Image: string) => {
        console.log('analyzePhoto開始: データ長', base64Image.length);
        setAnalyzing(true);
        setRecognitionData(null);

        try {
            if (!base64Image || base64Image.length === 0) {
                throw new DataProcessingError(
                    '画像データが不足しています',
                    '食事画像',
                    ErrorCode.DATA_VALIDATION_ERROR,
                    { imageLength: base64Image?.length || 0 },
                    ['写真を再度撮影してください']
                );
            }

            console.log('mealType:', mealType);

            // 新APIを使用
            const result = await analyzeMealPhoto(base64Image, mealType);

            console.log('API応答:', result);

            // データの存在を確認
            if (!result.success || !result.data || !result.data.foods || !Array.isArray(result.data.foods)) {
                throw new AiAnalysisError(
                    'AI応答データの形式が不正です',
                    '解析結果が正しくありません',
                    ErrorCode.API_RESPONSE_INVALID,
                    { response: result },
                    ['別の画像を試してください', '手動での食品入力も可能です']
                );
            }

            // 英語の食品名を検出して警告
            const hasEnglishFoodNames = result.data.foods.some((food: RecognitionFoodItem) =>
                /^[a-zA-Z]/.test(food.name) || (food.quantity && typeof food.quantity === 'string' && /^[0-9]+ [a-z]+/.test(food.quantity))
            );

            if (hasEnglishFoodNames) {
                console.warn('英語の食品名が検出されました:', result.data.foods);
                // 警告トーストを表示
                toast.warning('英語の食品名が検出されました', {
                    description: '手動で日本語に修正することをお勧めします',
                });
            }

            // APIレスポンスを認識データの形式に変換
            const formattedData: RecognitionData = {
                foods: result.data.foods,
                nutrition: result.data.nutrition
            };

            setRecognitionData(formattedData);

            // 成功通知
            toast.success('食事画像の分析が完了しました', {
                description: '認識結果を確認・編集してください',
            });
        } catch (error) {
            // 標準化されたエラーハンドリング
            handleError(error, {
                showToast: true,
                toastOptions: {
                    title: '画像解析に失敗しました',
                    description: error instanceof AppError
                        ? error.userMessage
                        : '別の画像または手動入力をお試しください',
                    duration: 5000
                }
            });

            console.error('画像解析エラー詳細:', error);
        } finally {
            console.log('analyzePhoto完了');
            setAnalyzing(false);
        }
    };

    // 認識結果の保存処理
    const handleSaveRecognition = async () => {
        if (!recognitionData) return;

        try {
            setSaving(true);

            // セッションチェック
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new AuthError(
                    'ログインセッションが無効です',
                    ErrorCode.AUTH_EXPIRED,
                    'ログインセッションの有効期限が切れました',
                    { redirectTo: '/auth/login' },
                    ['再度ログインしてください'],
                );
            }

            // LegacyNutritionDataをNutritionDataに変換
            const legacyNutrition = recognitionData.nutrition;
            const nutrition = {
                calories: legacyNutrition.calories,
                protein: legacyNutrition.protein,
                iron: legacyNutrition.iron,
                folic_acid: legacyNutrition.folic_acid,
                calcium: legacyNutrition.calcium,
                vitamin_d: legacyNutrition.vitamin_d || 0,
                confidence_score: legacyNutrition.confidence_score
            };

            // StandardizedMealNutrition型に変換
            const standardizedNutrition = convertToStandardizedNutrition(nutrition, recognitionData.foods);

            // 標準化された食事データの準備
            const standardizedMealData: StandardizedMealData = {
                user_id: session.user.id,
                meal_date: (selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]) as string,
                meal_type: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
                meal_items: recognitionData.foods.map((food) => ({
                    name: food.name,
                    amount: parseFloat(food.quantity?.split(' ')[0] || '1'),
                    unit: food.quantity?.split(' ')[1] || '個',
                })),
                nutrition_data: standardizedNutrition,
                ...(base64Image ? { image_url: base64Image } : {})
            };

            // データの検証
            const validation = validateMealData(standardizedMealData);
            if (!validation.isValid) {
                throw new DataProcessingError(
                    `食事データの検証エラー: ${validation.errors.join(', ')}`,
                    '食事データ',
                    undefined,
                    { details: validation.errors }
                );
            }

            // APIリクエスト用にデータを変換（レガシーシステムとの互換性のため）
            const mealData = prepareForApiRequest(standardizedMealData);

            // APIを使用してデータを保存（エラーハンドリング付き）
            const response = await fetch('/api/meals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(mealData),
            });

            // レスポンスのエラーチェック
            await checkApiResponse(response, '食事データの保存に失敗しました');

            // 成功時の処理
            toast.success("食事を記録しました", {
                description: "栄養情報が更新されました",
                duration: 3000,
            });

            // ホーム画面にリダイレクト
            setTimeout(() => {
                router.refresh();
                router.push('/home');
            }, 1500);
        } catch (error) {
            // 標準化されたエラーハンドリング
            handleError(error, {
                showToast: true,
                toastOptions: {
                    title: "食事の保存に失敗しました",
                }
            });
            console.error('保存エラー:', error);
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

    // 食品データを強化する関数
    const enhanceFoodItems = async (foods: FoodItem[], suppressErrorToast: boolean = false): Promise<FoodItem[]> => {
        try {
            // ローディング通知（sonnerスタイル）
            toast.loading("食品データを分析中...", {
                id: "enhance-foods",
                description: "AIが入力内容を解析しています"
            });

            // 食品名を結合してテキスト入力として解析
            const foodText = foods.map(food => `${food.name} ${food.quantity}`).join('、');

            // 新APIを使用
            const result = await analyzeTextInput(foodText);

            // ローディング通知を閉じる
            toast.dismiss("enhance-foods");

            if (!result.success || !result.data || !result.data.foods || !Array.isArray(result.data.foods)) {
                console.error('APIレスポンス:', result);
                throw new Error('不正な応答フォーマット');
            }

            // 型安全なマッピング
            const enhancedFoodsWithIds: FoodItem[] = [];
            result.data.foods.forEach((item: RecognitionFoodItem, index: number) => {
                const originalItem = foods[index < foods.length ? index : foods.length - 1];
                if (originalItem) {
                    enhancedFoodsWithIds.push({
                        id: originalItem.id,
                        name: item.name || originalItem.name,
                        quantity: item.quantity || originalItem.quantity,
                        confidence: typeof item.confidence === 'number' ? item.confidence : originalItem.confidence
                    });
                }
            });

            // 成功通知
            toast.success("分析完了", {
                description: "食品データを最適化しました"
            });

            return enhancedFoodsWithIds;
        } catch (error) {
            console.error('食品解析エラー:', error);

            if (!suppressErrorToast) {
                // エラー通知
                toast.error("分析エラー", {
                    description: "食品データの解析に失敗しました。元のデータを使用します。"
                });
            }

            // エラー時は元のデータを返す
            return foods;
        }
    };

    // テキスト入力の保存処理
    const handleSaveTextInput = async () => {
        // 入力チェック
        if (foodItems.length === 0) {
            toast.error("入力エラー", {
                description: "少なくとも1つの食品を追加してください"
            });
            return;
        }

        setSaving(true);

        try {
            // AIを使って食品データを強化
            const enhancedFoods = await enhanceFoodItems(foodItems, true);
            // AIの結果で状態を更新
            setFoodItems(enhancedFoods);

            // 認証状態を確認
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("認証エラー", {
                    description: "ログインセッションが無効です。再ログインしてください。"
                });
                return;
            }

            // 保存用のデータ準備（型安全に変換）
            const foodsData = enhancedFoods.map(({ id, ...rest }) => rest);

            // 食品テキストを生成して新APIで栄養計算
            const foodText = enhancedFoods.map(food => `${food.name} ${food.quantity}`).join('、');
            const nutritionResult = await analyzeTextInput(foodText);

            if (!nutritionResult.success || !nutritionResult.data || !nutritionResult.data.nutrition) {
                throw new Error('栄養計算に失敗しました');
            }

            // 型安全に栄養データを取得
            const legacyNutrition: LegacyNutritionData = nutritionResult.data.nutrition || initialNutrition;

            // LegacyNutritionData を NutritionData に変換
            const nutrition = {
                calories: legacyNutrition.calories,
                protein: legacyNutrition.protein,
                iron: legacyNutrition.iron,
                folic_acid: legacyNutrition.folic_acid,
                calcium: legacyNutrition.calcium,
                vitamin_d: legacyNutrition.vitamin_d || 0, // デフォルト値を設定
                confidence_score: legacyNutrition.confidence_score
            };

            // 食品アイテムを作成
            const mealItems = enhancedFoods.map((food) => ({
                name: food.name,
                amount: parseFloat(food.quantity?.split(' ')[0] || '1'),
                unit: food.quantity?.split(' ')[1] || '個',
            }));

            // StandardizedMealNutrition型に変換
            const standardizedNutrition = convertToStandardizedNutrition(nutrition, enhancedFoods);

            // 標準化された食事データの準備
            const standardizedMealData: StandardizedMealData = {
                user_id: session.user.id,
                meal_date: (selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]) as string,
                meal_type: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
                meal_items: mealItems,
                nutrition_data: standardizedNutrition
                // image_urlは任意のため省略
            };

            // データの検証
            const validation = validateMealData(standardizedMealData);
            if (!validation.isValid) {
                throw new DataProcessingError(
                    `食事データの検証エラー: ${validation.errors.join(', ')}`,
                    '食事データ',
                    undefined,
                    { details: validation.errors }
                );
            }

            // APIリクエスト用にデータを変換
            const mealData = prepareForApiRequest(standardizedMealData);

            // APIを使用してデータを保存
            const response = await fetch('/api/meals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(mealData),
            });

            // レスポンスのエラーチェック
            await checkApiResponse(response, '食事データの保存に失敗しました');

            // 成功通知
            toast.success("保存完了", {
                description: "食事を記録しました！"
            });

            // ホームページにリダイレクト
            router.push('/home');
        } catch (error) {
            console.error('食事保存エラー:', error);
            toast.error("保存エラー", {
                description: "食事の記録に失敗しました。もう一度お試しください。"
            });
        } finally {
            setSaving(false);
        }
    };

    // 食事タイプが変更されたときに画像解析をリセット
    useEffect(() => {
        if (base64Image && inputMode === 'photo') {
            // 食事タイプが変更されたときのみ再解析
            analyzePhoto(base64Image);
        }
    }, [mealType, inputMode, base64Image]);

    // 入力モードが変更されたときの処理
    const handleInputModeChange = (mode: InputMode) => {
        setInputMode(mode);

        // 写真モードからテキストモードに切り替えたとき、認識結果があれば食品リストに変換
        if (mode === 'text' && recognitionData && recognitionData.foods.length > 0) {
            const foodsWithIds: FoodItem[] = recognitionData.foods.map((food: RecognitionFoodItem) => ({
                id: crypto.randomUUID(),
                name: food.name,
                quantity: food.quantity,
                confidence: food.confidence
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
                            <div>
                                <p className="mb-2 text-sm text-green-600">解析結果が表示されています</p>
                                <RecognitionEditor
                                    initialData={recognitionData}
                                    onSave={handleSaveRecognition}
                                    mealType={mealType}
                                />
                            </div>
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

// APIからのレスポンスを確認するチェック関数
const checkApiResponse = async (response: Response, errorMessage: string) => {
    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch {
            errorData = { message: await response.text() || errorMessage };
        }
        throw new Error(errorData.message || errorMessage);
    }
    return await response.json();
};

// エラーハンドリング関数
const handleError = (error: unknown, options: {
    showToast: boolean,
    toastOptions?: {
        title: string;
        description?: string;
        duration?: number;
    }
} = { showToast: true }) => {
    console.error('エラー発生:', error);

    if (options.showToast) {
        toast.error(options.toastOptions?.title || 'エラーが発生しました', {
            description: error instanceof AppError
                ? error.userMessage
                : options.toastOptions?.description || '操作を完了できませんでした',
            duration: options.toastOptions?.duration || 3000
        });
    }

    // エラー発生時の追加アクション
    if (error instanceof Error && error.message.includes('認証')) {
        // 認証エラーの場合はログイン画面にリダイレクト
        // router.push('/auth/login') などの処理
    }
};

// DataProcessingErrorクラス（エラー型のサブクラス）
class DataProcessingError extends Error {
    userMessage: string;
    details?: any;
    suggestions?: string[];

    constructor(
        message: string,
        dataType: string,
        code?: string,
        details?: any,
        suggestions?: string[]
    ) {
        super(message);
        this.name = 'DataProcessingError';
        this.userMessage = `${dataType}の処理中にエラーが発生しました`;
        this.details = details;
        this.suggestions = suggestions || ['もう一度お試しください'];
    }
}

// AiAnalysisErrorクラス（エラー型のサブクラス）
class AiAnalysisError extends Error {
    userMessage: string;
    code: string;
    details?: any;
    suggestions?: string[];

    constructor(
        message: string,
        userMessage: string,
        code: string,
        details?: any,
        suggestions?: string[]
    ) {
        super(message);
        this.name = 'AiAnalysisError';
        this.userMessage = userMessage;
        this.code = code;
        this.details = details;
        this.suggestions = suggestions || ['別の画像を試してください'];
    }
}

// AuthErrorクラス（エラー型のサブクラス）
class AuthError extends Error {
    userMessage: string;
    code: string;
    details?: any;
    suggestions?: string[];

    constructor(
        message: string,
        code: string,
        userMessage?: string,
        details?: any,
        suggestions?: string[]
    ) {
        super(message);
        this.name = 'AuthError';
        this.userMessage = userMessage || 'ログインが必要です';
        this.code = code;
        this.details = details;
        this.suggestions = suggestions || ['再度ログインしてください'];
    }
}

// エラーコード定数
const ErrorCode = {
    AUTH_EXPIRED: 'auth_expired',
    DATA_VALIDATION_ERROR: 'data_validation_error',
    API_RESPONSE_INVALID: 'api_response_invalid'
}; 