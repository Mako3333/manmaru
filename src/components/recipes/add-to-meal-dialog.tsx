"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import { MealType } from "@/types/nutrition";
import { ClippedRecipe } from "@/types/recipe";
import { AppError } from "@/lib/error/types/base-error";
import { ErrorCode } from "@/lib/error/codes/error-codes";
import { handleError } from "@/lib/error/utils";

interface AddToMealDialogProps {
    isOpen: boolean;
    onClose: () => void;
    recipe: ClippedRecipe;
}

export function AddToMealDialog({ isOpen, onClose, recipe }: AddToMealDialogProps) {
    const [date, setDate] = useState<Date>(new Date());
    const [mealType, setMealType] = useState<string>(MealType.DINNER);
    const [portionSize, setPortionSize] = useState<number>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    // 食事記録への追加処理
    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);

            const response = await fetch('/api/meals/from-recipe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipe_id: recipe.id,
                    meal_type: mealType,
                    portion_size: portionSize,
                    meal_date: format(date, 'yyyy-MM-dd'),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                // AppError 形式を考慮してエラーを生成
                throw new AppError({
                    code: errorData?.error?.code || ErrorCode.Base.API_ERROR,
                    message: errorData?.error?.message || '食事記録の保存に失敗しました',
                    userMessage: errorData?.error?.userMessage || errorData?.message || '食事記録の追加に失敗しました。',
                    details: errorData?.error?.details
                });
            }

            const data = await response.json();
            toast.success('食事記録に追加しました');
            onClose();
            router.refresh();
        } catch (error: unknown) {
            console.error('食事記録追加エラー:', error);
            handleError(error, {
                showToast: true,
                toastOptions: { title: '食事記録追加エラー' }
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>食事記録に追加</DialogTitle>
                    <DialogDescription>
                        「{recipe.title}」を食事記録に追加します。
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* 日付選択 */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label htmlFor="meal-date" className="text-right text-sm font-medium">
                            日付
                        </label>
                        <div className="col-span-3">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="meal-date"
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? (
                                            format(date, "yyyy年MM月dd日 (eee)", { locale: ja })
                                        ) : (
                                            <span>日付を選択</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(date: Date | undefined) => date && setDate(date)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* 食事タイプ選択 */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label htmlFor="meal-type" className="text-right text-sm font-medium">
                            食事
                        </label>
                        <Select
                            value={mealType}
                            onValueChange={setMealType}
                        >
                            <SelectTrigger id="meal-type" className="col-span-3">
                                <SelectValue placeholder="食事を選択" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={MealType.BREAKFAST}>朝食</SelectItem>
                                <SelectItem value={MealType.LUNCH}>昼食</SelectItem>
                                <SelectItem value={MealType.DINNER}>夕食</SelectItem>
                                <SelectItem value={MealType.SNACK}>間食</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 分量選択 */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label htmlFor="portion-size" className="text-right text-sm font-medium">
                            分量
                        </label>
                        <div className="col-span-3 space-y-2">
                            <Slider
                                id="portion-size"
                                min={0.25}
                                max={2}
                                step={0.25}
                                value={[portionSize]}
                                onValueChange={(values: number[]) => {
                                    if (values.length > 0 && values[0] !== undefined) {
                                        setPortionSize(values[0]);
                                    }
                                }}
                            />
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>少なめ</span>
                                <span className="font-medium text-green-600">
                                    {portionSize === 1
                                        ? "レシピ通り"
                                        : portionSize < 1
                                            ? `${portionSize * 100}%`
                                            : `${portionSize}人前`}
                                </span>
                                <span>多め</span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        キャンセル
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "保存中..." : "食事に追加"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 