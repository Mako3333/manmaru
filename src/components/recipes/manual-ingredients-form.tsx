'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RecipeIngredient } from '@/types/recipe';
import { Plus, Trash2 } from 'lucide-react';

interface ManualIngredientsFormProps {
    ingredients: RecipeIngredient[];
    onChange: (ingredients: RecipeIngredient[]) => void;
}

export const ManualIngredientsForm: React.FC<ManualIngredientsFormProps> = ({
    ingredients,
    onChange
}) => {
    // 空の材料を追加する関数
    const addIngredient = () => {
        const newIngredients = [
            ...ingredients,
            { name: '', quantity: '' }
        ];
        onChange(newIngredients);
    };

    // 材料を削除する関数
    const removeIngredient = (index: number) => {
        const newIngredients = ingredients.filter((_, i) => i !== index);
        onChange(newIngredients);
    };

    // 材料名の更新
    const updateIngredientName = (index: number, name: string) => {
        const newIngredients = [...ingredients];
        newIngredients[index] = { ...newIngredients[index], name };
        onChange(newIngredients);
    };

    // 材料の量の更新
    const updateIngredientQuantity = (index: number, quantity: string) => {
        const newIngredients = [...ingredients];
        newIngredients[index] = { ...newIngredients[index], quantity };
        onChange(newIngredients);
    };

    // 初期状態が空の場合、一行追加
    React.useEffect(() => {
        if (ingredients.length === 0) {
            addIngredient();
        }
    }, []);

    return (
        <div className="manual-ingredients-form space-y-2">
            <div className="ingredients-list space-y-2">
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

            <div className="text-xs text-gray-500 mt-1">
                ※ 材料と分量を入力してください。栄養素情報は後で自動計算されます。
            </div>
        </div>
    );
}; 