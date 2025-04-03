"use client";

import React, { useState, useEffect } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FoodListEditor } from "@/components/food/food-list-editor";
import { FoodItem } from "@/components/food/food-edit-modal";
import { ReliabilityIndicator } from "@/components/nutrition/reliability-indicator";
import { NutritionSummary, NutrientData } from "@/components/nutrition/nutrition-summary";
import { StandardizedMealNutrition, Nutrient } from "@/types/nutrition";

// APIに送信する食品アイテムの型定義
interface ApiFood {
    name: string;
    quantity: string;
    confidence: number;
}

// 解析結果データの型定義
interface RecognitionData {
    foods: ApiFood[];
    nutrition: StandardizedMealNutrition;
}

// コンポーネントのProps
interface EnhancedRecognitionEditorProps {
    initialData: RecognitionData;
    onSave: (data: RecognitionData) => void;
    className?: string;
    mealType: string;
    mealDate?: string | undefined;
    photoUrl?: string | undefined;
}

// 特定の栄養素を取得するヘルパー関数
const getNutrientValue = (nutrients: Nutrient[], name: string): number => {
    const nutrient = nutrients.find(n => n.name === name);
    return nutrient ? nutrient.value : 0;
};

export function EnhancedRecognitionEditor({
    initialData,
    onSave,
    className,
    mealType,
    mealDate,
    photoUrl,
}: EnhancedRecognitionEditorProps) {
    // 食品リストの状態
    const [foods, setFoods] = useState<FoodItem[]>([]);
    // 栄養情報の状態
    const [nutrition, setNutrition] = useState<StandardizedMealNutrition>(initialData.nutrition);
    // 栄養素データ（NutritionSummary用）
    const [nutrients, setNutrients] = useState<NutrientData[]>([]);
    // 保存中の状態
    const [saving, setSaving] = useState(false);
    // エラーの状態
    const [error, setError] = useState<string | null>(null);
    // ルーターの状態
    const router = useRouter();

    // initialDataが変更されたら状態を更新
    useEffect(() => {
        // APIの食品データをFoodItemの形式に変換
        const foodItems = initialData.foods.map(food => ({
            id: crypto.randomUUID(),
            name: food.name,
            quantity: food.quantity,
            confidence: food.confidence
        }));
        setFoods(foodItems);
        setNutrition(initialData.nutrition);

        // 栄養素データをNutrientDataの形式に変換
        const nutrientItems: NutrientData[] = [
            {
                name: 'エネルギー',
                amount: initialData.nutrition.totalCalories,
                unit: 'kcal',
                percentOfDaily: initialData.nutrition.totalCalories / 2000 // 仮の推奨摂取量
            }
        ];

        // totalNutrientsから各栄養素を抽出
        const protein = getNutrientValue(initialData.nutrition.totalNutrients, 'たんぱく質');
        const iron = getNutrientValue(initialData.nutrition.totalNutrients, '鉄分');
        const folicAcid = getNutrientValue(initialData.nutrition.totalNutrients, '葉酸');
        const calcium = getNutrientValue(initialData.nutrition.totalNutrients, 'カルシウム');
        const vitaminD = getNutrientValue(initialData.nutrition.totalNutrients, 'ビタミンD');

        // タンパク質
        nutrientItems.push({
            name: 'たんぱく質',
            amount: protein,
            unit: 'g',
            percentOfDaily: protein / 60 // 仮の推奨摂取量
        });

        // 鉄分
        nutrientItems.push({
            name: '鉄分',
            amount: iron,
            unit: 'mg',
            percentOfDaily: iron / 10.5, // 妊婦の推奨摂取量
            isDeficient: iron < 8 // 鉄分不足の目安
        });

        // 葉酸
        nutrientItems.push({
            name: '葉酸',
            amount: folicAcid,
            unit: 'μg',
            percentOfDaily: folicAcid / 400, // 妊婦の推奨摂取量
            isDeficient: folicAcid < 300 // 葉酸不足の目安
        });

        // カルシウム
        nutrientItems.push({
            name: 'カルシウム',
            amount: calcium,
            unit: 'mg',
            percentOfDaily: calcium / 650, // 妊婦の推奨摂取量
            isDeficient: calcium < 500 // カルシウム不足の目安
        });

        // ビタミンD
        if (vitaminD !== undefined) {
            nutrientItems.push({
                name: 'ビタミンD',
                amount: vitaminD,
                unit: 'μg',
                percentOfDaily: vitaminD / 8.5, // 妊婦の推奨摂取量
                isDeficient: vitaminD < 7 // ビタミンD不足の目安
            });
        }

        setNutrients(nutrientItems);
    }, [initialData]);

    // 食品リストの更新ハンドラー
    const handleFoodListChange = (updatedFoodList: FoodItem[]) => {
        setFoods(updatedFoodList);

        // 食品リストの変更に応じて栄養情報の信頼度を更新
        // 実際の計算は栄養計算サービスで行うべきだが、ここでは簡易的に計算
        const lowConfidenceFoods = updatedFoodList.filter(food => food.confidence !== undefined && food.confidence < 0.7);
        if (lowConfidenceFoods.length > 0) {
            // 低確信度の食品がある場合、全体の信頼度を下げる
            // 実際のアプリケーションでは、より複雑な計算方法を実装すべき
            const updatedNutrition = { ...nutrition };

            // confidence_score の代替として、特定の項目の信頼度を下げる実装は行わず、
            // 現在のデータをそのまま維持します
            setNutrition(updatedNutrition);
        }
    };

    // 保存処理
    const handleSave = async () => {
        setSaving(true);
        try {
            // 食品名のバリデーション
            const invalidFoods = foods.filter(food => !food.name.trim());
            if (invalidFoods.length > 0) {
                toast.error("入力エラー", {
                    description: "食品名が入力されていないアイテムがあります",
                });
                return;
            }

            // 保存用のデータを作成
            const dataToSave: RecognitionData = {
                foods: foods.map(food => ({
                    name: food.name,
                    quantity: food.quantity || "",
                    confidence: food.confidence || 0
                })),
                nutrition
            };

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
                        items: dataToSave.foods.map(food => ({
                            name: food.name,
                            quantity: food.quantity,
                            confidence: food.confidence
                        }))
                    },
                    // StandardizedMealNutrition型をそのまま使用
                    nutrition_data: {
                        ...dataToSave.nutrition
                    },
                    // meal_nutrientsテーブル用のデータも含める
                    nutrition: {
                        calories: dataToSave.nutrition.totalCalories,
                        protein: getNutrientValue(dataToSave.nutrition.totalNutrients, 'たんぱく質'),
                        iron: getNutrientValue(dataToSave.nutrition.totalNutrients, '鉄分'),
                        folic_acid: getNutrientValue(dataToSave.nutrition.totalNutrients, '葉酸'),
                        calcium: getNutrientValue(dataToSave.nutrition.totalNutrients, 'カルシウム'),
                        vitamin_d: getNutrientValue(dataToSave.nutrition.totalNutrients, 'ビタミンD'),
                        confidence_score: 0.8 // 仮の値、実際には信頼度を計算すべき
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

    // 低確信度の食品数を計算
    const lowConfidenceFoodsCount = foods.filter(food => food.confidence !== undefined && food.confidence < 0.7).length;

    // 見つからなかった食品の数（名前はあるが確信度がない食品）
    const missingFoodsCount = foods.filter(food => food.name.trim() && (!food.confidence || food.confidence < 0.35)).length;

    // 信頼性スコアを取得（仮の実装）
    const getReliabilityScore = (): number => {
        // 実際のアプリケーションでは、より複雑な計算や StandardizedMealNutrition からの取得方法を実装すべき
        return 0.8 - (lowConfidenceFoodsCount * 0.1);
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
                {/* 食品リストエディタ */}
                <FoodListEditor
                    foodItems={foods}
                    onFoodListChange={handleFoodListChange}
                    editable={true}
                />

                {/* 栄養情報サマリー */}
                <NutritionSummary
                    nutrients={nutrients}
                    reliabilityScore={getReliabilityScore()}
                    missingFoodsCount={missingFoodsCount}
                    lowConfidenceFoodsCount={lowConfidenceFoodsCount}
                    initiallyExpanded={false}
                />
            </CardContent>

            <CardFooter>
                <Button
                    onClick={handleSave}
                    className="w-full sm:w-auto"
                    disabled={foods.some(food => !food.name.trim()) || saving}
                >
                    <Save className="mr-2 h-4 w-4" />
                    保存する
                </Button>
            </CardFooter>
        </Card>
    );
} 