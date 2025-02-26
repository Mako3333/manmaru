import React from 'react';
import Image from 'next/image';

interface ProgressCardProps {
    pregnancyWeek: number;
    dueDate: string;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({ pregnancyWeek, dueDate }) => {
    // 妊娠週数に応じた赤ちゃんの情報
    const getBabyInfo = (week: number) => {
        if (week <= 12) {
            return {
                size: '約5-6cm',
                weight: '約14g',
                description: '指や爪が形成され始めています。',
                image: '/images/baby-first-trimester.png'
            };
        } else if (week <= 27) {
            return {
                size: '約30-35cm',
                weight: '約650g',
                description: '目を開けたり閉じたりできるようになっています。',
                image: '/images/baby-second-trimester.png'
            };
        } else {
            return {
                size: '約45-50cm',
                weight: '約2500-3000g',
                description: '肺が成熟し、出産の準備が整ってきています。',
                image: '/images/baby-third-trimester.png'
            };
        }
    };

    const babyInfo = getBabyInfo(pregnancyWeek);

    // 出産予定日までの日数
    const calculateDaysLeft = (dueDate: string) => {
        const due = new Date(dueDate);
        const today = new Date();
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    const daysLeft = calculateDaysLeft(dueDate);

    // 進捗バーの計算（40週を100%として）
    const progressPercentage = Math.min((pregnancyWeek / 40) * 100, 100);

    return (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-green-100">
            <div className="bg-gradient-to-r from-green-500 to-green-400 p-4 text-white">
                <h2 className="font-bold text-xl">妊娠 {pregnancyWeek} 週目</h2>
                <p className="text-green-50">出産予定日まであと {daysLeft} 日</p>
            </div>

            <div className="p-4">
                <div className="flex items-center space-x-4">
                    <div className="w-24 h-24 relative rounded-full bg-green-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {/* 画像ファイルが存在しない場合のフォールバック */}
                        {babyInfo.image ? (
                            <Image
                                src={babyInfo.image}
                                alt={`妊娠${pregnancyWeek}週の赤ちゃん`}
                                fill
                                className="object-contain p-2"
                                onError={(e) => {
                                    // 画像読み込みエラー時の処理
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <span className="text-3xl">👶</span>
                        )}
                    </div>

                    <div className="flex-grow">
                        <h3 className="font-semibold text-gray-800">赤ちゃんの成長</h3>
                        <p className="text-sm text-gray-600 mb-1">
                            大きさ: {babyInfo.size} / 体重: {babyInfo.weight}
                        </p>
                        <p className="text-sm text-gray-600">{babyInfo.description}</p>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>0週</span>
                        <span>20週</span>
                        <span>40週</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                            className="bg-green-500 h-2.5 rounded-full"
                            style={{ width: `${progressPercentage}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
}; 