import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { EnhancedRecognitionEditor } from './enhanced-recognition-editor';

// APIに送信する食品アイテムの型定義
interface ApiFood {
    name: string;
    quantity: string;
    confidence: number;
}

// 栄養情報の型定義
interface Nutrition {
    calories: number;
    protein: number;
    iron: number;
    folic_acid: number;
    calcium: number;
    vitamin_d?: number;
    confidence_score: number;
}

// 解析結果データの型定義
export interface RecognitionData {
    foods: ApiFood[];
    nutrition: Nutrition;
}

// モックデータ
const mockInitialData: RecognitionData = {
    foods: [
        { name: 'ほうれん草', quantity: '1束', confidence: 0.95 },
        { name: 'にんじん', quantity: '1本', confidence: 0.85 },
        { name: '豆腐', quantity: '1パック', confidence: 0.75 },
        { name: 'ごはん', quantity: '1杯', confidence: 0.9 }
    ],
    nutrition: {
        calories: 450,
        protein: 15,
        iron: 6.5,
        folic_acid: 250,
        calcium: 300,
        vitamin_d: 3.5,
        confidence_score: 0.85
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
        calories: 400,
        protein: 12,
        iron: 4.5,
        folic_acid: 200,
        calcium: 250,
        confidence_score: 0.5
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
        calories: 550,
        protein: 18,
        iron: 2.5, // 鉄分不足
        folic_acid: 150, // 葉酸不足
        calcium: 200, // カルシウム不足
        vitamin_d: 1.2, // ビタミンD不足
        confidence_score: 0.8
    }
};

// 食品なしのモックデータ
const mockEmptyData: RecognitionData = {
    foods: [],
    nutrition: {
        calories: 0,
        protein: 0,
        iron: 0,
        folic_acid: 0,
        calcium: 0,
        confidence_score: 0
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
        initialData: mockInitialData as any, // 型が完全に一致しない場合の一時的な対応
        mealType: 'dinner',
        mealDate: '2023-07-15',
        photoUrl: 'https://example.com/meal-photo.jpg',
        onSave: (data: RecognitionData) => console.log('保存されたデータ:', data),
    },
};

// 低確信度のデータを表示するストーリー
export const LowConfidence: Story = {
    args: {
        initialData: mockLowConfidenceData as any, // 型が完全に一致しない場合の一時的な対応
        mealType: 'lunch',
        mealDate: '2023-07-15',
        onSave: (data: RecognitionData) => console.log('保存されたデータ:', data),
    },
};

// 栄養不足を示すデータを表示するストーリー
export const WithDeficiencies: Story = {
    args: {
        initialData: mockDeficiencyData as any, // 型が完全に一致しない場合の一時的な対応
        mealType: 'breakfast',
        mealDate: '2023-07-15',
        onSave: (data: RecognitionData) => console.log('保存されたデータ:', data),
    },
};

// 空の食品リストを表示するストーリー
export const EmptyFoodList: Story = {
    args: {
        initialData: mockEmptyData as any, // 型が完全に一致しない場合の一時的な対応
        mealType: 'snack',
        mealDate: '2023-07-15',
        onSave: (data: RecognitionData) => console.log('保存されたデータ:', data),
    },
}; 