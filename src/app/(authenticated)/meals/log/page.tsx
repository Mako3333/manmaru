'use client'
// ライブラリのインポート
import { useState, useEffect, FormEvent, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

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
import { AppError, ErrorCode } from '@/lib/error'
import {
    validateMealData,
    prepareForApiRequest,
} from '@/lib/nutrition/nutrition-utils'
import { StandardizedMealData, StandardizedMealNutrition, NutritionData } from '@/types/nutrition'
import { FoodInputParseResult } from '@/lib/food/food-input-parser'
import type { Profile } from '@/lib/utils/profile'


// 入力モードの型定義
type InputMode = 'photo' | 'text';

// 食品アイテムの型定義
interface FoodItem {
    id: string;
    name: string;
    quantity: string;
    confidence: number;
}

// 認識データの型定義 (RecognitionEditorコンポーネントと互換性のある形式)
interface RecognitionData {
    foods: FoodInputParseResult[];
    nutritionResult: {
        nutrition: StandardizedMealNutrition;
        matchResults: unknown[];
        legacyNutrition: NutritionData;
    };
    recognitionConfidence?: number;
    aiEstimatedNutrition?: unknown;
    originalImageProvided?: boolean;
    mealType?: string;
}

// APIからのレスポンスデータのラッパー型
/* // This seems unused after refactoring RecognitionData
interface ApiRecognitionResponse {
    success: boolean;
    data: {
        foods: {
            name: string;
            quantity: string;
            confidence: number;
        }[];
        nutrition: StandardizedMealNutrition;
    };
}
*/

export default function MealLogPage() {
    // ユーザープロフィール関連の状態
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    // 食事タイプの状態(朝食・昼食・夕食・間食)
    const [mealType, setMealType] = useState<MealType>('breakfast')

    // 日付の状態 (selectedDate は保持し、setSelectedDate を未使用にする)
    const [selectedDate] = useState<Date>(new Date())

    // 入力モードの状態(写真モード・テキストモード)
    const [inputMode, setInputMode] = useState<InputMode>('photo')

    // 画像解析関連の状態 (selectedFile は未使用のまま)
    const [,] = useState<File | null>(null)
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
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

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
    }, [supabase])// supabase を依存配列に追加

    // 写真が選択されたときの処理
    const handlePhotoCapture = async (file: File, base64: string) => {
        setBase64Image(base64);

        // 画像解析を開始
        await analyzePhoto(base64);
    };

    // 画像解析処理 (useCallback でメモ化)
    const analyzePhoto = useCallback(async (base64Image: string) => {
        console.log('analyzePhoto開始: データ長', base64Image.length);
        setAnalyzing(true);
        setRecognitionData(null);

        try {
            if (!base64Image || base64Image.length === 0) {
                throw new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: '画像データが不足しています',
                    userMessage: '食事画像を再度撮影してください',
                    details: { imageLength: base64Image?.length || 0 }
                });
            }

            console.log('mealType:', mealType);

            // 新APIを使用
            const result = await analyzeMealPhoto(base64Image, mealType);

            console.log('API応答:', result);

            // データの存在を確認
            if (!result.success || !result.data || !result.data.foods || !Array.isArray(result.data.foods)) {
                throw new AppError({
                    code: ErrorCode.AI.IMAGE_PROCESSING_ERROR,
                    message: 'AI応答データの形式が不正です',
                    userMessage: '解析結果が正しくありません',
                    details: { response: result },
                    suggestions: ['別の画像を試してください', '手動での食品入力も可能です']
                });
            }

            // 英語の食品名を検出して警告
            const hasEnglishFoodNames = result.data.foods.some((food: FoodInputParseResult) =>
                /^[a-zA-Z]/.test(food.foodName) || (food.quantityText && typeof food.quantityText === 'string' && /^[0-9]+ [a-z]+/.test(food.quantityText))
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
                nutritionResult: {
                    nutrition: result.data.nutritionResult.nutrition,
                    matchResults: result.data.nutritionResult.matchResults || [],
                    legacyNutrition: result.data.aiEstimatedNutrition || {}
                },
                recognitionConfidence: result.data.recognitionConfidence,
                aiEstimatedNutrition: result.data.aiEstimatedNutrition,
                originalImageProvided: result.data.originalImageProvided,
                mealType: result.data.mealType
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
    }, [mealType]); // handleErrorを依存配列から削除（コールバック関数であり、変化しないため）

    // 認識結果の保存処理
    const handleSaveRecognition = async (nutritionData: StandardizedMealNutrition) => {
        console.log('handleSaveRecognition: 関数が呼び出されました', nutritionData);
        if (!recognitionData) {
            console.error('handleSaveRecognition: recognitionDataがnullです');
            return;
        }

        try {
            setSaving(true);
            console.log('handleSaveRecognition: 保存処理開始');

            // セッションチェック
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new AppError({
                    code: ErrorCode.Base.AUTH_ERROR,
                    message: 'ログインセッションが無効です',
                    userMessage: 'ログインセッションの有効期限が切れました',
                    details: { redirectTo: '/auth/login' },
                    suggestions: ['再度ログインしてください']
                });
            }
            console.log('handleSaveRecognition: セッション確認OK');

            // 食事データの準備
            const mealData = {
                meal_type: mealType,
                meal_date: (selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                ...(base64Image ? { photo_url: base64Image } : {}),
                food_description: {
                    items: recognitionData.foods.map((food) => ({
                        name: food.foodName,
                        quantity: food.quantityText || '1個',
                    }))
                },
                nutrition_data: nutritionData
            };
            console.log('handleSaveRecognition: 保存用データ準備完了', mealData);

            // APIを使用してデータを保存（エラーハンドリング付き）
            const response = await fetch('/api/meals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(mealData),
            });
            console.log('handleSaveRecognition: APIリクエスト送信完了', response.status);

            // レスポンスのエラーチェック
            await checkApiResponse(response, '食事データの保存に失敗しました');

            // 成功時の処理
            toast.success("食事を記録しました", {
                description: "栄養情報が更新されました",
                duration: 3000,
            });
            console.log('handleSaveRecognition: 保存成功');

            // ホーム画面にリダイレクト
            setTimeout(() => {
                try {
                    console.log('リダイレクト実行中...');
                    router.refresh();
                    router.push('/home');  // 元の '/home' に戻す
                } catch (redirectError) {
                    console.error('リダイレクトエラー:', redirectError);
                    // リダイレクトに失敗した場合はブラウザのlocation APIを使用
                    window.location.href = '/home';
                }
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
            console.log('handleSaveRecognition: 処理完了');
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
        // 食品データが空の場合は処理せず、そのまま返す
        if (foods.length === 0) return foods;

        try {
            if (!foods.some(food => food.name.trim() !== '')) {
                throw new Error('有効な食品名がありません');
            }

            console.log('AI解析予定食品:', foods);

            // 食品アイテムを文字列に変換
            const foodText = foods.map(food => `${food.name} ${food.quantity}`.trim()).join('、');

            // 栄養素解析APIを呼び出す
            const response = await analyzeTextInput(foodText);

            console.log('AI解析結果:', response);

            if (!response.success || !response.data) {
                throw new Error('栄養素解析に失敗しました');
            }

            // APIのレスポンスからIDを合わせて食品情報を更新
            const updatedFoods = foods.map(food => {
                const matchedFood = response.data.foods.find(
                    (apiFood: FoodInputParseResult) =>
                        apiFood.foodName.toLowerCase() === food.name.toLowerCase()
                );

                return {
                    ...food,
                    confidence: matchedFood ? 0.9 : food.confidence // 適合度を設定
                };
            });

            return updatedFoods;
        } catch (error) {
            console.error('栄養素解析エラー:', error);

            if (!suppressErrorToast) {
                // エラーメッセージの表示
                toast.error('栄養素解析に失敗しました', {
                    description: '手動で情報を編集してください',
                });
            }

            // エラー時は元の食品リストを返す
            return foods;
        }
    };

    // テキスト入力の保存処理
    const handleSaveTextInput = async () => {
        try {
            // 食品リストが空の場合は処理を中止
            if (foodItems.length === 0) {
                toast.error('食品が入力されていません', {
                    description: '少なくとも1つの食品を入力してください',
                });
                return;
            }

            setSaving(true);

            // 食品リストを強化（AI解析による情報追加）
            const enhancedFoods = await enhanceFoodItems(foodItems);
            console.log('テキスト入力: 強化された食品リスト', enhancedFoods);

            // 栄養素解析
            const foodText = enhancedFoods.map(food => `${food.name} ${food.quantity}`.trim()).join('、');
            const nutritionResult = await analyzeTextInput(foodText);
            console.log('テキスト入力: 栄養素解析結果', nutritionResult);

            // 結果のバリデーション
            if (!nutritionResult.success || !nutritionResult.data || !nutritionResult.data.nutritionResult || !nutritionResult.data.nutritionResult.nutrition) {
                throw new AppError({
                    code: ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR,
                    message: 'テキスト解析APIから有効な栄養データが返されませんでした',
                    userMessage: '栄養計算に失敗しました。別の食品を入力するか、少し時間をおいて再度お試しください。',
                    details: { response: nutritionResult }
                });
            }

            // standardizedNutrition取得
            const standardizedNutrition = nutritionResult.data.nutritionResult.nutrition;

            // セッションの確認
            const sessionData = await supabase.auth.getSession();
            if (!sessionData.data.session) {
                throw new AppError({
                    code: ErrorCode.Base.AUTH_ERROR,
                    message: 'ログインセッションが無効です',
                    userMessage: 'ログインセッションの有効期限が切れました。再度ログインしてください。',
                    details: { redirectTo: '/auth/login' }
                });
            }

            const today = new Date();
            const formattedDate = format(today, 'yyyy-MM-dd');

            // 保存用データの準備
            const mealData = {
                meal_type: mealType,
                meal_date: formattedDate,
                food_description: {
                    items: enhancedFoods.map(food => ({
                        name: food.name,
                        quantity: food.quantity,
                        confidence: food.confidence || 0
                    }))
                },
                // API応答から直接StandardizedMealNutrition型のデータを使用
                nutrition_data: standardizedNutrition
            };
            console.log('テキスト入力: 保存用データ準備完了', mealData);

            // データ検証
            try {
                validateMealData(mealData);
            } catch (validationError) {
                throw new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: '食事データの検証に失敗しました',
                    userMessage: '入力データに問題があります。別の食品データを入力してください。',
                    originalError: validationError instanceof Error ? validationError : undefined
                });
            }

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
            toast.success('食事記録を保存しました', {
                description: 'ホーム画面に栄養データが反映されます',
            });

            // ダッシュボードにリダイレクト
            router.push('/home');
        } catch (error) {
            console.error('テキスト入力保存エラー:', error);

            // AppErrorのハンドリング
            if (error instanceof AppError) {
                toast.error('保存に失敗しました', {
                    description: error.userMessage || '予期せぬエラーが発生しました',
                });
            } else {
                toast.error('保存に失敗しました', {
                    description: error instanceof Error ? error.message : '予期せぬエラーが発生しました',
                });
            }
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
    }, [mealType, inputMode, base64Image, analyzePhoto]);

    // 入力モードが変更されたときの処理
    const handleInputModeChange = (mode: InputMode) => {
        setInputMode(mode);

        // 写真モードからテキストモードに切り替えたとき、認識結果があれば食品リストに変換
        if (mode === 'text' && recognitionData && recognitionData.foods.length > 0) {
            const foodsWithIds: FoodItem[] = recognitionData.foods.map((food) => ({
                id: crypto.randomUUID(),
                name: food.foodName,
                quantity: food.quantityText || '不明',
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
                        {!analyzing && recognitionData?.nutritionResult?.nutrition && (
                            <div>
                                <p className="mb-2 text-sm text-green-600">解析結果が表示されています</p>
                                <RecognitionEditor
                                    initialData={recognitionData.nutritionResult.nutrition}
                                    onSave={(nutritionData) => {
                                        console.log('RecognitionEditor onSave呼び出し:', nutritionData);
                                        handleSaveRecognition(nutritionData);
                                    }}
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
        throw new AppError({
            code: ErrorCode.Base.API_ERROR,
            message: errorData.message || errorMessage,
            userMessage: 'API処理中にエラーが発生しました'
        });
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
    if (error instanceof AppError && error.code === ErrorCode.Base.AUTH_ERROR) {
        // 認証エラーの場合はログイン画面にリダイレクト
        // router.push('/auth/login') などの処理
    }
}; 