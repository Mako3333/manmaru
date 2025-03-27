import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { FoodEditModal } from './food-edit-modal';

// FoodMatchingServiceFactoryのモック
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';

// モック検索結果
const mockSearchResults = [
    {
        matchedFood: {
            id: 'tomato',
            name: 'トマト',
            category: '野菜'
        },
        confidence: 0.95
    },
    {
        matchedFood: {
            id: 'mini-tomato',
            name: 'ミニトマト',
            category: '野菜'
        },
        confidence: 0.85
    },
    {
        matchedFood: {
            id: 'tomato-juice',
            name: 'トマトジュース',
            category: '飲料'
        },
        confidence: 0.7
    }
];

// モックサービスを作成
const mockService = {
    searchFoodsByName: jest.fn().mockImplementation((query) => {
        return Promise.resolve(
            mockSearchResults.filter(result =>
                result.matchedFood.name.includes(query)
            )
        );
    })
};

// モックサービスを返すようにFactoryをモック化
jest.mock('@/lib/food/food-matching-service-factory', () => ({
    FoodMatchingServiceFactory: {
        getService: () => mockService
    }
}));

const meta: Meta<typeof FoodEditModal> = {
    title: 'Food/FoodEditModal',
    component: FoodEditModal,
    parameters: {
        layout: 'fullscreen',
    },
    tags: ['autodocs'],
    argTypes: {
        isOpen: {
            control: 'boolean',
            description: 'モーダルが開いているかどうか'
        },
        food: {
            control: 'object',
            description: '編集対象の食品'
        },
        onUpdate: {
            action: 'updated',
            description: '食品の更新ハンドラー'
        },
        onDelete: {
            action: 'deleted',
            description: '食品の削除ハンドラー'
        },
        onClose: {
            action: 'closed',
            description: 'モーダルを閉じる関数'
        }
    }
};

export default meta;
type Story = StoryObj<typeof FoodEditModal>;

// 既存の食品を編集するケース
export const EditExistingFood: Story = {
    args: {
        isOpen: true,
        food: {
            id: 'tomato',
            name: 'トマト',
            quantity: '100g',
            confidence: 0.95,
            category: '野菜'
        },
        onUpdate: (food) => console.log('Updated food:', food),
        onDelete: () => console.log('Deleted food'),
        onClose: () => console.log('Modal closed')
    }
};

// 低確信度の食品を編集するケース
export const EditLowConfidenceFood: Story = {
    args: {
        isOpen: true,
        food: {
            id: 'unknown-food',
            name: '不明な食品',
            quantity: '1個',
            confidence: 0.4,
            category: 'その他'
        },
        onUpdate: (food) => console.log('Updated food:', food),
        onDelete: () => console.log('Deleted food'),
        onClose: () => console.log('Modal closed')
    }
};

// 新しい食品を追加するケース
export const AddNewFood: Story = {
    args: {
        isOpen: true,
        food: {
            name: '',
            quantity: ''
        },
        onUpdate: (food) => console.log('Added food:', food),
        onClose: () => console.log('Modal closed')
    }
};

// 削除ボタンなしのケース
export const WithoutDeleteOption: Story = {
    args: {
        isOpen: true,
        food: {
            id: 'tomato',
            name: 'トマト',
            quantity: '100g',
            confidence: 0.95
        },
        onUpdate: (food) => console.log('Updated food:', food),
        onClose: () => console.log('Modal closed')
    }
}; 