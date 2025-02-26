import React from 'react';
import Link from 'next/link';

interface DailyRecordCardProps {
    title: string;
    icon: string;
    description: string;
    linkHref: string;
    color: string;
}

export const DailyRecordCard: React.FC<DailyRecordCardProps> = ({
    title,
    icon,
    description,
    linkHref,
    color
}) => {
    return (
        <Link href={linkHref}>
            <div className={`${color} rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200`}>
                <div className="flex items-center space-x-3">
                    <div className="text-2xl">{icon}</div>
                    <div>
                        <h3 className="font-semibold text-gray-800">{title}</h3>
                        <p className="text-sm text-gray-600">{description}</p>
                    </div>
                </div>
            </div>
        </Link>
    );
}; 