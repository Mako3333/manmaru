'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { URLClipForm } from '@/components/recipes/url-clip-form';
import { RecipeUrlClipRequest, RecipeUrlClipResponse, RecipeIngredient } from '@/types/recipe';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { ManualIngredientsForm } from '@/components/recipes/manual-ingredients-form';
import { ScreenshotUploader } from '@/components/recipes/screenshot-uploader';
import { SocialMediaPlaceholder } from '@/components/recipes/social-media-placeholder';
import { StandardizedMealNutrition } from '@/types/nutrition';
import { convertToStandardizedNutrition } from '@/lib/nutrition/nutrition-utils';
import { AlertCircle, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const createEmptyStandardizedNutrition = (): StandardizedMealNutrition => ({
    totalCalories: 0,
    totalNutrients: [],
    foodItems: [],
    pregnancySpecific: {
        folatePercentage: 0,
        ironPercentage: 0,
        calciumPercentage: 0
    },
    reliability: {
        confidence: 0.5,
        balanceScore: 0,
        completeness: 0.5
    }
});

export default function RecipeClipClient() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'url' | 'confirm' | 'success'>('url');
    const [usePlaceholder, setUsePlaceholder] = useState<boolean>(true);
    const [servings, setServings] = useState<number>(2); // デフォルト人数：2人前
    const [editedRecipe, setEditedRecipe] = useState<(
        RecipeUrlClipResponse &
        { recipe_type?: string; }
    ) | null>(null);

    const handleUrlSubmit = async (data: RecipeUrlClipRequest, isSocialMedia: boolean) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log('レシピURL解析開始:', data.url, 'ソーシャル:', isSocialMedia);

            // APIエンドポイント：新しいv2 APIエンドポイントを使用
            const apiEndpoint = '/api/v2/recipe/parse';

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: data.url }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'URLの解析に失敗しました');
            }

            const responseData = await response.json();
            const parsedData = responseData.data as RecipeUrlClipResponse; // 取得データに型アサーション

            // ソーシャルメディア情報を追加
            if (isSocialMedia && !parsedData.is_social_media) {
                parsedData.is_social_media = true;
            }

            console.log('レシピ解析結果:', parsedData);

            // parsedData.nutrition_per_serving が StandardizedMealNutrition でない可能性を考慮
            // 必要に応じて convertToStandardizedNutrition を使用して変換
            // --- 修正: /api/v2/recipe/parse は StandardizedMealNutrition を返すため、この変換は不要 ---
            /*
            if (parsedData.nutrition_per_serving && !('totalNutrients' in parsedData.nutrition_per_serving)) {
                // 仮の食品アイテムリストを作成 (変換関数が要求するため)
                const tempFoodItems = parsedData.ingredients.map(ing => ({ name: ing.name, quantity: ing.quantity || '' }));
                // convertToStandardizedNutrition は NutritionData (古い型) を期待するため、型アサーション
                parsedData.nutrition_per_serving = convertToStandardizedNutrition(
                    parsedData.nutrition_per_serving as import('@/types/nutrition').NutritionData,
                    tempFoodItems as import('@/types/nutrition').FoodItem[]
                );
            } else if (!parsedData.nutrition_per_serving) {
                parsedData.nutrition_per_serving = createEmptyStandardizedNutrition();
            }
            */
            // --- 修正ここまで ---

            // APIレスポンスの nutritionResult.nutrition を直接利用する
            // editedRecipe ステートの型 RecipeUrlClipResponse は nutritionResult を持つように更新済み
            // parsedData は API レスポンスの data 部分なので、型アサーションが必要
            const apiResponseData = responseData.data as RecipeUrlClipResponse;

            // editedRecipe にセットするデータを作成
            // APIレスポンスに含まれないプロパティも考慮
            // --- 修正: image_url を正しくマッピング --- START
            const recipeToSet: RecipeUrlClipResponse = {
                // recipe や nutritionResult など、APIレスポンスの構造を維持
                recipe: apiResponseData.recipe,
                nutritionResult: apiResponseData.nutritionResult,
                // APIレスポンスの data 直下にある他のプロパティ (あれば)
                // ... (もし apiResponseData 直下に他のプロパティがあれば展開)
                // imageUrl を data.recipe.imageUrl から取得し、トップレベルの image_url に設定
                image_url: apiResponseData.recipe.imageUrl,
                // クライアント側で追加するプロパティ
                recipe_type: 'main_dish', // デフォルト値を設定
                is_social_media: isSocialMedia,
                use_placeholder: !apiResponseData.recipe.imageUrl, // 画像があればプレースホルダーはfalse
            };
            // --- 修正: image_url を正しくマッピング --- END

            setEditedRecipe(recipeToSet);
            setError(null);
            setStep('confirm');
        } catch (error) {
            console.error('レシピ解析エラー:', error); // 詳細なエラー情報をコンソールに出力
            let displayMessage = '不明なエラーが発生しました。時間を置いて再試行してください。'; // デフォルトメッセージ

            if (error instanceof Error) {
                // APIエラーの場合、error.message に API からのメッセージが含まれることを期待
                // (response.ok でない場合に throw new Error(errorData.error...) しているため)
                const apiErrorMessage = error.message;

                if (apiErrorMessage === '[object Object]') {
                    // API がオブジェクトのエラーを返し、それが文字列化された場合
                    // 本来は API レスポンスの userMessage を表示したい
                    displayMessage = 'レシピ情報の取得中にエラーが発生しました (詳細不明)。';
                    console.warn('API returned a complex error object which could not be displayed. Check server logs for details.');
                } else if (apiErrorMessage) {
                    // API が文字列のエラーメッセージを返した場合
                    displayMessage = apiErrorMessage;
                }
                // else の場合はデフォルトメッセージを使用
            } else {
                // Error インスタンスでない稀なケース
                displayMessage = String(error) || displayMessage;
            }

            // ユーザーに表示するメッセージを設定
            setError(displayMessage);

            // ガイドライン準拠のための注意点:
            // 本来は API レスポンスの error.userMessage を優先的に表示すべきです。
            // 現在の実装では、API が返す errorData.error の内容に依存しています。
            // API 側で一貫して AppError 形式 (userMessage を含む) のエラーを返し、
            // クライアント側でそれを適切に解析する方がより堅牢です。
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveRecipe = async () => {
        if (!editedRecipe) return;

        setIsLoading(true);
        setError(null);

        try {
            // ソーシャルメディアの場合は保存前に最終的な栄養素計算を実行
            if (editedRecipe.is_social_media ||
                editedRecipe.source_platform === 'Instagram' ||
                editedRecipe.source_platform === 'TikTok') {

                try {
                    // 空の材料や名前がない材料はスキップ
                    const validIngredients = editedRecipe.recipe.ingredients.filter(
                        ing => ing.name && ing.name.trim() !== ''
                    );

                    if (validIngredients.length > 0) {
                        const response = await fetch('/api/recipes/calculate-nutrients', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                ingredients: validIngredients,
                                servings: servings
                            }),
                        });

                        if (response.ok) {
                            const nutritionApiResponse = await response.json();

                            if (nutritionApiResponse.success) {
                                // 取得した栄養データを StandardizedMealNutrition に変換
                                const standardizedNutrition = nutritionApiResponse.nutrition_per_serving as StandardizedMealNutrition;

                                // 栄養素データを更新
                                if (editedRecipe) {
                                    editedRecipe.nutritionResult.nutrition = standardizedNutrition;
                                }
                            }
                        }
                    }
                } catch (nutritionError) {
                    console.error('保存前の栄養素計算エラー:', nutritionError);
                    // エラーがあっても保存処理は続行
                }
            }

            // ソーシャルメディアの場合、プレースホルダー使用フラグを設定
            if (editedRecipe.is_social_media ||
                editedRecipe.source_platform === 'Instagram' ||
                editedRecipe.source_platform === 'TikTok') {

                editedRecipe.use_placeholder = usePlaceholder;
            }

            // 保存するデータを構築
            const saveData: Partial<import('@/types/recipe').ClippedRecipe> = {
                title: editedRecipe.recipe.title,
                image_url: editedRecipe.image_url,
                source_url: editedRecipe.recipe.sourceUrl,
                source_platform: editedRecipe.source_platform,
                content_id: editedRecipe.content_id,
                recipe_type: editedRecipe.recipe_type,
                ingredients: editedRecipe.recipe.ingredients,
                nutrition_per_serving: editedRecipe.nutritionResult.nutrition,
                caution_foods: editedRecipe.caution_foods,
                caution_level: editedRecipe.caution_level,
                is_favorite: false,
                servings: servings,
                is_social_media: editedRecipe.is_social_media,
                use_placeholder: editedRecipe.use_placeholder,
            };

            const response = await fetch('/api/recipes/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(saveData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'レシピの保存に失敗しました');
            }

            setIsLoading(false);
            setStep('success');

            // キャッシュを更新するためにルーターを更新
            router.refresh();
        } catch (err) {
            console.error('保存エラー:', err);
            setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
            setIsLoading(false);
        }
    };

    const handleRecipeTypeChange = (recipeType: string) => {
        setEditedRecipe(prev => prev ? { ...prev, recipe_type: recipeType } : null);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setEditedRecipe(prev => prev ? { ...prev, recipe: { ...prev.recipe, title: newTitle } } : null);
    };

    const updateIngredients = (newIngredients: RecipeIngredient[]) => {
        setEditedRecipe(prev => prev ? { ...prev, recipe: { ...prev.recipe, ingredients: newIngredients } } : null);
    };

    const handleServingsChange = (newServings: number) => {
        setServings(newServings);
    };

    const handleImageCapture = (imageData: string) => {
        setEditedRecipe(prev => prev ? { ...prev, image_url: imageData, use_placeholder: false } : null);
    };

    const handleUsePlaceholder = () => {
        setEditedRecipe(prev => prev ? { ...prev, use_placeholder: true } : null);
    };

    const renderUrlStep = () => (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>レシピURLをクリップ</CardTitle>
                <CardDescription>
                    レシピサイト、Instagram、TikTokのURLを入力してクリップします
                </CardDescription>
            </CardHeader>
            <CardContent>
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>エラーが発生しました</AlertTitle>
                        <AlertDescription>
                            {error}
                            {error.includes('デリッシュキッチン') && (
                                <div className="mt-2 text-sm">
                                    <p>対処方法: </p>
                                    <ul className="list-disc pl-5 mt-1">
                                        <li>別のレシピサイト（クックパッドなど）をお試しください</li>
                                        <li>または別のデリッシュキッチンのレシピをお試しください</li>
                                    </ul>
                                </div>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
                <URLClipForm onSubmit={handleUrlSubmit} isLoading={isLoading} error={error || undefined} />
            </CardContent>
        </Card>
    );

    const renderConfirmStep = () => {
        if (!editedRecipe) return null;

        const isSocialMedia = editedRecipe.is_social_media ||
            editedRecipe.source_platform === 'Instagram' ||
            editedRecipe.source_platform === 'TikTok';

        // 栄養情報の表示（StandardizedMealNutrition に合わせて調整）
        const nutrition = editedRecipe.nutritionResult?.nutrition;
        const perServingNutrition = editedRecipe.nutritionResult?.perServing || nutrition;

        const displayNutrients = [
            { key: 'totalCalories', label: 'カロリー', value: perServingNutrition?.totalCalories, unit: 'kcal' },
            ...(perServingNutrition?.totalNutrients || []).map(n => ({ key: n.name, label: n.name, value: n.value, unit: n.unit }))
        ].filter(n => n.value !== undefined && n.value > 0);

        return (
            <Card className="w-full max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>{editedRecipe.recipe?.title || 'クリップ内容の確認・編集'}</CardTitle>
                    <CardDescription>
                        {isSocialMedia
                            ? 'ソーシャルメディアからクリップした内容を編集できます'
                            : '解析された情報を確認・編集してください'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>エラー</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {isSocialMedia && (
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>ソーシャルメディアのレシピ</AlertTitle>
                            <AlertDescription>
                                材料情報は自動取得できないため、手動で入力してください。
                            </AlertDescription>
                        </Alert>
                    )}

                    {editedRecipe.caution_foods && editedRecipe.caution_foods.length > 0 && (
                        <Alert variant={editedRecipe.caution_level === 'high' ? 'destructive' : 'warning'}>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>注意食材が含まれています</AlertTitle>
                            <AlertDescription>
                                {editedRecipe.caution_foods.join('、')}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">レシピタイトル</label>
                        <input
                            type="text"
                            value={editedRecipe.recipe?.title || ''}
                            onChange={handleTitleChange}
                            className="w-full p-2 border rounded"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">レシピの種類</label>
                        <Tabs defaultValue={editedRecipe.recipe_type || "main_dish"} onValueChange={handleRecipeTypeChange}>
                            <TabsList className="w-full">
                                <TabsTrigger
                                    value="main_dish"
                                    className={cn(
                                        "data-[state=active]:bg-green-100 data-[state=active]:text-green-800 data-[state=active]:border-b-2 data-[state=active]:border-green-600"
                                    )}
                                >
                                    主菜
                                </TabsTrigger>
                                <TabsTrigger
                                    value="side_dish"
                                    className={cn(
                                        "data-[state=active]:bg-green-100 data-[state=active]:text-green-800 data-[state=active]:border-b-2 data-[state=active]:border-green-600"
                                    )}
                                >
                                    副菜
                                </TabsTrigger>
                                <TabsTrigger
                                    value="soup"
                                    className={cn(
                                        "data-[state=active]:bg-green-100 data-[state=active]:text-green-800 data-[state=active]:border-b-2 data-[state=active]:border-green-600"
                                    )}
                                >
                                    汁物
                                </TabsTrigger>
                                <TabsTrigger
                                    value="staple_food"
                                    className={cn(
                                        "data-[state=active]:bg-green-100 data-[state=active]:text-green-800 data-[state=active]:border-b-2 data-[state=active]:border-green-600"
                                    )}
                                >
                                    主食
                                </TabsTrigger>
                                <TabsTrigger
                                    value="dessert"
                                    className={cn(
                                        "data-[state=active]:bg-green-100 data-[state=active]:text-green-800 data-[state=active]:border-b-2 data-[state=active]:border-green-600"
                                    )}
                                >
                                    デザート
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">人数</label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={servings}
                            onChange={(e) => handleServingsChange(parseInt(e.target.value, 10))}
                            className="w-full p-2 border rounded"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">材料リスト</label>
                        {isSocialMedia ? (
                            <ManualIngredientsForm
                                ingredients={editedRecipe.recipe?.ingredients || []}
                                onChange={updateIngredients}
                                servings={servings}
                                onServingsChange={handleServingsChange}
                            />
                        ) : (
                            <div className="border rounded p-3 max-h-40 overflow-y-auto">
                                <ul className="list-disc list-inside">
                                    {editedRecipe.recipe?.ingredients?.map((ingredient, idx) => (
                                        <li key={idx}>
                                            {ingredient.name}
                                            {ingredient.quantity && ` ${ingredient.quantity}`}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">栄養情報 (1人前)</label>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {displayNutrients.length > 0 ? displayNutrients.map((nutrient) => (
                                <div key={nutrient.key} className="bg-gray-50 p-2 rounded">
                                    <div className="text-xs text-gray-500">{nutrient.label}:</div>
                                    <div className="font-medium">
                                        {nutrient.value !== undefined ? Math.round(nutrient.value * 10) / 10 : '-'} {nutrient.unit}
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-gray-500 col-span-full">栄養情報がありません。</p>
                            )}
                        </div>
                        {isSocialMedia && (
                            <p className="text-xs text-gray-500">
                                ※ 材料を入力すると自動的に栄養素が計算されます
                            </p>
                        )}
                    </div>

                    {/* 画像関連 (ソーシャルメディアの場合) */}
                    {isSocialMedia && (
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-3">表示画像</h3>
                            <Tabs defaultValue={editedRecipe.use_placeholder ? "placeholder" : "screenshot"} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger
                                        value="placeholder"
                                        onClick={handleUsePlaceholder}
                                        className={cn(
                                            "data-[state=active]:bg-green-100 data-[state=active]:text-green-800 data-[state=active]:border-b-2 data-[state=active]:border-green-600"
                                        )}
                                    >
                                        プレースホルダー
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="screenshot"
                                        onClick={() => setUsePlaceholder(false)}
                                        className={cn(
                                            "data-[state=active]:bg-green-100 data-[state=active]:text-green-800 data-[state=active]:border-b-2 data-[state=active]:border-green-600"
                                        )}
                                    >
                                        スクリーンショット
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="placeholder" className="mt-4">
                                    <SocialMediaPlaceholder platform={(editedRecipe.source_platform === 'Instagram' || editedRecipe.source_platform === 'TikTok') ? editedRecipe.source_platform : 'other'} />
                                    <p className="text-xs text-gray-500 mt-2">著作権に配慮し、プレースホルダー画像を使用します。</p>
                                </TabsContent>
                                <TabsContent value="screenshot" className="mt-4">
                                    <ScreenshotUploader onImageCapture={handleImageCapture} initialImage={editedRecipe.use_placeholder ? undefined : editedRecipe.image_url} />
                                    <Alert variant="warning" className="mt-4">
                                        <Info className="h-4 w-4" />
                                        <AlertTitle>注意</AlertTitle>
                                        <AlertDescription>
                                            スクリーンショットを使用する場合、著作権にご注意ください。
                                            個人的な利用にとどめてください。
                                        </AlertDescription>
                                    </Alert>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={() => setStep('url')}
                        disabled={isLoading}
                    >
                        戻る
                    </Button>
                    <Button
                        onClick={handleSaveRecipe}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                保存中...
                            </>
                        ) : (
                            'レシピを保存'
                        )}
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    const renderSuccessStep = () => (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>レシピのクリップ完了</CardTitle>
                <CardDescription>
                    レシピが正常に保存されました
                </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-6">
                <div className="mb-4 bg-green-100 text-green-800 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                    <Check className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium mb-2">保存成功!</h3>
                <p className="text-gray-600 mb-6">
                    レシピがあなたのコレクションに追加されました
                </p>
            </CardContent>
            <CardFooter className="flex justify-center">
                <Button
                    onClick={() => router.push('/recipes')}
                    className="mr-2"
                >
                    マイレシピへ
                </Button>
                <Button
                    variant="outline"
                    onClick={() => {
                        setStep('url');
                        setError(null);
                        setUsePlaceholder(true);
                        setServings(2); // 人数を初期値に戻す
                    }}
                >
                    別のレシピをクリップ
                </Button>
            </CardFooter>
        </Card>
    );

    const renderContent = () => {
        switch (step) {
            case 'url':
                return renderUrlStep();
            case 'confirm':
                return renderConfirmStep();
            case 'success':
                return renderSuccessStep();
            default:
                return renderUrlStep();
        }
    };

    return (
        <div className="recipe-clip-container py-8">
            {renderContent()}
        </div>
    );
} 