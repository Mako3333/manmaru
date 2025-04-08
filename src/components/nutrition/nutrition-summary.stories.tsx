import React from 'react';
import { StoryObj, Meta } from '@storybook/react';
import { NutritionSummary } from './nutrition-summary';
import { StandardizedMealNutrition } from '@/types/nutrition';

const meta: Meta<typeof NutritionSummary> = {
    title: 'Components/Nutrition/NutritionSummary',
    component: NutritionSummary,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof NutritionSummary>;

const mockNutritionData: StandardizedMealNutrition = {
    totalCalories: 450,
    totalNutrients: [
        { name: 'タンパク質', value: 30, unit: 'g', percentDailyValue: 60 },
        { name: 'カルシウム', value: 500, unit: 'mg', percentDailyValue: 50 },
        { name: '鉄分', value: 8, unit: 'mg', percentDailyValue: 45 },
        { name: '葉酸', value: 220, unit: 'mcg', percentDailyValue: 55 },
        { name: '脂質', value: 15, unit: 'g', percentDailyValue: 30 },
        { name: '炭水化物', value: 50, unit: 'g', percentDailyValue: 20 },
    ],
    foodItems: [
        {
            id: '1',
            name: '鶏胸肉',
            nutrition: {
                calories: 165,
                nutrients: [
                    { name: 'タンパク質', value: 20, unit: 'g', percentDailyValue: 40 },
                ],
                servingSize: {
                    value: 100,
                    unit: 'g'
                }
            },
            amount: 100,
            unit: 'g',
            confidence: 0.9
        },
        {
            id: '2',
            name: 'ほうれん草',
            nutrition: {
                calories: 45,
                nutrients: [
                    { name: '鉄分', value: 3, unit: 'mg', percentDailyValue: 15 },
                    { name: '葉酸', value: 100, unit: 'mcg', percentDailyValue: 25 },
                ],
                servingSize: {
                    value: 50,
                    unit: 'g'
                }
            },
            amount: 50,
            unit: 'g',
            confidence: 0.85
        },
    ],
    reliability: {
        confidence: 0.85,
        balanceScore: 75,
        completeness: 0.9
    },
    pregnancySpecific: {
        calciumPercentage: 50,
        ironPercentage: 45,
        folatePercentage: 55,
    }
};

export const Default: Story = {
    args: {
        nutritionData: mockNutritionData,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 0,
    },
};

export const WithReliabilityIssues: Story = {
    args: {
        nutritionData: {
            ...mockNutritionData,
            reliability: {
                confidence: 0.65,
                balanceScore: 40,
                completeness: 0.5
            }
        },
        missingFoodsCount: 2,
        lowConfidenceFoodsCount: 3,
    },
};

export const LowNutrients: Story = {
    args: {
        nutritionData: {
            ...mockNutritionData,
            totalNutrients: [
                { name: 'タンパク質', value: 10, unit: 'g', percentDailyValue: 20 },
                { name: 'カルシウム', value: 150, unit: 'mg', percentDailyValue: 15 },
                { name: '鉄分', value: 2, unit: 'mg', percentDailyValue: 10 },
                { name: '葉酸', value: 80, unit: 'mcg', percentDailyValue: 20 },
                { name: '脂質', value: 5, unit: 'g', percentDailyValue: 10 },
                { name: '炭水化物', value: 20, unit: 'g', percentDailyValue: 8 },
            ],
            pregnancySpecific: {
                calciumPercentage: 15,
                ironPercentage: 10,
                folatePercentage: 20,
            }
        },
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 0,
    },
}; 