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

            setEditedRecipe(parsedData);
            setError(null);
            setStep('confirm');
        } catch (error) {
            console.error('レシピ解析エラー:', error);
            setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
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
                    const validIngredients = editedRecipe.ingredients.filter(
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
                                const calculatedNutrition = nutritionApiResponse.nutrition_per_serving;
                                const tempFoodItems = validIngredients.map(ing => ({ name: ing.name, quantity: ing.quantity || '' }));
                                // 変換関数は NutritionData (古い型) を期待する可能性
                                const standardizedNutrition = convertToStandardizedNutrition(
                                    calculatedNutrition as import('@/types/nutrition').NutritionData,
                                    tempFoodItems as import('@/types/nutrition').FoodItem[]
                                );

                                // 栄養素データを更新
                                if (editedRecipe) {
                                    editedRecipe.nutrition_per_serving = standardizedNutrition;
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
            // important: image_urlは維持し、use_placeholderフラグで制御する
            if (editedRecipe.is_social_media ||
                editedRecipe.source_platform === 'Instagram' ||
                editedRecipe.source_platform === 'TikTok') {

                editedRecipe.use_placeholder = usePlaceholder;
            }

            const response = await fetch('/api/recipes/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...editedRecipe,
                    servings: servings // 人数情報を追加
                }),
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
        }
    };

    const handleRecipeTypeChange = (recipeType: string) => {
        if (editedRecipe) {
            editedRecipe.recipe_type = recipeType;
        }
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editedRecipe) {
            editedRecipe.title = e.target.value;
        }
    };

    const updateIngredients = (newIngredients: RecipeIngredient[]) => {
        if (editedRecipe) {
            editedRecipe.ingredients = newIngredients;
        }
    };

    const handleServingsChange = (newServings: number) => {
        setServings(newServings);
    };

    const handleImageCapture = (imageData: string) => {
        if (editedRecipe) {
            editedRecipe.image_url = imageData;
            editedRecipe.use_placeholder = false; // 画像が設定されたらプレースホルダーはfalseに
        }
    };

    const handleUsePlaceholder = () => {
        if (editedRecipe) {
            editedRecipe.use_placeholder = true;
        }
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
        const nutrition = editedRecipe.nutrition_per_serving;
        const displayNutrients = [
            { key: 'totalCalories', label: 'カロリー', value: nutrition.totalCalories, unit: 'kcal' },
            ...nutrition.totalNutrients.map(n => ({ key: n.name, label: n.name, value: n.value, unit: n.unit }))
        ].filter(n => n.value !== undefined && n.value > 0); // 値が0より大きいものだけ表示

        return (
            <Card className="w-full max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>クリップ内容の確認・編集</CardTitle>
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
                            value={editedRecipe.title}
                            onChange={handleTitleChange}
                            className="w-full p-2 border rounded"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">レシピの種類</label>
                        <Tabs defaultValue="main_dish" onValueChange={handleRecipeTypeChange}>
                            <TabsList className="w-full">
                                <TabsTrigger value="main_dish">主菜</TabsTrigger>
                                <TabsTrigger value="side_dish">副菜</TabsTrigger>
                                <TabsTrigger value="soup">汁物</TabsTrigger>
                                <TabsTrigger value="staple_food">主食</TabsTrigger>
                                <TabsTrigger value="dessert">デザート</TabsTrigger>
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
                                ingredients={editedRecipe.ingredients}
                                onChange={updateIngredients}
                                servings={servings}
                                onServingsChange={handleServingsChange}
                            />
                        ) : (
                            <div className="border rounded p-3 max-h-40 overflow-y-auto">
                                <ul className="list-disc list-inside">
                                    {editedRecipe.ingredients.map((ingredient, idx) => (
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
                            {displayNutrients.map((nutrient) => (
                                <div key={nutrient.key} className="bg-gray-50 p-2 rounded">
                                    <div className="text-xs text-gray-500">{nutrient.label}:</div>
                                    <div className="font-medium">
                                        {Math.round(nutrient.value * 10) / 10} {nutrient.unit}
                                    </div>
                                </div>
                            ))}
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
                                    <TabsTrigger value="placeholder" onClick={handleUsePlaceholder}>プレースホルダー</TabsTrigger>
                                    <TabsTrigger value="screenshot" onClick={() => setUsePlaceholder(false)}>スクリーンショット</TabsTrigger>
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