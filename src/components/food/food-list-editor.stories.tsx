import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { FoodListEditor } from './food-list-editor';
import { FoodItem } from './food-edit-modal';

// FoodMatchingServiceFactoryのモック
import { FoodMatchingServiceFactory } from '@/lib/food/food-matching-service-factory';

// モック検索結果と同様のデータ構造でモック食品データを作成
const mockFoodItems: FoodItem[] = [
    {
        id: 'tomato',
        name: 'トマト',
        quantity: '100g',
        confidence: 0.95,
        category: '野菜'
    },
    {
        id: 'rice',
        name: '白米',
        quantity: '150g',
        confidence: 0.9,
        category: '穀物'
    },
    {
        id: 'chicken-breast',
        name: '鶏むね肉',
        quantity: '80g',
        confidence: 0.85,
        category: '肉類'
    },
    {
        id: 'unknown-food',
        name: '不明な食品',
        quantity: '1個',
        confidence: 0.4,
        category: 'その他'
    }
];

// モックサービスを作成（FoodEditModalと同様）
const mockService = {
    searchFoodsByName: jest.fn().mockImplementation((query) => {
        return Promise.resolve([
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
            }
        ]);
    })
};

// モックサービスを返すようにFactoryをモック化
jest.mock('@/lib/food/food-matching-service-factory', () => ({
    FoodMatchingServiceFactory: {
        getService: () => mockService
    }
}));

const meta: Meta<typeof FoodListEditor> = {
    title: 'Food/FoodListEditor',
    component: FoodListEditor,
    parameters: {
        layout: 'padded',
    },
    tags: ['autodocs'],
    argTypes: {
        foodItems: {
            control: 'object',
            description: '食品リスト'
        },
        onFoodListChange: {
            action: 'foodListChanged',
            description: '食品リスト更新ハンドラー'
        },
        compact: {
            control: 'boolean',
            description: 'コンパクト表示モード'
        },
        editable: {
            control: 'boolean',
            description: '編集可能かどうか'
        }
    }
};

export default meta;
type Story = StoryObj<typeof FoodListEditor>;

// 標準表示
export const Default: Story = {
    args: {
        foodItems: mockFoodItems,
        onFoodListChange: (updatedFoodList) => console.log('Food list updated:', updatedFoodList),
        compact: false,
        editable: true
    }
};

// コンパクト表示
export const CompactView: Story = {
    args: {
        foodItems: mockFoodItems,
        onFoodListChange: (updatedFoodList) => console.log('Food list updated:', updatedFoodList),
        compact: true,
        editable: true
    }
};

// 編集不可モード
export const ReadOnly: Story = {
    args: {
        foodItems: mockFoodItems,
        onFoodListChange: (updatedFoodList) => console.log('Food list updated:', updatedFoodList),
        compact: false,
        editable: false
    }
};

// 少ない食品リスト
export const FewItems: Story = {
    args: {
        foodItems: mockFoodItems.slice(0, 2),
        onFoodListChange: (updatedFoodList) => console.log('Food list updated:', updatedFoodList),
        compact: false,
        editable: true
    }
};

// 空の食品リスト
export const EmptyList: Story = {
    args: {
        foodItems: [],
        onFoodListChange: (updatedFoodList) => console.log('Food list updated:', updatedFoodList),
        compact: false,
        editable: true
    }
};

// 低確信度食品を含むリスト
export const WithLowConfidenceItems: Story = {
    args: {
        foodItems: [
            ...mockFoodItems.slice(0, 2),
            {
                id: 'unknown-food-1',
                name: '不明な食品1',
                quantity: '1個',
                confidence: 0.4,
                category: 'その他'
            },
            {
                id: 'unknown-food-2',
                name: '不明な食品2',
                quantity: '2個',
                confidence: 0.35,
                category: 'その他'
            }
        ],
        onFoodListChange: (updatedFoodList) => console.log('Food list updated:', updatedFoodList),
        compact: false,
        editable: true
    }
}; 