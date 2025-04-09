"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EnhancedRecognitionEditor } from "@/components/meals/enhanced-recognition-editor";
import { RecognitionEditor } from "@/components/meals/recognition-editor";
import { StandardizedMealNutrition, Nutrient, NutrientUnit } from "@/types/nutrition";

// API食品アイテムの型定義
interface ApiFood {
    name: string;
    quantity: string;
    confidence: number;
}

// 栄養情報の型定義 (レガシー用)
interface LegacyNutrition {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d?: number;
    confidence_score: number;
}

// 解析結果データの型定義 (レガシー用)
interface LegacyRecognitionData {
    foods: ApiFood[];
    nutrition: LegacyNutrition;
}

// 解析結果データの型定義 (新しいStandardizedNutrition用)
interface RecognitionData {
    foods: ApiFood[];
    nutrition: StandardizedMealNutrition;
}

// モックデータ (StandardizedMealNutrition 形式)
const mockStandardizedNutrition: StandardizedMealNutrition = {
    totalCalories: 650,
    totalNutrients: [
        { name: "タンパク質", value: 30, unit: "g", percentDailyValue: 60 },
        { name: "脂質", value: 22, unit: "g", percentDailyValue: 33 },
        { name: "炭水化物", value: 80, unit: "g", percentDailyValue: 27 },
        { name: "食物繊維", value: 8, unit: "g", percentDailyValue: 32 },
        { name: "糖質", value: 12, unit: "g", percentDailyValue: 13 },
        { name: "ナトリウム", value: 800, unit: "mg", percentDailyValue: 35 },
        { name: "カルシウム", value: 300, unit: "mg", percentDailyValue: 30 },
        { name: "鉄分", value: 4, unit: "mg", percentDailyValue: 22 },
        { name: "ビタミンA", value: 450, unit: "mcg", percentDailyValue: 50 },
        { name: "ビタミンC", value: 80, unit: "mg", percentDailyValue: 88 },
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
};

// モックデータ (レガシー形式)
const mockLegacyNutrition: LegacyNutrition = {
    calories: 450,
    protein: 15,
    iron: 6.5,
    folic_acid: 250,
    calcium: 300,
    vitamin_d: 3.5,
    confidence_score: 0.85
};

const mockFoods: ApiFood[] = [
    { name: "ほうれん草", quantity: "1束", confidence: 0.92 },
    { name: "にんじん", quantity: "1本", confidence: 0.89 },
    { name: "豆腐", quantity: "1パック", confidence: 0.85 },
    { name: "ごはん", quantity: "1杯", confidence: 0.95 }
];

// モックデータ (新しい形式)
const mockRecognitionData: RecognitionData = {
    foods: mockFoods,
    nutrition: mockStandardizedNutrition
};

// モックデータ (レガシー形式)
const mockLegacyRecognitionData: LegacyRecognitionData = {
    foods: mockFoods,
    nutrition: mockLegacyNutrition
};

export default function RecognitionPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [editorVersion, setEditorVersion] = useState<string>("enhanced");

    // URLパラメータからエディタバージョンを取得
    useEffect(() => {
        const version = searchParams.get("version");
        if (version === "classic" || version === "enhanced") {
            setEditorVersion(version);
        }
    }, [searchParams]);

    // 写真ID、食事タイプ、日付の取得
    const photoId = searchParams.get("photo_id");
    const mealType = searchParams.get("meal_type") || "dinner";
    const mealDate = searchParams.get("meal_date") || new Date().toISOString().split('T')[0];
    const photoUrl = searchParams.get("photo_url") || undefined;

    // エディタバージョンの切り替え
    const handleVersionChange = (value: string) => {
        setEditorVersion(value);

        // URLパラメータを更新
        const params = new URLSearchParams(searchParams);
        params.set("version", value);

        // 現在のページにリダイレクト（URLパラメータ更新）
        router.push(`/meals/recognition?${params.toString()}`);
    };

    // 保存ハンドラーの型を修正
    const handleSave = (data: RecognitionData | LegacyRecognitionData) => {
        console.log(`保存データ (${editorVersion}):`, data);
        // 保存後にリダイレクト
        router.push("/home");
    };

    return (
        <div className="container mx-auto py-6">
            <Card className="mb-6">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>食品認識システム</CardTitle>
                        <Select value={editorVersion} onValueChange={handleVersionChange}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="エディタバージョン" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="classic">従来版</SelectItem>
                                <SelectItem value="enhanced">強化版</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <CardDescription>
                        食事の写真から食品を認識し、栄養情報を計算します。
                        {editorVersion === "enhanced" && " 強化版では栄養素の信頼性指標と詳細な栄養分析が利用できます。"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-2">
                    <div className="text-sm text-muted-foreground">
                        <p className="mb-2">
                            <strong>食事タイプ:</strong> {mealType === "breakfast" ? "朝食" : mealType === "lunch" ? "昼食" : mealType === "dinner" ? "夕食" : "間食"}
                        </p>
                        <p className="mb-2">
                            <strong>日付:</strong> {mealDate}
                        </p>
                        {photoId && (
                            <p className="mb-2">
                                <strong>写真ID:</strong> {photoId}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* エディタバージョンに応じてコンポーネントを切り替え */}
            {editorVersion === "enhanced" ? (
                <EnhancedRecognitionEditor
                    initialData={mockRecognitionData}
                    onSave={handleSave as any}
                    mealType={mealType}
                    mealDate={mealDate}
                    photoUrl={photoUrl}
                    className="max-w-4xl mx-auto"
                />
            ) : (
                <div className="max-w-4xl mx-auto">
                    <RecognitionEditor
                        initialData={mockLegacyRecognitionData as any}
                        onSave={handleSave as any}
                        mealType={mealType}
                        mealDate={mealDate}
                        photoUrl={photoUrl}
                    />
                </div>
            )}

            <div className="flex justify-center mt-6">
                <Button
                    variant="outline"
                    onClick={() => router.back()}
                    className="mr-4"
                >
                    戻る
                </Button>
                <Button
                    variant="outline"
                    onClick={() => router.push("/home")}
                >
                    ホームへ
                </Button>
            </div>
        </div>
    );
} 