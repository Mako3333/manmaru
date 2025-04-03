'use client';

import React from 'react';
import Image from 'next/image';

interface SocialMediaPlaceholderProps {
    platform: 'Instagram' | 'TikTok' | 'other';
    title?: string;
    onClick?: () => void;
}

export const SocialMediaPlaceholder: React.FC<SocialMediaPlaceholderProps> = ({
    platform,
    title = 'レシピ',
    onClick
}) => {
    // プラットフォームに応じた色とアイコン
    const bgColor = platform === 'Instagram'
        ? 'bg-gradient-to-tr from-purple-500 via-pink-600 to-orange-400'
        : 'bg-black';
    const iconPath = `/icons/${platform.toLowerCase()}.svg`;

    return (
        <div
            className={`w-full aspect-video rounded-lg overflow-hidden flex items-center justify-center ${bgColor} ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <div className="flex flex-col items-center p-4 text-white">
                <div className="relative w-12 h-12 mb-3">
                    <Image
                        src={iconPath}
                        alt={platform}
                        width={48}
                        height={48}
                        className="object-contain"
                    />
                </div>
                <h3 className="text-lg font-semibold text-center">{title}</h3>
                <p className="text-sm opacity-80 mt-1">{platform}のレシピ</p>
            </div>
        </div>
    );
}; 