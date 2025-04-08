import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { NutritionSummary } from './nutrition-summary';
import { StandardizedMealNutrition } from '@/types/nutrition';

// StandardizedMealNutrition型に合わせたモックデータ
const createStandardizedMockData = (isDeficient: boolean = false): StandardizedMealNutrition => ({
    totalCalories: 450,
    totalNutrients: [
        { name: 'たんぱく質', value: isDeficient ? 15 : 20, unit: 'g' },
        { name: '脂質', value: 15, unit: 'g' },
        { name: '炭水化物', value: 60, unit: 'g' },
        { name: '食物繊維', value: 5, unit: 'g' },
        { name: '鉄分', value: isDeficient ? 1.5 : 2.5, unit: 'mg' },
        { name: '鉄', value: isDeficient ? 1.5 : 2.5, unit: 'mg' },
        { name: 'iron', value: isDeficient ? 1.5 : 2.5, unit: 'mg' },
        { name: '葉酸', value: isDeficient ? 70 : 120, unit: 'mcg' },
        { name: 'folic_acid', value: isDeficient ? 70 : 120, unit: 'mcg' },
        { name: 'カルシウム', value: isDeficient ? 150 : 200, unit: 'mg' },
        { name: 'calcium', value: isDeficient ? 150 : 200, unit: 'mg' },
        { name: 'ビタミンA', value: 300, unit: 'mcg' },
        { name: 'ビタミンB1', value: 0.3, unit: 'mg' },
        { name: 'ビタミンB2', value: 0.4, unit: 'mg' },
        { name: 'ビタミンC', value: isDeficient ? 20 : 30, unit: 'mg' }
    ],
    foodItems: [],
    reliability: {
        confidence: 0.85,
        balanceScore: 75,
        completeness: 0.9
    }
});

// 標準的な栄養データ
const mockStandardizedNutrition = createStandardizedMockData();

// 不足している栄養素を含むデータ
const mockStandardizedNutritionWithDeficiencies = createStandardizedMockData(true);

const meta: Meta<typeof NutritionSummary> = {
    title: 'Nutrition/NutritionSummary',
    component: NutritionSummary,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        nutritionData: {
            control: 'object',
            description: '標準化された栄養データ'
        },
        missingFoodsCount: {
            control: { type: 'number', min: 0 },
            description: '見つからなかった食品の数'
        },
        lowConfidenceFoodsCount: {
            control: { type: 'number', min: 0 },
            description: '低確信度の食品の数'
        },
        initiallyExpanded: {
            control: 'boolean',
            description: '詳細表示の初期状態'
        },
        compact: {
            control: 'boolean',
            description: 'コンパクト表示モード'
        }
    }
};

export default meta;
type Story = StoryObj<typeof NutritionSummary>;

export const Default: Story = {
    args: {
        nutritionData: mockStandardizedNutrition,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 0,
        initiallyExpanded: false,
        compact: false
    }
};

export const WithDeficiencies: Story = {
    args: {
        nutritionData: mockStandardizedNutritionWithDeficiencies,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 1,
        initiallyExpanded: false,
        compact: false
    }
};

export const LowReliability: Story = {
    args: {
        nutritionData: {
            ...mockStandardizedNutrition,
            reliability: {
                confidence: 0.45,
                balanceScore: 40,
                completeness: 0.5
            }
        },
        missingFoodsCount: 2,
        lowConfidenceFoodsCount: 1,
        initiallyExpanded: false,
        compact: false
    }
};

export const InitiallyExpanded: Story = {
    args: {
        nutritionData: mockStandardizedNutrition,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 0,
        initiallyExpanded: true,
        compact: false
    }
};

export const CompactView: Story = {
    args: {
        nutritionData: mockStandardizedNutrition,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 0,
        initiallyExpanded: false,
        compact: true
    }
};

export const CompactWithDeficiencies: Story = {
    args: {
        nutritionData: mockStandardizedNutritionWithDeficiencies,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 1,
        initiallyExpanded: false,
        compact: true
    }
};

export const CompactLowReliability: Story = {
    args: {
        nutritionData: {
            ...mockStandardizedNutrition,
            reliability: {
                confidence: 0.45,
                balanceScore: 40,
                completeness: 0.5
            }
        },
        missingFoodsCount: 2,
        lowConfidenceFoodsCount: 1,
        initiallyExpanded: false,
        compact: true
    }
}; 