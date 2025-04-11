"use client";
//src\components\meals\meal-photo-input.tsx
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { encodeImageToBase64 } from "@/lib/utils/image-utils";
import { CameraIcon, TrashIcon, CheckCircleIcon, ExclamationCircleIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface MealPhotoInputProps {
    onPhotoCapture: (file: File, base64: string) => void;
    isLoading?: boolean;
    className?: string;
}

export function MealPhotoInput({
    onPhotoCapture,
    isLoading = false,
    className,
}: MealPhotoInputProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 画像ファイルを処理する関数
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            // ファイルサイズチェック (10MB以下)
            if (file.size > 10 * 1024 * 1024) {
                setError("ファイルサイズが大きすぎます（10MB以下にしてください）");
                return;
            }

            // 画像ファイルかどうかチェック
            if (!file.type.startsWith("image/")) {
                setError("画像ファイルを選択してください");
                return;
            }

            setError(null);

            // Base64に変換
            const base64 = await encodeImageToBase64(file);

            // プレビュー用URLを設定
            setPreviewUrl(base64);

            // 親コンポーネントに通知
            onPhotoCapture(file, base64);
        } catch (err) {
            console.error("画像処理エラー:", err);
            setError("画像の処理中にエラーが発生しました");
        }
    };

    // カメラで撮影ボタンのクリックハンドラ
    const handleCameraClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = "image/*;capture=camera";
            fileInputRef.current.click();
        }
    };

    // 写真を選択ボタンのクリックハンドラ
    const handleGalleryClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = "image/*";
            fileInputRef.current.click();
        }
    };

    // 画像をクリアする関数
    const clearImage = () => {
        setPreviewUrl(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className={cn("w-full space-y-4", className)}>
            <div className="flex flex-col space-y-2">
                <Label htmlFor="meal-photo" className="text-base font-medium">
                    食事の写真
                </Label>

                {/* 画像プレビュー */}
                {previewUrl ? (
                    <div className="relative w-full aspect-video overflow-hidden rounded-lg">
                        <Image
                            src={previewUrl}
                            alt="アップロードされた食事の写真プレビュー"
                            layout="fill"
                            objectFit="cover"
                            className="rounded-lg"
                        />
                        {!isLoading && (
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute right-2 top-2 h-8 w-8 rounded-full"
                                onClick={clearImage}
                                aria-label="画像を削除"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={handleCameraClick}
                            disabled={isLoading}
                        >
                            <Camera className="mr-2 h-5 w-5" />
                            カメラで撮影
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={handleGalleryClick}
                            disabled={isLoading}
                        >
                            <ImageIcon className="mr-2 h-5 w-5" />
                            写真を選択
                        </Button>
                    </div>
                )}

                {/* エラーメッセージ */}
                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}

                {/* 非表示の画像入力フィールド */}
                <input
                    ref={fileInputRef}
                    id="meal-photo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isLoading}
                />
            </div>
        </div>
    );
} 