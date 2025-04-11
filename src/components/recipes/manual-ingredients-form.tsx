'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RecipeIngredient } from '@/types/recipe';
import { Plus, Trash2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ManualIngredientsFormProps {
    ingredients: RecipeIngredient[];
    onChange: (ingredients: RecipeIngredient[]) => void;
    servings: number;
    onServingsChange: (servings: number) => void;
}

export const ManualIngredientsForm: React.FC<ManualIngredientsFormProps> = ({
    ingredients,
    onChange,
    servings,
    onServingsChange
}) => {
    // 空の材料を追加する関数を useCallback でメモ化
    const addIngredient = useCallback(() => {
        const newIngredients = [
            ...ingredients,
            { name: '', quantity: '' }
        ];
        onChange(newIngredients);
        // ingredients と onChange に依存
    }, [ingredients, onChange]);

    // 材料を削除する関数 (useCallback 追加)
    const removeIngredient = useCallback((index: number) => {
        const newIngredients = ingredients.filter((_, i) => i !== index);
        onChange(newIngredients);
    }, [ingredients, onChange]);

    // 材料名の更新 (useCallback 追加)
    const updateIngredientName = useCallback((index: number, name: string) => {
        const newIngredients = [...ingredients];
        newIngredients[index] = { ...newIngredients[index], name };
        onChange(newIngredients);
    }, [ingredients, onChange]);

    // 材料の量の更新 (useCallback 追加)
    const updateIngredientQuantity = useCallback((index: number, quantity: string) => {
        const newIngredients = [...ingredients];
        const currentIngredient = newIngredients[index];
        if (currentIngredient) {
            newIngredients[index] = { ...currentIngredient, quantity };
            onChange(newIngredients);
        }
    }, [ingredients, onChange]);

    // 人数の変更 (useCallback 追加)
    const handleServingsChange = useCallback((value: string) => {
        onServingsChange(Number(value));
    }, [onServingsChange]);

    // 初期状態が空の場合、一行追加
    React.useEffect(() => {
        if (ingredients.length === 0) {
            addIngredient(); // メモ化された関数を使用
        }
    }, [addIngredient, ingredients.length]);

    return (
        <div className="manual-ingredients-form space-y-4">
            <div className="servings-selector mb-4">
                <label className="text-sm font-medium block mb-2">このレシピは何人前ですか？</label>
                <Select
                    value={String(servings)}
                    onValueChange={handleServingsChange}
                >
                    <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="人数を選択" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1人前</SelectItem>
                        <SelectItem value="2">2人前</SelectItem>
                        <SelectItem value="3">3人前</SelectItem>
                        <SelectItem value="4">4人前</SelectItem>
                        <SelectItem value="5">5人前</SelectItem>
                        <SelectItem value="6">6人前</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                    ※ 設定した人数に基づいて1人前の栄養価を計算します
                </p>
            </div>

            <div className="ingredients-list space-y-2">
                <label className="text-sm font-medium block mb-2">材料リスト</label>
                {ingredients.map((ingredient, index) => (
                    <div key={index} className="ingredient-row flex items-center space-x-2">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={ingredient.name}
                                onChange={(e) => updateIngredientName(index, e.target.value)}
                                placeholder="材料名"
                                className="w-full p-2 border rounded text-sm"
                            />
                        </div>
                        <div className="w-24">
                            <input
                                type="text"
                                value={ingredient.quantity}
                                onChange={(e) => updateIngredientQuantity(index, e.target.value)}
                                placeholder="分量"
                                className="w-full p-2 border rounded text-sm"
                            />
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeIngredient(index)}
                            disabled={ingredients.length === 1}
                            className="text-gray-500 hover:text-red-500"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addIngredient}
                className="w-full mt-2"
            >
                <Plus className="h-4 w-4 mr-1" />
                材料を追加
            </Button>
        </div>
    );
}; 