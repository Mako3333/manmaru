import React, { useState } from 'react';
import { PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/20/solid';
import { ConfidenceIndicator } from './confidence-indicator';
import { FoodEditModal, FoodItem } from './food-edit-modal';

export interface FoodListEditorProps {
    /** 食品リスト */
    foodItems: FoodItem[];
    /** 食品リスト更新ハンドラー */
    onFoodListChange: (updatedFoodList: FoodItem[]) => void;
    /** 表示モード (カンパクト/フル) */
    compact?: boolean;
    /** 編集可能かどうか */
    editable?: boolean;
    /** 追加のクラス名 */
    className?: string;
}

/**
 * 食品リスト編集コンポーネント
 * 
 * 食品のリストを表示・編集するためのコンポーネント。
 * 食品の追加、編集、削除が可能です。
 */
export const FoodListEditor: React.FC<FoodListEditorProps> = ({
    foodItems,
    onFoodListChange,
    compact = false,
    editable = true,
    className = ''
}) => {
    const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 食品の編集を開始
    const handleEditFood = (food: FoodItem) => {
        setEditingFood(food);
        setIsModalOpen(true);
    };

    // 食品の更新
    const handleUpdateFood = (updatedFood: FoodItem) => {
        const newFoodItems = foodItems.map(item =>
            (item === editingFood) ? updatedFood : item
        );
        onFoodListChange(newFoodItems);
        setIsModalOpen(false);
        setEditingFood(null);
    };

    // 食品の削除
    const handleDeleteFood = () => {
        if (!editingFood) return;

        const newFoodItems = foodItems.filter(item => item !== editingFood);
        onFoodListChange(newFoodItems);
        setIsModalOpen(false);
        setEditingFood(null);
    };

    // 新しい食品の追加
    const handleAddFood = () => {
        const newFood: FoodItem = {
            name: '',
            quantity: ''
        };
        setEditingFood(newFood);
        setIsModalOpen(true);
    };

    // 新規追加の確定
    const handleConfirmAddFood = (newFood: FoodItem) => {
        if (newFood.name.trim() === '') return;

        const newFoodItems = [...foodItems, newFood];
        onFoodListChange(newFoodItems);
        setIsModalOpen(false);
        setEditingFood(null);
    };

    if (compact) {
        // コンパクト表示
        return (
            <div className={className}>
                <ul className="divide-y">
                    {foodItems.map((food, index) => (
                        <li key={index} className="py-2 flex items-center justify-between">
                            <div>
                                <div className="font-medium">{food.name}</div>
                                {food.quantity && (
                                    <div className="text-sm text-gray-500">{food.quantity}</div>
                                )}
                            </div>
                            <div className="flex items-center">
                                {food.confidence !== undefined && (
                                    <ConfidenceIndicator
                                        confidenceScore={food.confidence}
                                        size="sm"
                                        showLabel={false}
                                    />
                                )}
                                {editable && (
                                    <button
                                        onClick={() => handleEditFood(food)}
                                        className="ml-2 p-1 hover:bg-gray-100 rounded-full"
                                        aria-label="編集"
                                    >
                                        <PencilSquareIcon className="w-4 h-4 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>

                {editable && (
                    <button
                        onClick={handleAddFood}
                        className="mt-3 flex items-center justify-center w-full py-2 border border-dashed border-gray-300 rounded-md text-gray-500 hover:bg-gray-50"
                        type="button"
                    >
                        <PlusIcon className="w-4 h-4 mr-1" />
                        <span>食品を追加</span>
                    </button>
                )}

                {isModalOpen && editingFood && (
                    <FoodEditModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        food={editingFood}
                        onUpdate={editingFood.id ? handleUpdateFood : handleConfirmAddFood}
                        onDelete={editingFood.id ? handleDeleteFood : undefined}
                    />
                )}
            </div>
        );
    }

    // フル表示
    return (
        <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
            <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-medium text-gray-900">食品リスト</h3>
                {editable && (
                    <button
                        onClick={handleAddFood}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-full"
                        aria-label="食品を追加"
                        type="button"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                )}
            </div>

            <ul className="divide-y">
                {foodItems.length > 0 ? (
                    foodItems.map((food, index) => (
                        <li key={index} className="p-4 flex items-start justify-between">
                            <div>
                                <div className="font-medium text-gray-900 flex items-center">
                                    {food.name}
                                    {food.confidence !== undefined && (
                                        <ConfidenceIndicator
                                            confidenceScore={food.confidence}
                                            size="sm"
                                            showLabel={false}
                                            className="ml-2"
                                        />
                                    )}
                                </div>
                                {food.quantity && (
                                    <div className="text-sm text-gray-500 mt-1">{food.quantity}</div>
                                )}
                                {food.category && (
                                    <div className="text-xs text-gray-400 mt-1">{food.category}</div>
                                )}
                            </div>
                            {editable && (
                                <div className="flex items-center">
                                    <button
                                        onClick={() => handleEditFood(food)}
                                        className="p-1 hover:bg-gray-100 rounded-full"
                                        aria-label="編集"
                                        type="button"
                                    >
                                        <PencilSquareIcon className="w-5 h-5 text-gray-400" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingFood(food);
                                            handleDeleteFood();
                                        }}
                                        className="ml-2 p-1 hover:bg-gray-100 rounded-full"
                                        aria-label="削除"
                                        type="button"
                                    >
                                        <TrashIcon className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>
                            )}
                        </li>
                    ))
                ) : (
                    <li className="p-4 text-center text-gray-500">
                        食品が登録されていません
                    </li>
                )}
            </ul>

            {isModalOpen && editingFood && (
                <FoodEditModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    food={editingFood}
                    onUpdate={editingFood.id ? handleUpdateFood : handleConfirmAddFood}
                    onDelete={editingFood.id ? handleDeleteFood : undefined}
                />
            )}
        </div>
    );
}; 