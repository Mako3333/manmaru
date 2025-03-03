import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

interface ActionCardProps {
    title: string;
    description: string;
    icon: string;
    href: string;
    color?: string;
    className?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
    title,
    description,
    icon,
    href,
    color = 'bg-green-100 text-green-800 border-green-200',
    className = '',
}) => {
    return (
        <Link href={href} className={`block ${className}`}>
            <Card className="h-full transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
                <CardContent className={`flex items-center gap-4 p-4 ${color}`}>
                    <div className="text-3xl">{icon}</div>
                    <div>
                        <h3 className="font-semibold">{title}</h3>
                        <p className="text-sm opacity-80">{description}</p>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}; 