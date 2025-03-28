'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { URLClipForm } from '@/components/recipes/url-clip-form';
import { RecipeUrlClipRequest, RecipeUrlClipResponse, RecipeIngredient } from '@/types/recipe';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Check, Loader2, InfoIcon, Info } from 'lucide-react';
import { ManualIngredientsForm } from '@/components/recipes/manual-ingredients-form';
import { ScreenshotUploader } from '@/components/recipes/screenshot-uploader';
import { SocialMediaPlaceholder } from '@/components/recipes/social-media-placeholder';

export default function RecipeClipClient() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'url' | 'confirm' | 'success'>('url');
    const [parsedRecipe, setParsedRecipe] = useState<RecipeUrlClipResponse | null>(null);
    const [editedRecipe, setEditedRecipe] = useState<RecipeUrlClipResponse & { recipe_type?: string; is_social_media?: boolean; content_id?: string; } | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [usePlaceholder, setUsePlaceholder] = useState<boolean>(true);
    const [servings, setServings] = useState<number>(2); // デフォルト人数：2人前

    const handleUrlSubmit = async (data: RecipeUrlClipRequest, isSocialMedia: boolean) => {
        setIsLoading(true);
        setError(null);

        try {
            // URLからサイト名を判定
            const url = new URL(data.url);
            const hostname = url.hostname;

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
            const parsedData = responseData.data; // 成功レスポンスのデータフィールドを取得

            // ソーシャルメディア情報を追加
            if (isSocialMedia && !parsedData.is_social_media) {
                parsedData.is_social_media = true;
            }

            console.log('レシピ解析結果:', parsedData);

            setParsedRecipe(parsedData);
            setEditedRecipe({
                ...parsedData,
                recipe_type: 'main_dish', // デフォルト値
            });

            // ソーシャルメディアの場合はプレースホルダーをデフォルトに
            setUsePlaceholder(isSocialMedia);

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
                            const nutritionData = await response.json();

                            if (nutritionData.success) {
                                // 栄養素データを更新
                                editedRecipe.nutrition_per_serving = nutritionData.nutrition_per_serving;
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

            const savedData = await response.json();
            setSaveSuccess(true);
            setStep('success');

            // キャッシュを更新するためにルーターを更新
            router.refresh();
        } catch (err) {
            console.error('保存エラー:', err);
            setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRecipeTypeChange = (recipeType: string) => {
        if (editedRecipe) {
            setEditedRecipe({
                ...editedRecipe,
                recipe_type: recipeType,
            });
        }
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editedRecipe) {
            setEditedRecipe({
                ...editedRecipe,
                title: e.target.value,
            });
        }
    };

    const updateIngredients = (ingredients: RecipeIngredient[]) => {
        if (editedRecipe) {
            setEditedRecipe({
                ...editedRecipe,
                ingredients
            });
        }
    };

    const handleServingsChange = (newServings: number) => {
        setServings(newServings);
    };

    const handleImageCapture = (imageData: string) => {
        if (editedRecipe) {
            setEditedRecipe({
                ...editedRecipe,
                image_url: imageData
            });
            setUsePlaceholder(false);
        }
    };

    const handleUsePlaceholder = () => {
        if (editedRecipe) {
            setUsePlaceholder(true);
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
                <URLClipForm onSubmit={handleUrlSubmit} isLoading={isLoading} error={undefined} />
            </CardContent>
        </Card>
    );

    const renderConfirmStep = () => {
        if (!editedRecipe) return null;

        const isSocialMedia = editedRecipe.is_social_media ||
            editedRecipe.source_platform === 'Instagram' ||
            editedRecipe.source_platform === 'TikTok';

        return (
            <Card className="w-full max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>クリップ内容の確認</CardTitle>
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

                    {/* サムネイル画像セクション */}
                    {isSocialMedia && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">サムネイル画像</label>

                            {!usePlaceholder ? (
                                // スクリーンショットアップローダー
                                <div>
                                    <ScreenshotUploader
                                        initialImage={editedRecipe.image_url}
                                        onImageCapture={handleImageCapture}
                                    />
                                    <div className="mt-3">
                                        <p className="text-sm text-gray-500 mb-2">
                                            または以下のプレースホルダーを使用:
                                        </p>
                                        <div className="cursor-pointer" onClick={handleUsePlaceholder}>
                                            <SocialMediaPlaceholder
                                                platform={editedRecipe.source_platform as 'Instagram' | 'TikTok'}
                                                title={editedRecipe.title}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // プレースホルダー
                                <div>
                                    <SocialMediaPlaceholder
                                        platform={editedRecipe.source_platform as 'Instagram' | 'TikTok'}
                                        title={editedRecipe.title}
                                    />
                                    <div className="mt-3">
                                        <p className="text-sm text-gray-500 mb-2">スクリーンショットをアップロードする:</p>
                                        <ScreenshotUploader
                                            onImageCapture={handleImageCapture}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
                            {Object.entries(editedRecipe.nutrition_per_serving).map(([key, value]) => (
                                <div key={key} className="bg-gray-50 p-2 rounded">
                                    <div className="text-xs text-gray-500">{getNutrientLabel(key)}</div>
                                    <div className="font-medium">
                                        {typeof value === 'number' ? Number(value).toFixed(1) : value} {getNutrientUnit(key)}
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
                        setParsedRecipe(null);
                        setEditedRecipe(null);
                        setSaveSuccess(false);
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

function getNutrientLabel(key: string): string {
    const labels: Record<string, string> = {
        calories: 'カロリー',
        protein: 'タンパク質',
        fat: '脂質',
        carbs: '炭水化物',
        iron: '鉄分',
        folic_acid: '葉酸',
        calcium: 'カルシウム',
        vitamin_d: 'ビタミンD',
    };
    return labels[key] || key;
}

function getNutrientUnit(key: string): string {
    if (key === 'calories') return 'kcal';
    if (key === 'folic_acid') return 'μg';
    return 'g';
} 