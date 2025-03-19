'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RecipeUrlClipRequest } from '@/types/recipe';
import { Info } from 'lucide-react';

interface URLClipFormProps {
    onSubmit: (data: RecipeUrlClipRequest, isSocialMedia: boolean) => Promise<void>;
    isLoading: boolean;
    error?: string;
}

export const URLClipForm: React.FC<URLClipFormProps> = ({
    onSubmit,
    isLoading,
    error
}) => {
    const [url, setUrl] = useState('');
    const [localError, setLocalError] = useState('');

    const validateUrl = (input: string): boolean => {
        try {
            // シンプルなURL検証
            const urlObj = new URL(input);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    };

    // URLがソーシャルメディアかどうかを判定
    const isSocialMediaUrl = (url: string): boolean => {
        return url.includes('instagram.com') || url.includes('tiktok.com');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');

        // URLが空の場合
        if (!url.trim()) {
            setLocalError('URLを入力してください');
            return;
        }

        // URLの形式が正しくない場合
        if (!validateUrl(url)) {
            setLocalError('有効なURLを入力してください（例: https://recipe-site.com/recipe/12345）');
            return;
        }

        // ソーシャルメディアかどうかを判定
        const isSocial = isSocialMediaUrl(url);

        // 送信処理
        try {
            await onSubmit({ url }, isSocial);
        } catch (err) {
            // onSubmitでエラーハンドリングされない場合のフォールバック
            setLocalError('URLの処理中にエラーが発生しました。もう一度お試しください。');
        }
    };

    // 最近クリップしたURLの履歴（実装例）
    const recentUrls = [
        'https://cookpad.com/recipe/1234567',
        'https://delishkitchen.tv/recipes/987654'
    ];

    return (
        <div className="url-clip-form w-full max-w-md mx-auto p-4">
            <div className="form-header mb-6">
                <h2 className="text-xl font-bold">レシピをクリップする</h2>
                <p className="text-gray-600 text-sm mt-1">
                    レシピサイト、Instagram、TikTokのURLを入力
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-input">
                    <Input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://recipe-site.com/recipe/12345"
                        disabled={isLoading}
                        className="w-full"
                    />
                    {(localError || error) && (
                        <Alert variant="destructive" className="mt-2">
                            <AlertDescription>
                                {localError || error}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                {url && isSocialMediaUrl(url) && (
                    <Alert variant="info" className="bg-blue-50">
                        <Info className="h-4 w-4" />
                        <AlertTitle>ソーシャルメディアのレシピ</AlertTitle>
                        <AlertDescription className="text-xs">
                            Instagram/TikTokのレシピは材料を手動で入力する必要があります。
                        </AlertDescription>
                    </Alert>
                )}

                <Button
                    type="submit"
                    className="clip-button w-full"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Spinner className="mr-2" size="sm" />
                            クリップ中...
                        </>
                    ) : (
                        'クリップする'
                    )}
                </Button>
            </form>

            {isLoading && (
                <div className="loading-indicator mt-6 text-center">
                    <div className="animate-pulse text-blue-600 font-medium">
                        レシピ情報を解析中...
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                        ページの内容によって処理時間が異なります
                    </p>
                </div>
            )}

            {/* 最近クリップしたURL履歴 */}
            {!isLoading && recentUrls.length > 0 && (
                <div className="recent-urls mt-8">
                    <h3 className="text-sm font-medium text-gray-700">最近クリップしたURL</h3>
                    <ul className="mt-2 space-y-1">
                        {recentUrls.map((recentUrl, idx) => (
                            <li key={idx} className="text-xs">
                                <button
                                    type="button"
                                    className="text-blue-600 hover:text-blue-800 truncate max-w-full block"
                                    onClick={() => setUrl(recentUrl)}
                                    disabled={isLoading}
                                >
                                    {recentUrl}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}; 