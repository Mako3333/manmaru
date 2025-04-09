import React from 'react';
import Link from 'next/link';
// import { Card, CardContent } from '@/components/ui/card';

interface ActionCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    href: string;
    accentColor?: string;
    bgColor?: string;
    iconBgColor?: string;
    className?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
    title,
    description,
    icon,
    href,
    accentColor = 'bg-[#2E9E6C]',
    bgColor = 'bg-white',
    iconBgColor = 'bg-[#F0F7F4]',
    className = '',
}) => {
    return (
        <Link href={href} className={`block ${className}`}>
            <div className={`rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${bgColor} relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:translate-y-[-2px] min-h-[130px] flex flex-col items-center justify-center text-center p-4`}>
                <div className={`absolute top-0 left-0 right-0 h-[6px] ${accentColor}`}></div>
                <div className={`w-12 h-12 rounded-full ${iconBgColor} flex items-center justify-center mb-2 ${accentColor === 'bg-[#2E9E6C]' ? 'text-[#2E9E6C]' : 'text-[#6A8CAF]'}`}>
                    {icon}
                </div>
                <div className="text-[16px] font-semibold mb-1">{title}</div>
                <div className="text-[12px] text-[#6C7A7D]">{description}</div>
            </div>
        </Link>
    );
}; 