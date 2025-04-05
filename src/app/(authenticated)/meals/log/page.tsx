'use client'
// ライブラリのインポート
import { useState, useEffect, FormEvent } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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
import { AppError, ErrorCode } from '@/lib/error'
import {
    normalizeNutritionData,
    validateMealData,
    prepareForApiRequest,
    convertToStandardizedNutrition
} from '@/lib/nutrition/nutrition-utils';
import { StandardizedMealData, StandardizedMealNutrition, Nutrient, NutritionData } from '@/types/nutrition';
import { FoodInputParseResult } from '@/lib/food/food-input-parser';


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
        matchResults: any[];
        legacyNutrition: NutritionData;
    };
    recognitionConfidence?: number;
    aiEstimatedNutrition?: any;
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
            const hasEnglishFoodNames = result.data.foods.some((food: any) =>
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
                nutritionResult: {
                    nutrition: {
                        totalCalories: result.data.aiEstimatedNutrition.calories,
                        totalNutrients: [
                            { name: 'タンパク質', value: result.data.aiEstimatedNutrition.protein, unit: 'g' },
                            { name: '鉄分', value: result.data.aiEstimatedNutrition.iron, unit: 'mg' },
                            { name: '葉酸', value: result.data.aiEstimatedNutrition.folic_acid, unit: 'mcg' },
                            { name: 'カルシウム', value: result.data.aiEstimatedNutrition.calcium, unit: 'mg' },
                            { name: 'ビタミンD', value: result.data.aiEstimatedNutrition.vitamin_d, unit: 'mcg' }
                        ],
                        foodItems: result.data.foods.map((food: any) => ({
                            id: crypto.randomUUID(),
                            name: food.foodName,
                            amount: 1,
                            unit: food.quantityText?.split(' ')[1] || '個',
                            nutrition: {
                                calories: result.data.aiEstimatedNutrition.calories / result.data.foods.length,
                                nutrients: [],
                                servingSize: { value: 1, unit: '人前' }
                            }
                        })),
                        reliability: {
                            confidence: result.data.meta?.analysisSource === 'ai' ? 0.8 : 0.95
                        }
                    },
                    matchResults: [],
                    legacyNutrition: result.data.aiEstimatedNutrition
                }
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

            // 標準化された食事データの準備
            const standardizedMealData: StandardizedMealData = {
                user_id: session.user.id,
                meal_date: (selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]) as string,
                meal_type: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
                meal_items: recognitionData.foods.map((food) => ({
                    name: food.foodName,
                    amount: parseFloat(food.quantityText?.split(' ')[0] || '1'),
                    unit: food.quantityText?.split(' ')[1] || '個',
                })),
                nutrition_data: nutritionData,
                ...(base64Image ? { image_url: base64Image } : {})
            };
            console.log('handleSaveRecognition: 保存用データ準備完了', standardizedMealData);

            // データの検証
            const validation = validateMealData(standardizedMealData);
            if (!validation.isValid) {
                throw new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: `食事データの検証エラー: ${validation.errors.join(', ')}`,
                    userMessage: '食事データの検証に失敗しました',
                    details: { errors: validation.errors }
                });
            }
            console.log('handleSaveRecognition: データ検証完了');

            // APIリクエスト用にデータを変換（レガシーシステムとの互換性のため）
            const mealData = prepareForApiRequest(standardizedMealData);
            console.log('handleSaveRecognition: API用データ変換完了', mealData);

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
            result.data.foods.forEach((item: any, index: number) => {
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
                throw new AppError({
                    code: ErrorCode.Base.AUTH_ERROR,
                    message: 'ログインセッションが無効です',
                    userMessage: 'ログインセッションの有効期限が切れました',
                    details: { redirectTo: '/auth/login' }
                });
            }

            // 保存用のデータ準備（型安全に変換）
            const foodsData = enhancedFoods.map(({ id, ...rest }) => rest);

            // 食品テキストを生成して新APIで栄養計算
            const foodText = enhancedFoods.map(food => `${food.name} ${food.quantity}`).join('、');
            const nutritionResult = await analyzeTextInput(foodText);

            // 新しいレスポンス構造をチェック
            if (!nutritionResult.success || !nutritionResult.data || !nutritionResult.data.nutritionResult || !nutritionResult.data.nutritionResult.nutrition) {
                console.error('API response format error or nutrition calculation failed:', nutritionResult); // 詳細ログ
                throw new Error('栄養計算結果の取得に失敗しました'); // エラーメッセージをより具体的に
            }

            // 型安全に栄養データを取得 (ネストされたパスから取得)
            const standardizedNutrition: StandardizedMealNutrition = nutritionResult.data.nutritionResult.nutrition;

            // 食品アイテムを作成
            const mealItems = enhancedFoods.map((food) => ({
                name: food.name,
                amount: parseFloat(food.quantity?.split(' ')[0] || '1'),
                unit: food.quantity?.split(' ')[1] || '個',
            }));

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
                throw new AppError({
                    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                    message: `食事データの検証エラー: ${validation.errors.join(', ')}`,
                    userMessage: '食事データの検証に失敗しました',
                    details: { errors: validation.errors }
                });
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
            setTimeout(() => {
                try {
                    console.log('テキスト入力からのリダイレクト実行中...');
                    router.refresh();
                    router.push('/home');
                } catch (redirectError) {
                    console.error('リダイレクトエラー:', redirectError);
                    window.location.href = '/home';
                }
            }, 1500);
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