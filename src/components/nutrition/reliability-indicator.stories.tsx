import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { ReliabilityIndicator } from './reliability-indicator';

const meta: Meta<typeof ReliabilityIndicator> = {
    title: 'Nutrition/ReliabilityIndicator',
    component: ReliabilityIndicator,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
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
        compact: {
            control: 'boolean',
            description: 'コンパクト表示モード'
        }
    }
};

export default meta;
type Story = StoryObj<typeof ReliabilityIndicator>;

export const HighReliability: Story = {
    args: {
        reliabilityScore: 0.85,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 0,
        compact: false
    }
};

export const MediumReliability: Story = {
    args: {
        reliabilityScore: 0.65,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 1,
        compact: false
    }
};

export const LowReliability: Story = {
    args: {
        reliabilityScore: 0.45,
        missingFoodsCount: 1,
        lowConfidenceFoodsCount: 2,
        compact: false
    }
};

export const HighReliabilityCompact: Story = {
    args: {
        reliabilityScore: 0.85,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 0,
        compact: true
    }
};

export const MediumReliabilityCompact: Story = {
    args: {
        reliabilityScore: 0.65,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 1,
        compact: true
    }
};

export const LowReliabilityCompact: Story = {
    args: {
        reliabilityScore: 0.45,
        missingFoodsCount: 1,
        lowConfidenceFoodsCount: 2,
        compact: true
    }
};

export const WithMissingFoods: Story = {
    args: {
        reliabilityScore: 0.7,
        missingFoodsCount: 2,
        lowConfidenceFoodsCount: 0,
        compact: false
    }
};

export const WithLowConfidenceFoods: Story = {
    args: {
        reliabilityScore: 0.7,
        missingFoodsCount: 0,
        lowConfidenceFoodsCount: 3,
        compact: false
    }
};

export const WithBothIssues: Story = {
    args: {
        reliabilityScore: 0.5,
        missingFoodsCount: 1,
        lowConfidenceFoodsCount: 2,
        compact: false
    }
}; 