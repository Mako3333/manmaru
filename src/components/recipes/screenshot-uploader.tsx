'use client';

import React, { useState, useRef } from 'react';
import { Camera, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface ScreenshotUploaderProps {
    onImageCapture: (imageData: string) => void;
    initialImage?: string;
}

export const ScreenshotUploader: React.FC<ScreenshotUploaderProps> = ({
    onImageCapture,
    initialImage
}) => {
    const [previewImage, setPreviewImage] = useState<string | undefined>(initialImage);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 画像ファイルのみを許可
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください');
            return;
        }

        // 10MBの制限
        if (file.size > 10 * 1024 * 1024) {
            alert('10MB以下の画像を選択してください');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                const imageData = event.target.result as string;
                setPreviewImage(imageData);
                onImageCapture(imageData);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="screenshot-uploader">
            {previewImage ? (
                <div className="relative w-full aspect-video rounded overflow-hidden">
                    <div className="w-full h-full">
                        <img
                            src={previewImage}
                            alt="レシピのスクリーンショット"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="absolute bottom-2 right-2"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        変更
                    </Button>
                </div>
            ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <div className="flex flex-col items-center">
                        <div className="mb-3">
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                スクリーンショットをアップロード
                            </Button>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                            スクリーンショットをアップロードすることもできます
                        </p>
                    </div>
                </div>
            )}
            <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
        </div>
    );
}; 