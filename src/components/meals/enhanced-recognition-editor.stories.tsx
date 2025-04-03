import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { EnhancedRecognitionEditor } from './enhanced-recognition-editor';
import { StandardizedMealNutrition, Nutrient, NutrientUnit } from '@/types/nutrition';

// APIに送信する食品アイテムの型定義
interface ApiFood {
    name: string;
    quantity: string;
    confidence: number;
}

// 解析結果データの型定義
export interface RecognitionData {
    foods: ApiFood[];
    nutrition: StandardizedMealNutrition;
}

// 栄養素作成ヘルパー
const createNutrient = (name: string, value: number, unit: NutrientUnit): Nutrient => ({
    name,
    value,
    unit,
});

// モックデータ (StandardizedMealNutrition 形式)
const mockInitialData: RecognitionData = {
    foods: [
        { name: 'ほうれん草', quantity: '1束', confidence: 0.95 },
        { name: 'にんじん', quantity: '1本', confidence: 0.85 },
        { name: '豆腐', quantity: '1パック', confidence: 0.75 },
        { name: 'ごはん', quantity: '1杯', confidence: 0.9 }
    ],
    nutrition: {
        totalCalories: 450,
        totalNutrients: [
            createNutrient('たんぱく質', 15, 'g'),
            createNutrient('鉄分', 6.5, 'mg'),
            createNutrient('葉酸', 250, 'mcg'),
            createNutrient('カルシウム', 300, 'mg'),
            createNutrient('ビタミンD', 3.5, 'mcg'),
        ],
        foodItems: [], // Storybook表示では簡易的に空でOK
        pregnancySpecific: {
            folatePercentage: (250 / 400) * 100,
            ironPercentage: (6.5 / 20) * 100,
            calciumPercentage: (300 / 800) * 100,
        }
    }
};

// 低確信度のモックデータ
const mockLowConfidenceData: RecognitionData = {
    foods: [
        { name: '何らかの野菜', quantity: '1個', confidence: 0.4 },
        { name: '不明な魚', quantity: '1切れ', confidence: 0.3 },
        { name: 'サラダ', quantity: '1皿', confidence: 0.6 },
        { name: 'スープ', quantity: '1杯', confidence: 0.65 }
    ],
    nutrition: {
        totalCalories: 400,
        totalNutrients: [
            createNutrient('たんぱく質', 12, 'g'),
            createNutrient('鉄分', 4.5, 'mg'),
            createNutrient('葉酸', 200, 'mcg'),
            createNutrient('カルシウム', 250, 'mg'),
        ],
        foodItems: [],
        pregnancySpecific: {
            folatePercentage: (200 / 400) * 100,
            ironPercentage: (4.5 / 20) * 100,
            calciumPercentage: (250 / 800) * 100,
        }
    }
};

// 栄養不足のモックデータ
const mockDeficiencyData: RecognitionData = {
    foods: [
        { name: 'パスタ', quantity: '1皿', confidence: 0.9 },
        { name: 'トマトソース', quantity: '大さじ3', confidence: 0.8 },
        { name: 'チーズ', quantity: '少々', confidence: 0.85 }
    ],
    nutrition: {
        totalCalories: 550,
        totalNutrients: [
            createNutrient('たんぱく質', 18, 'g'),
            createNutrient('鉄分', 2.5, 'mg'), // 不足
            createNutrient('葉酸', 150, 'mcg'), // 不足
            createNutrient('カルシウム', 200, 'mg'), // 不足
            createNutrient('ビタミンD', 1.2, 'mcg'), // 不足
        ],
        foodItems: [],
        pregnancySpecific: {
            folatePercentage: (150 / 400) * 100,
            ironPercentage: (2.5 / 20) * 100,
            calciumPercentage: (200 / 800) * 100,
        }
    }
};

// 食品なしのモックデータ
const mockEmptyData: RecognitionData = {
    foods: [],
    nutrition: {
        totalCalories: 0,
        totalNutrients: [],
        foodItems: [],
        pregnancySpecific: {
            folatePercentage: 0,
            ironPercentage: 0,
            calciumPercentage: 0,
        }
    }
};

const meta: Meta<typeof EnhancedRecognitionEditor> = {
    title: 'Meals/EnhancedRecognitionEditor',
    component: EnhancedRecognitionEditor,
    parameters: {
        layout: 'fullscreen',
    },
    tags: ['autodocs'],
    argTypes: {
        initialData: {
            description: '初期データ（食品リストと栄養情報）',
        },
        mealType: {
            description: '食事の種類（朝食、昼食、夕食など）',
            control: 'select',
            options: ['breakfast', 'lunch', 'dinner', 'snack'],
        },
        mealDate: {
            description: '食事の日付（YYYY-MM-DD形式）',
        },
        photoUrl: {
            description: '食事の写真URL',
        },
    },
};

export default meta;
type Story = StoryObj<typeof EnhancedRecognitionEditor>;

// 標準的な認識結果を表示するストーリー
export const Default: Story = {
    args: {
        initialData: mockInitialData,
        mealType: 'dinner',
        mealDate: '2023-07-15',
        photoUrl: 'https://example.com/meal-photo.jpg',
        onSave: (data: RecognitionData) => console.log('保存されたデータ:', data),
    },
};

// 低確信度のデータを表示するストーリー
export const LowConfidence: Story = {
    args: {
        initialData: mockLowConfidenceData,
        mealType: 'lunch',
        mealDate: '2023-07-15',
        onSave: (data: RecognitionData) => console.log('保存されたデータ:', data),
    },
};

// 栄養不足を示すデータを表示するストーリー
export const WithDeficiencies: Story = {
    args: {
        initialData: mockDeficiencyData,
        mealType: 'breakfast',
        mealDate: '2023-07-15',
        onSave: (data: RecognitionData) => console.log('保存されたデータ:', data),
    },
};

// 空の食品リストを表示するストーリー
export const EmptyFoodList: Story = {
    args: {
        initialData: mockEmptyData,
        mealType: 'snack',
        mealDate: '2023-07-15',
        onSave: (data: RecognitionData) => console.log('保存されたデータ:', data),
    },
}; 