// import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { ConfidenceIndicator } from './confidence-indicator';

// モック関数を使用してFoodMatchingServiceFactoryの実装をモック化
// import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';

// モックの確信度表示データ
const mockDisplayData = {
    highConfidence: {
        color: '#22c55e',
        label: '高確信度',
        icon: 'check-circle'
    },
    mediumConfidence: {
        color: '#3b82f6',
        label: '中確信度',
        icon: 'info'
    },
    lowConfidence: {
        color: '#f59e0b',
        label: '低確信度',
        icon: 'alert-triangle'
    },
    veryLowConfidence: {
        color: '#ef4444',
        label: '非常に低い確信度',
        icon: 'alert-triangle'
    }
};

// モックサービスを作成
const mockService = {
    getConfidenceDisplay: (score: number) => {
        if (score >= 0.85) return mockDisplayData.highConfidence;
        if (score >= 0.7) return mockDisplayData.mediumConfidence;
        if (score >= 0.5) return mockDisplayData.lowConfidence;
        return mockDisplayData.veryLowConfidence;
    }
};

// モックサービスを返すようにFactoryをモック化
jest.mock('@/lib/food/food-matching-service-factory', () => ({
    FoodMatchingServiceFactory: {
        getService: () => mockService
    }
}));

const meta: Meta<typeof ConfidenceIndicator> = {
    title: 'Food/ConfidenceIndicator',
    component: ConfidenceIndicator,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        confidenceScore: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
            description: '確信度スコア (0.0-1.0)'
        },
        size: {
            control: { type: 'select' },
            options: ['sm', 'md', 'lg'],
            description: 'コンポーネントのサイズ'
        },
        showLabel: {
            control: 'boolean',
            description: 'ラベルを表示するかどうか'
        },
        showIcon: {
            control: 'boolean',
            description: 'アイコンを表示するかどうか'
        },
        badgeStyle: {
            control: 'boolean',
            description: 'バッジスタイルを適用するかどうか'
        }
    }
};

export default meta;
type Story = StoryObj<typeof ConfidenceIndicator>;

export const HighConfidence: Story = {
    args: {
        confidenceScore: 0.95,
        size: 'md',
        showLabel: true,
        showIcon: true,
        badgeStyle: true
    }
};

export const MediumConfidence: Story = {
    args: {
        confidenceScore: 0.75,
        size: 'md',
        showLabel: true,
        showIcon: true,
        badgeStyle: true
    }
};

export const LowConfidence: Story = {
    args: {
        confidenceScore: 0.55,
        size: 'md',
        showLabel: true,
        showIcon: true,
        badgeStyle: true
    }
};

export const VeryLowConfidence: Story = {
    args: {
        confidenceScore: 0.40,
        size: 'md',
        showLabel: true,
        showIcon: true,
        badgeStyle: true
    }
};

export const Small: Story = {
    args: {
        confidenceScore: 0.95,
        size: 'sm',
        showLabel: true,
        showIcon: true,
        badgeStyle: true
    }
};

export const Large: Story = {
    args: {
        confidenceScore: 0.95,
        size: 'lg',
        showLabel: true,
        showIcon: true,
        badgeStyle: true
    }
};

export const IconOnly: Story = {
    args: {
        confidenceScore: 0.95,
        size: 'md',
        showLabel: false,
        showIcon: true,
        badgeStyle: true
    }
};

export const TextOnly: Story = {
    args: {
        confidenceScore: 0.95,
        size: 'md',
        showLabel: true,
        showIcon: false,
        badgeStyle: true
    }
};

export const NonBadgeStyle: Story = {
    args: {
        confidenceScore: 0.95,
        size: 'md',
        showLabel: true,
        showIcon: true,
        badgeStyle: false
    }
}; 