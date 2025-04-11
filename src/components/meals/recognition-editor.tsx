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
import { toast } from "sonner";
import type { FoodInputParseResult } from "@/lib/food/food-input-parser";

// 食品アイテムの型定義（内部状態用）
interface FoodItem {
    id: string; // 一意のID
    name: string; // 食品名
    quantity: string; // 量
    confidence: number; // 信頼度
}

// コンポーネントのProps
interface RecognitionEditorProps {
    initialData: FoodInputParseResult[];
    onSave: (editedData: FoodInputParseResult[]) => void;
    saving: boolean;
    aiEstimate?: unknown;
    className?: string;
}

export function RecognitionEditor({
    initialData,
    onSave,
    saving,
    aiEstimate,
    className,
}: RecognitionEditorProps) {
    // 食品リストの状態
    const [foods, setFoods] = useState<FoodItem[]>([]);
    // バリデーションエラーの状態
    const [errors, setErrors] = useState<Record<string, string>>({});
    // エラーの状態
    const [error, setError] = useState<string | null>(null);

    // 修正: initialData (FoodInputParseResult[]) から内部状態 foods (FoodItem[]) を設定
    useEffect(() => {
        const foodItemsWithIds = initialData.map((item, index) => ({
            // API結果にIDがないため、常に一時的なIDを生成
            id: crypto.randomUUID(), // 常に UUID を生成
            name: item.foodName,
            quantity: item.quantityText || '',
            confidence: item.confidence || 0.8
        }));
        setFoods(foodItemsWithIds);
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

    // 修正: handleSave 関数
    const handleSave = async () => {
        console.log('RecognitionEditor: handleSave関数が呼び出されました');
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
                console.log('RecognitionEditor: バリデーションエラーがあります', newErrors);
                return; // エラーがある場合は保存しない
            }

            // 修正: 内部状態 foods (FoodItem[]) を FoodInputParseResult[] 形式に変換して onSave に渡す
            // foodId は含めない
            const editedData: FoodInputParseResult[] = foods.map(food => ({
                foodName: food.name,
                quantityText: food.quantity,
                confidence: food.confidence,
            }));

            console.log('RecognitionEditor: 親コンポーネントのonSave関数を呼び出します', editedData);
            toast.loading("保存中...", { id: "save-meal", description: "データを処理しています" });

            // 親コンポーネントの onSave 関数を呼び出す
            onSave(editedData);

            // 注意: この時点ではまだ保存が完了していない可能性がある
            // 親コンポーネントが処理を完了するため、ここでsetSaving(false)は行わない
        } catch (error) {
            console.error('保存処理中にエラーが発生しました:', error);
            setError(error instanceof Error ? error.message : '保存処理に失敗しました');
            toast.error("エラーが発生しました", {
                description: error instanceof Error ? error.message : '保存処理に失敗しました',
                id: "save-meal"
            });
        }
    };

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>食事内容の編集</CardTitle>
                <CardDescription>
                    検出された食品を確認・編集してください
                    {/* AI推定値の表示 (任意) - 型チェック強化 (IIFE使用) */}
                    {(() => {
                        if (aiEstimate && typeof aiEstimate === 'object' && aiEstimate !== null && 'calories' in aiEstimate && typeof aiEstimate.calories === 'number') {
                            // このスコープ内では aiEstimate.calories は number 型として扱われるはず
                            const estimatedCalories = aiEstimate.calories;
                            return (
                                <p className="text-sm text-muted-foreground mt-1">
                                    AIによる推定カロリー: {estimatedCalories.toFixed(0)} kcal
                                </p>
                            );
                        }
                        return null; // 条件に合わない場合は何もレンダリングしない
                    })()}
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
                                        placeholder="量 (例: 100g, 1個)"
                                    />
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeFood(food.id)}
                                    className="text-muted-foreground hover:text-destructive"
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
            </CardContent>

            <CardFooter className="flex justify-end">
                <Button onClick={handleSave} disabled={saving || Object.keys(errors).length > 0}>
                    {saving ? (
                        <><Save className="mr-2 h-4 w-4 animate-spin" /> 保存中...</>
                    ) : (
                        <><Save className="mr-2 h-4 w-4" /> 保存する</>
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
} 