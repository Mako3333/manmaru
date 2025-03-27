import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { NutritionSummary } from './nutrition-summary';

// モックの栄養素データ
const mockNutrients = [
    { name: 'エネルギー', amount: 450, unit: 'kcal', percentOfDaily: 0.23 },
    { name: 'たんぱく質', amount: 20, unit: 'g', percentOfDaily: 0.4 },
    { name: '脂質', amount: 15, unit: 'g', percentOfDaily: 0.25 },
    { name: '炭水化物', amount: 60, unit: 'g', percentOfDaily: 0.2 },
    { name: '食物繊維', amount: 5, unit: 'g', percentOfDaily: 0.25 },
    { name: '鉄', amount: 2.5, unit: 'mg', percentOfDaily: 0.18, isDeficient: true },
    { name: '葉酸', amount: 120, unit: 'μg', percentOfDaily: 0.3 },
    { name: 'カルシウム', amount: 200, unit: 'mg', percentOfDaily: 0.2 },
    { name: 'ビタミンA', amount: 300, unit: 'μg', percentOfDaily: 0.5 },
    { name: 'ビタミンB1', amount: 0.3, unit: 'mg', percentOfDaily: 0.3 },
    { name: 'ビタミンB2', amount: 0.4, unit: 'mg', percentOfDaily: 0.35 },
    { name: 'ビタミンC', amount: 30, unit: 'mg', percentOfDaily: 0.3, isDeficient: true }
];

// 不足している栄養素を含むデータ
const mockNutrientsWithDeficiencies = [
    ...mockNutrients.slice(0, 5),
    { name: '鉄', amount: 1.5, unit: 'mg', percentOfDaily: 0.11, isDeficient: true },
    { name: '葉酸', amount: 70, unit: 'μg', percentOfDaily: 0.18, isDeficient: true },
    { name: 'カルシウム', amount: 150, unit: 'mg', percentOfDaily: 0.15, isDeficient: true },
    { name: 'ビタミンA', amount: 300, unit: 'μg', percentOfDaily: 0.5 },
    { name: 'ビタミンB1', amount: 0.3, unit: 'mg', percentOfDaily: 0.3 },
    { name: 'ビタミンB2', amount: 0.4, unit: 'mg', percentOfDaily: 0.35 },
    { name: 'ビタミンC', amount: 20, unit: 'mg', percentOfDaily: 0.2, isDeficient: true }
];

const meta: Meta<typeof NutritionSummary> = {
    title: 'Nutrition/NutritionSummary',
    component: NutritionSummary,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        nutrients: {
            control: 'object',
            description: '栄養素データの配列'
        },
        reliabilityScore: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
            description: '栄養計算の信頼性スコア (0.0-1.0)'
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
        nutrients: mockNutrients,
        reliabilityScore: 0.85,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 0,
        initiallyExpanded: false,
        compact: false
    }
};

export const WithDeficiencies: Story = {
    args: {
        nutrients: mockNutrientsWithDeficiencies,
        reliabilityScore: 0.75,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 1,
        initiallyExpanded: false,
        compact: false
    }
};

export const LowReliability: Story = {
    args: {
        nutrients: mockNutrients,
        reliabilityScore: 0.45,
        missingFoodsCount: 2,
        lowConfidenceFoodsCount: 1,
        initiallyExpanded: false,
        compact: false
    }
};

export const InitiallyExpanded: Story = {
    args: {
        nutrients: mockNutrients,
        reliabilityScore: 0.85,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 0,
        initiallyExpanded: true,
        compact: false
    }
};

export const CompactView: Story = {
    args: {
        nutrients: mockNutrients,
        reliabilityScore: 0.85,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 0,
        initiallyExpanded: false,
        compact: true
    }
};

export const CompactWithDeficiencies: Story = {
    args: {
        nutrients: mockNutrientsWithDeficiencies,
        reliabilityScore: 0.75,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 1,
        initiallyExpanded: false,
        compact: true
    }
};

export const CompactLowReliability: Story = {
    args: {
        nutrients: mockNutrients,
        reliabilityScore: 0.45,
        missingFoodsCount: 2,
        lowConfidenceFoodsCount: 1,
        initiallyExpanded: false,
        compact: true
    }
}; 