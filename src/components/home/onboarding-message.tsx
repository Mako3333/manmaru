import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface OnboardingMessageProps {
    onDismiss: () => void;
}

export function OnboardingMessage({ onDismiss }: OnboardingMessageProps) {
    const router = useRouter();

    return (
        <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="pt-4 pb-3">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-start">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-1">
                            <span role="img" aria-label="wave" className="text-lg">👋</span>
                        </div>
                        <div>
                            <h3 className="font-medium text-blue-900">manmaruへようこそ！</h3>
                            <p className="text-sm text-blue-700 mt-1">
                                妊娠中の栄養管理をサポートする機能が揃っています
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1"
                        onClick={onDismiss}
                    >
                        <X className="h-4 w-4 text-gray-500" />
                    </Button>
                </div>

                {/* 機能説明部分 */}
                <div className="space-y-3 mb-4">
                    {/* 機能1: 食事記録 */}
                    <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-2">
                            <span className="text-green-600 text-sm">1</span>
                        </div>
                        <p className="text-sm">
                            <span className="font-medium">食事を記録</span>して栄養バランスを確認できます
                        </p>
                    </div>

                    {/* 機能2: レシピクリップ */}
                    <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-2">
                            <span className="text-green-600 text-sm">2</span>
                        </div>
                        <p className="text-sm">
                            <span className="font-medium">レシピをクリップ</span>して後で簡単に食事記録できます
                        </p>
                    </div>

                    {/* 機能3: 栄養アドバイス */}
                    <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-2">
                            <span className="text-green-600 text-sm">3</span>
                        </div>
                        <p className="text-sm">
                            <span className="font-medium">妊娠週数に応じた</span>栄養アドバイスが受けられます
                        </p>
                    </div>
                </div>

                {/* アクションボタン */}
                <div className="flex gap-2">
                    <Button
                        variant="default"
                        className="flex-1"
                        onClick={() => router.push('/meals/log')}
                    >
                        最初の食事を記録
                    </Button>
                    <Button
                        variant="outline"
                        className="flex-shrink-0"
                        onClick={onDismiss}
                    >
                        後で
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
} 