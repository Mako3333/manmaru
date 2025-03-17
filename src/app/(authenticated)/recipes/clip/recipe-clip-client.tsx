'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { URLClipForm } from '@/components/recipes/url-clip-form';
import { RecipeUrlClipRequest, RecipeUrlClipResponse } from '@/types/recipe';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

export default function RecipeClipClient() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'url' | 'confirm' | 'success'>('url');
    const [parsedRecipe, setParsedRecipe] = useState<RecipeUrlClipResponse | null>(null);
    const [editedRecipe, setEditedRecipe] = useState<RecipeUrlClipResponse & { recipe_type?: string } | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleUrlSubmit = async (data: RecipeUrlClipRequest) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/recipes/parse-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'URLの解析に失敗しました');
            }

            const parsedData = await response.json();
            setParsedRecipe(parsedData);
            setEditedRecipe({
                ...parsedData,
                recipe_type: 'main_dish', // デフォルト値
            });
            setStep('confirm');
        } catch (err) {
            console.error('URL処理エラー:', err);
            setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveRecipe = async () => {
        if (!editedRecipe) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/recipes/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editedRecipe),
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

    const renderUrlStep = () => (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>レシピをクリップ</CardTitle>
                <CardDescription>
                    レシピサイトのURLを入力して栄養情報を自動取得します
                </CardDescription>
            </CardHeader>
            <CardContent>
                <URLClipForm
                    onSubmit={handleUrlSubmit}
                    isLoading={isLoading}
                    error={error || undefined}
                />
            </CardContent>
        </Card>
    );

    const renderConfirmStep = () => {
        if (!editedRecipe) return null;

        return (
            <Card className="w-full max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>クリップ内容の確認</CardTitle>
                    <CardDescription>
                        解析された情報を確認・編集してください
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
                        <label className="text-sm font-medium">材料リスト</label>
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
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">栄養情報（1人前）</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {Object.entries(editedRecipe.nutrition_per_serving).map(([key, value]) => (
                                <div key={key} className="bg-gray-50 p-2 rounded">
                                    <div className="text-xs text-gray-500">{getNutrientLabel(key)}</div>
                                    <div className="font-medium">{value} {getNutrientUnit(key)}</div>
                                </div>
                            ))}
                        </div>
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
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        レシピを保存
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    const renderSuccessStep = () => (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <div className="flex justify-center mb-4">
                    <div className="bg-green-100 p-3 rounded-full">
                        <Check className="h-6 w-6 text-green-600" />
                    </div>
                </div>
                <CardTitle className="text-center">レシピを保存しました</CardTitle>
                <CardDescription className="text-center">
                    レシピが正常に保存されました。マイレシピから確認できます。
                </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center space-x-4">
                <Button
                    variant="outline"
                    onClick={() => {
                        setStep('url');
                        setParsedRecipe(null);
                        setEditedRecipe(null);
                        setSaveSuccess(false);
                    }}
                >
                    他のレシピをクリップ
                </Button>
                <Button onClick={() => router.push('/recipes')}>
                    マイレシピを見る
                </Button>
            </CardFooter>
        </Card>
    );

    // 画面のステップに応じてレンダリング
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
        <div className="container py-8">
            {renderContent()}
        </div>
    );
}

// 栄養素のラベル変換
function getNutrientLabel(key: string): string {
    const labels: Record<string, string> = {
        calories: 'カロリー',
        protein: 'タンパク質',
        fat: '脂質',
        carbs: '炭水化物',
        iron: '鉄分',
        folic_acid: '葉酸',
        calcium: 'カルシウム',
        vitamin_d: 'ビタミンD'
    };

    return labels[key] || key;
}

// 栄養素の単位
function getNutrientUnit(key: string): string {
    const units: Record<string, string> = {
        calories: 'kcal',
        protein: 'g',
        fat: 'g',
        carbs: 'g',
        iron: 'mg',
        folic_acid: 'μg',
        calcium: 'mg',
        vitamin_d: 'μg'
    };

    return units[key] || '';
} 