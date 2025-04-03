"use client";
//src\components\meals\recognition-editor.tsx
import React, { useState, useEffect } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StandardizedMealNutrition, Nutrient } from "@/types/nutrition";
import { convertToLegacyNutrition } from "@/lib/nutrition/nutrition-utils";

// 食品アイテムの型定義（内部状態用）
interface FoodItem {
    id: string; // 一意のID
    name: string; // 食品名
    quantity: string; // 量
    confidence: number; // 信頼度
}

// コンポーネントのProps
interface RecognitionEditorProps {
    initialData: StandardizedMealNutrition;
    onSave: (data: StandardizedMealNutrition) => void;
    className?: string;
    mealType: string;
    mealDate?: string | undefined;
    photoUrl?: string | undefined;
}

export function RecognitionEditor({
    initialData,
    onSave,
    className,
    mealType,
    mealDate,
    photoUrl,
}: RecognitionEditorProps) {
    // 食品リストの状態
    const [foods, setFoods] = useState<FoodItem[]>([]);
    // 栄養情報の状態
    const [nutrition, setNutrition] = useState<StandardizedMealNutrition>(initialData);
    // バリデーションエラーの状態
    const [errors, setErrors] = useState<Record<string, string>>({});
    // 保存中の状態
    const [saving, setSaving] = useState(false);
    // エラーの状態
    const [error, setError] = useState<string | null>(null);
    // ルーターの状態
    const router = useRouter();

    // initialDataが変更されたら状態を更新
    useEffect(() => {
        // foodItemsから内部用のFoodItem形式に変換
        const foodItemsWithIds = initialData.foodItems.map(foodItem => ({
            id: foodItem.id || crypto.randomUUID(),
            name: foodItem.name,
            quantity: `${foodItem.amount} ${foodItem.unit}`,
            confidence: 0.9 // デフォルト値（標準形式に信頼度情報がない場合）
        }));
        setFoods(foodItemsWithIds);
        setNutrition(initialData);
        setErrors({});
    }, [initialData]);

    // 食品アイテムの更新
    const updateFood = (id: string, field: keyof FoodItem, value: string | number) => {
        setFoods(prevFoods =>
            prevFoods.map(food =>
                food.id === id ? { ...food, [field]: value } : food
            )
        );

        // 名前フィールドのバリデーション
        if (field === 'name') {
            validateFoodName(id, value as string);
        }
    };

    // 食品名のバリデーション
    const validateFoodName = (id: string, name: string) => {
        if (!name.trim()) {
            setErrors(prev => ({ ...prev, [id]: '食品名を入力してください' }));
        } else {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[id];
                return newErrors;
            });
        }
    };

    // 新しい食品アイテムの追加
    const addFood = () => {
        const newFood: FoodItem = {
            id: crypto.randomUUID(),
            name: '',
            quantity: '',
            confidence: 0.9
        };
        setFoods(prev => [...prev, newFood]);
    };

    // 食品アイテムの削除
    const removeFood = (id: string) => {
        setFoods(prev => prev.filter(food => food.id !== id));
        // エラーも削除
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[id];
            return newErrors;
        });
    };

    // 特定の栄養素の値を取得する関数
    const getNutrientValue = (name: string): number => {
        const nutrient = nutrition.totalNutrients.find(n =>
            n.name === name || n.name.toLowerCase() === name.toLowerCase()
        );
        return nutrient?.value || 0;
    };

    // 保存処理
    const handleSave = async () => {
        setSaving(true);
        try {
            // バリデーションチェック
            let hasErrors = false;
            const newErrors: Record<string, string> = {};

            foods.forEach(food => {
                if (!food.name.trim()) {
                    newErrors[food.id] = '食品名を入力してください';
                    hasErrors = true;
                }
            });

            setErrors(newErrors);

            if (hasErrors) {
                return; // エラーがある場合は保存しない
            }

            // 更新された食品アイテムを標準型に変換
            const updatedFoodItems = foods.map(food => {
                const [amountStr, unit] = food.quantity.split(' ');
                return {
                    id: food.id,
                    name: food.name,
                    amount: parseFloat(amountStr || '1'),
                    unit: unit || '個',
                    nutrition: {
                        calories: nutrition.totalCalories / foods.length, // 単純な割り当て
                        nutrients: nutrition.totalNutrients.map(n => ({ ...n, value: n.value / foods.length })),
                        servingSize: {
                            value: 1,
                            unit: '人前'
                        }
                    }
                };
            });

            // 更新された StandardizedMealNutrition を作成
            const updatedNutrition: StandardizedMealNutrition = {
                ...nutrition,
                foodItems: updatedFoodItems
            };

            // レガシーシステムとの互換性のために変換
            const legacyNutrition = convertToLegacyNutrition(updatedNutrition);

            // saveMealWithNutrients APIを使用して、meals と meal_nutrients の両方に保存
            const response = await fetch('/api/meals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    meal_type: mealType,
                    meal_date: mealDate || new Date().toISOString().split('T')[0],
                    photo_url: photoUrl,
                    // データベース構造に合わせてフォーマットする
                    food_description: {
                        items: foods.map(food => ({
                            name: food.name,
                            quantity: food.quantity,
                            confidence: food.confidence
                        }))
                    },
                    // データベース構造に合わせて栄養データをフォーマット
                    nutrition_data: updatedNutrition,
                    // 後方互換性のためにレガシーフォーマットも含める
                    nutrition: {
                        calories: legacyNutrition.calories,
                        protein: legacyNutrition.protein,
                        iron: legacyNutrition.iron,
                        folic_acid: legacyNutrition.folic_acid,
                        calcium: legacyNutrition.calcium,
                        vitamin_d: legacyNutrition.vitamin_d || 0,
                        confidence_score: legacyNutrition.confidence_score
                    },
                    servings: 1
                }),
            });

            if (!response.ok) {
                // レスポンスのエラー内容を詳細に取得
                const errorData = await response.json();
                console.error('食事保存APIレスポンス:', errorData);
                throw new Error(errorData.error || '食事の保存に失敗しました');
            }

            const result = await response.json();
            console.log('食事保存成功:', result);

            // 成功時のトースト通知
            toast.success("食事を記録しました", {
                description: "栄養情報が更新されました",
                duration: 3000,
            });

            // リダイレクト処理
            setTimeout(() => {
                router.refresh();
                router.push('/home');
            }, 1500); // 1.5秒遅延
        } catch (error) {
            console.error('食事保存エラーの詳細:', error);
            setError(error instanceof Error ? error.message : '食事の保存に失敗しました');

            // エラー時のトースト通知
            toast.error("保存に失敗しました", {
                description: error instanceof Error ? error.message : "もう一度お試しください",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>食事内容の編集</CardTitle>
                <CardDescription>
                    検出された食品を確認・編集してください
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* 食品リスト */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">食品リスト</h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={addFood}
                            className="flex items-center gap-1"
                        >
                            <Plus className="h-4 w-4" />
                            <span>食品を追加</span>
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {foods.map((food) => (
                            <div key={food.id} className="flex items-start gap-2">
                                <div className="flex-1 space-y-1">
                                    <Label htmlFor={`food-name-${food.id}`} className="sr-only">
                                        食品名
                                    </Label>
                                    <Input
                                        id={`food-name-${food.id}`}
                                        value={food.name}
                                        onChange={(e) => updateFood(food.id, 'name', e.target.value)}
                                        placeholder="食品名"
                                        className={errors[food.id] ? "border-destructive" : ""}
                                    />
                                    {errors[food.id] && (
                                        <p className="text-xs text-destructive">{errors[food.id]}</p>
                                    )}
                                </div>

                                <div className="w-1/3">
                                    <Label htmlFor={`food-quantity-${food.id}`} className="sr-only">
                                        量
                                    </Label>
                                    <Input
                                        id={`food-quantity-${food.id}`}
                                        value={food.quantity}
                                        onChange={(e) => updateFood(food.id, 'quantity', e.target.value)}
                                        placeholder="量"
                                    />
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeFood(food.id)}
                                    className="h-10 w-10 text-destructive hover:text-destructive/90"
                                    aria-label="食品を削除"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}

                        {foods.length === 0 && (
                            <p className="text-sm text-muted-foreground py-2">
                                食品が検出されませんでした。「食品を追加」ボタンから手動で追加できます。
                            </p>
                        )}
                    </div>
                </div>

                {/* 栄養情報 */}
                <div className="space-y-3">
                    <h3 className="text-lg font-medium">栄養情報</h3>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border p-3">
                            <p className="text-sm text-muted-foreground">カロリー</p>
                            <p className="text-lg font-medium">{nutrition.totalCalories} kcal</p>
                        </div>

                        <div className="rounded-lg border p-3">
                            <p className="text-sm text-muted-foreground">タンパク質</p>
                            <p className="text-lg font-medium">{getNutrientValue('タンパク質')} g</p>
                        </div>

                        <div className="rounded-lg border p-3">
                            <p className="text-sm text-muted-foreground">鉄分</p>
                            <p className="text-lg font-medium">{getNutrientValue('鉄分')} mg</p>
                        </div>

                        <div className="rounded-lg border p-3">
                            <p className="text-sm text-muted-foreground">葉酸</p>
                            <p className="text-lg font-medium">{getNutrientValue('葉酸')} μg</p>
                        </div>

                        <div className="rounded-lg border p-3">
                            <p className="text-sm text-muted-foreground">カルシウム</p>
                            <p className="text-lg font-medium">{getNutrientValue('カルシウム')} mg</p>
                        </div>

                        <div className="rounded-lg border p-3">
                            <p className="text-sm text-muted-foreground">信頼度</p>
                            <p className="text-lg font-medium">{Math.round(nutrition.pregnancySpecific?.folatePercentage || 90)}%</p>
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        ※ 栄養情報は推定値です。食品の編集により実際の値と異なる場合があります。
                    </p>
                </div>
            </CardContent>

            <CardFooter>
                <Button
                    onClick={handleSave}
                    className="w-full sm:w-auto"
                    disabled={Object.keys(errors).length > 0 || saving}
                >
                    <Save className="mr-2 h-4 w-4" />
                    保存する
                </Button>
            </CardFooter>
        </Card>
    );
} 