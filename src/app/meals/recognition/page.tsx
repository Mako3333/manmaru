"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { EnhancedRecognitionEditor } from "@/components/meals/enhanced-recognition-editor";
import { RecognitionEditor } from "@/components/meals/recognition-editor";

// API食品アイテムの型定義
interface ApiFood {
    name: string;
    quantity: string;
    confidence: number;
}

// 栄養情報の型定義
interface Nutrition {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d?: number;
    confidence_score: number;
}

// 解析結果データの型定義
interface RecognitionData {
    foods: ApiFood[];
    nutrition: Nutrition;
}

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

    // モックデータ（通常はAPIから取得）
    const mockRecognitionData: RecognitionData = {
        foods: [
            { name: "ほうれん草", quantity: "1束", confidence: 0.92 },
            { name: "にんじん", quantity: "1本", confidence: 0.89 },
            { name: "豆腐", quantity: "1パック", confidence: 0.85 },
            { name: "ごはん", quantity: "1杯", confidence: 0.95 }
        ],
        nutrition: {
            calories: 450,
            protein: 15,
            iron: 6.5,
            folic_acid: 250,
            calcium: 300,
            vitamin_d: 3.5,
            confidence_score: 0.85
        }
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
                    onSave={(data: RecognitionData) => {
                        console.log("保存データ:", data);
                        // 保存後にリダイレクト
                        router.push("/home");
                    }}
                    mealType={mealType}
                    mealDate={mealDate}
                    photoUrl={photoUrl}
                    className="max-w-4xl mx-auto"
                />
            ) : (
                <div className="max-w-4xl mx-auto">
                    <RecognitionEditor
                        initialData={mockRecognitionData}
                        onSave={(data: RecognitionData) => {
                            console.log("保存データ (従来版):", data);
                            // 保存後にリダイレクト
                            router.push("/home");
                        }}
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