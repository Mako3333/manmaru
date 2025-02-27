"use client";

import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Coffee, Sun, Moon, Apple } from "lucide-react";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface MealTypeSelectorProps {
    selected: MealType;
    onChange: (value: MealType) => void;
    className?: string;
    label?: string;
}

interface MealOption {
    value: MealType;
    label: string;
    icon: React.ReactNode;
    ariaLabel: string;
}

const mealOptions: MealOption[] = [
    { value: "breakfast", label: "朝食", icon: <Coffee className="h-6 w-6" />, ariaLabel: "朝食を選択" },
    { value: "lunch", label: "昼食", icon: <Sun className="h-6 w-6" />, ariaLabel: "昼食を選択" },
    { value: "dinner", label: "夕食", icon: <Moon className="h-6 w-6" />, ariaLabel: "夕食を選択" },
    { value: "snack", label: "間食", icon: <Apple className="h-6 w-6" />, ariaLabel: "間食を選択" },
];

export function MealTypeSelector({
    selected,
    onChange,
    className,
    label = "食事タイプ"
}: MealTypeSelectorProps) {
    const groupId = React.useId();

    return (
        <div className={cn("w-full", className)}>
            {label && (
                <div className="mb-3">
                    <Label id={`${groupId}-label`} className="text-base font-medium">
                        {label}
                    </Label>
                </div>
            )}
            <RadioGroup
                value={selected}
                onValueChange={(value) => onChange(value as MealType)}
                className="flex flex-row flex-wrap gap-3 justify-between"
                aria-labelledby={`${groupId}-label`}
            >
                {mealOptions.map((option) => (
                    <div key={option.value} className="flex-1 min-w-[70px]">
                        <RadioGroupItem
                            value={option.value}
                            id={`meal-type-${option.value}-${groupId}`}
                            className="peer sr-only"
                            aria-label={option.ariaLabel}
                        />
                        <Label
                            htmlFor={`meal-type-${option.value}-${groupId}`}
                            className={cn(
                                "flex flex-col items-center justify-center rounded-md border-2 border-muted p-4 hover:bg-accent hover:text-accent-foreground",
                                "cursor-pointer transition-colors",
                                "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10",
                                "min-h-[80px]",
                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                            )}
                        >
                            {option.icon}
                            <span className="mt-2 text-sm font-medium">{option.label}</span>
                        </Label>
                    </div>
                ))}
            </RadioGroup>
        </div>
    );
} 