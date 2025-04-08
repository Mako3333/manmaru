"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { EnhancedRecognitionEditor } from "@/components/meals/enhanced-recognition-editor";
import { toast } from "sonner";
import { StandardizedMealNutrition, Nutrient, NutrientUnit } from "@/types/nutrition";

// スケルトンコンポーネントの型定義
interface SkeletonProps {
    className?: string;
}

// スケルトンコンポーネントの簡易実装
const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
    return <div className={`animate-pulse bg-muted ${className}`} />;
};

// API食品アイテムの型定義
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

// 栄養素作成ヘルパー
const createNutrient = (name: string, value: number, unit: NutrientUnit): Nutrient => ({
    name,
    value,
    unit,
});

// デモ用のモックデータ (StandardizedMealNutrition 形式)
const mockRecognitionData: RecognitionData = {
    foods: [
        { name: "ほうれん草", quantity: "1束", confidence: 0.92 },
        { name: "にんじん", quantity: "1本", confidence: 0.89 },
        { name: "豆腐", quantity: "1パック", confidence: 0.85 },
        { name: "ごはん", quantity: "1杯", confidence: 0.95 }
    ],
    nutrition: {
        totalCalories: 450,
        totalNutrients: [
            createNutrient('たんぱく質', 15, 'g'),
            createNutrient('鉄分', 6.5, 'mg'),
            createNutrient('葉酸', 250, 'mcg'),
            createNutrient('カルシウム', 300, 'mg'),
            createNutrient('ビタミンD', 3.5, 'mcg'),
        ],
        foodItems: [], // モックでは簡易的に空
        pregnancySpecific: {
            folatePercentage: (250 / 400) * 100,
            ironPercentage: (6.5 / 20) * 100,
            calciumPercentage: (300 / 800) * 100,
        },
        reliability: {
            confidence: 0.9
        }
    }
};

// 空の栄養データ
const emptyNutrition: StandardizedMealNutrition = {
    totalCalories: 0,
    totalNutrients: [],
    foodItems: [],
    pregnancySpecific: {
        folatePercentage: 0,
        ironPercentage: 0,
        calciumPercentage: 0,
    },
    reliability: {
        confidence: 0.8
    }
};

export default function EnhancedRecognitionPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [recognitionData, setRecognitionData] = useState<RecognitionData>({ foods: [], nutrition: emptyNutrition });
    const [error, setError] = useState<string | null>(null);

    const mealId = searchParams.get("meal_id");
    const mealType = searchParams.get("meal_type") || "dinner";
    const mealDate = searchParams.get("meal_date") || new Date().toISOString().split('T')[0];
    const photoUrl = searchParams.get("photo_url") || undefined;

    // 実際のAPIからデータを取得する処理
    useEffect(() => {
        async function fetchRecognitionData() {
            setLoading(true);
            try {
                // 写真IDがある場合はAPIから食品認識データを取得
                if (photoUrl) {
                    console.log("写真URLから食品認識APIを呼び出し:", photoUrl);

                    // 通常はここでAPIを呼び出しますが、デモではモックデータを使用
                    // const response = await fetch(`/api/recognition?photo_url=${photoUrl}`);
                    // if (!response.ok) throw new Error("食品認識APIの呼び出しに失敗しました");
                    // const data = await response.json();

                    // デモ用に少し遅延を入れる
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // APIレスポンスの代わりにモックデータを使用
                    setRecognitionData(mockRecognitionData);
                }
                // 食事IDがある場合は既存の食事データを取得
                else if (mealId) {
                    console.log("食事IDから既存の食事を取得:", mealId);

                    // 通常はここでAPIを呼び出しますが、デモではモックデータを使用
                    // const response = await fetch(`/api/meals/${mealId}`);
                    // if (!response.ok) throw new Error("食事データの取得に失敗しました");
                    // const data = await response.json();

                    // デモ用に少し遅延を入れる
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // 既存データを変更して少し異なるデータにする
                    const modifiedData: RecognitionData = {
                        foods: [
                            { name: "サラダ", quantity: "1皿", confidence: 0.88 },
                            { name: "チキン", quantity: "1枚", confidence: 0.93 },
                            { name: "ライス", quantity: "1杯", confidence: 0.95 }
                        ],
                        nutrition: {
                            totalCalories: 600,
                            totalNutrients: [
                                createNutrient('たんぱく質', 30, 'g'),
                                createNutrient('鉄分', 4.0, 'mg'),
                                createNutrient('葉酸', 180, 'mcg'),
                                createNutrient('カルシウム', 150, 'mg'),
                                createNutrient('ビタミンD', 2.5, 'mcg'),
                            ],
                            foodItems: [],
                            pregnancySpecific: {
                                folatePercentage: (180 / 400) * 100,
                                ironPercentage: (4.0 / 20) * 100,
                                calciumPercentage: (150 / 800) * 100,
                            },
                            reliability: {
                                confidence: 0.85
                            }
                        }
                    };
                    setRecognitionData(modifiedData);
                }
                // どちらもない場合は空のテンプレートを使用
                else {
                    setRecognitionData({
                        foods: [],
                        nutrition: emptyNutrition
                    });
                }
            } catch (err) {
                console.error("データ取得エラー:", err);
                setError(err instanceof Error ? err.message : "データの取得に失敗しました");

                toast.error("データの取得に失敗しました", {
                    description: "しばらく経ってからもう一度お試しください",
                });
            } finally {
                setLoading(false);
            }
        }

        fetchRecognitionData();
    }, [photoUrl, mealId]);

    // データの保存処理
    const handleSave = async (data: RecognitionData) => {
        console.log("保存するデータ:", data);

        // 実際の実装では、ここでAPIにデータを送信します
        try {
            toast.success("食事が保存されました", {
                description: "ホーム画面に戻ります",
            });

            // ホーム画面に戻る
            setTimeout(() => {
                router.push("/home");
            }, 1500);
        } catch (err) {
            console.error("保存エラー:", err);
            toast.error("保存に失敗しました", {
                description: "ネットワーク接続を確認してください",
            });
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto py-6 space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto py-6">
                <div className="bg-destructive/10 p-4 rounded-lg text-destructive">
                    <h3 className="font-bold">エラーが発生しました</h3>
                    <p>{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
                    >
                        戻る
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6">
            <EnhancedRecognitionEditor
                initialData={recognitionData}
                onSave={handleSave}
                mealType={mealType}
                mealDate={mealDate}
                photoUrl={photoUrl}
                className="max-w-3xl mx-auto"
            />
        </div>
    );
} 