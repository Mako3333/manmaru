import { FoodQuantity } from '@/types/food';

/**
 * 量の単位マッピング
 */
const UNIT_MAPPING: Record<string, string> = {
    // 標準単位
    'g': 'g',
    'グラム': 'g',
    'ｇ': 'g',
    'kg': 'kg',
    'キログラム': 'kg',
    'キロ': 'kg',
    'ml': 'ml',
    'ミリリットル': 'ml',
    'ｍｌ': 'ml',

    // 日本の計量単位
    '大さじ': '大さじ',
    '大匙': '大さじ',
    'おおさじ': '大さじ',
    '小さじ': '小さじ',
    '小匙': '小さじ',
    'こさじ': '小さじ',
    'カップ': 'カップ',

    // 食品特有の単位
    '個': '個',
    '切れ': '切れ',
    '枚': '枚',
    '本': '本',
    '袋': '袋',
    '缶': '缶',
    'かけ': 'かけ',
    '束': '束',
    '尾': '尾',
    '杯': '杯',
    'はい': '杯',
    'パイ': '杯',
    '人前': '人前',
    'にんまえ': '人前',
    '一人前': '人前',
    '合': '合',
};

/**
 * 単位ごとの標準グラム換算
 */
const UNIT_TO_GRAM: Record<string, number> = {
    'g': 1,
    'kg': 1000,
    'ml': 1,
    '大さじ': 15,
    '小さじ': 5,
    'カップ': 200,
    '個': 50,    // 一般的な目安
    '切れ': 80,  // 一般的な目安
    '枚': 60,    // 一般的な目安
    '本': 40,    // 一般的な目安
    '袋': 100,   // 一般的な目安
    '缶': 100,   // 一般的な目安
    'かけ': 3,   // 一般的な目安
    '束': 100,   // 一般的な目安
    '尾': 80,    // 一般的な目安
    '杯': 150,   // デフォルト (お茶碗)
    '人前': 100, // デフォルト
};

/**
 * 特定の果物の個あたりのグラム数
 */
type SpecificFruitGrams = {
    [fruit: string]: number;
};

/**
 * 食品カテゴリ別の単位あたりの標準量
 * カテゴリと単位の組み合わせによる特殊なケース
 */
interface CategoryUnitGrams {
    [category: string]: {
        [unit: string]: number | SpecificFruitGrams;
    };
}

const CATEGORY_UNIT_GRAMS: CategoryUnitGrams = {
    '穀類-米': {
        '杯': 150,    // お茶碗1杯
        'カップ': 150 // 炊いたご飯1カップ
    },
    '野菜-葉物': {
        '束': 80,
        '株': 100
    },
    '肉類': {
        '切れ': 100,
        '枚': 100
    },
    '魚介類': {
        '切れ': 80,
        '尾': 100,
        '匹': 100
    },
    '果物': {
        '個': {
            'りんご': 200,
            'みかん': 80,
            'バナナ': 100
        } as SpecificFruitGrams
    }
};

/**
 * 量の文字列を解析して標準形式に変換するクラス
 */
export class QuantityParser {
    /**
     * 量の文字列を解析する
     * @param quantityStr 量の文字列 (例: "100g", "大さじ2", "3個")
     * @param foodName 食品名 (単位推定のため、オプション)
     * @param category 食品カテゴリ (単位推定のため、オプション)
     * @returns 解析された量データ
     */
    static parseQuantity(
        quantityStr?: string,
        foodName?: string,
        category?: string
    ): { quantity: FoodQuantity; confidence: number } {
        const defaultResult = {
            quantity: { value: 1, unit: '標準量' },
            confidence: 0.5
        };

        if (!quantityStr) {
            return defaultResult;
        }

        const normalizedStr = quantityStr.trim().replace(/[０-９]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0));

        const numUnitFormat = /^(\d+(\.\d+)?)\s*([a-zａ-ｚＡ-Ｚ一-龠々ぁ-ヶ合杯]+)$/i.exec(normalizedStr);
        if (numUnitFormat && numUnitFormat[1] && numUnitFormat[3]) {
            const value = parseFloat(numUnitFormat[1]);
            const unitText = numUnitFormat[3];
            const normalizedUnit = UNIT_MAPPING[unitText] || unitText;
            if (normalizedUnit === '合') {
                return { quantity: { value, unit: '合' }, confidence: 0.95 };
            }
            return { quantity: { value, unit: normalizedUnit }, confidence: 0.9 };
        }

        const unitOnlyFormat = /^(一|１)\s*([杯人前]+)$/.exec(normalizedStr);
        if (unitOnlyFormat && unitOnlyFormat[2]) {
            const value = 1;
            const unitText = unitOnlyFormat[2];
            const normalizedUnit = UNIT_MAPPING[unitText] || unitText;
            return { quantity: { value, unit: normalizedUnit }, confidence: 0.85 };
        }

        const standardFormat = /^(\d+(\.\d+)?)\s*([a-zａ-ｚＡ-Ｚぁ-ヶ]+)$/i.exec(normalizedStr);
        if (standardFormat && standardFormat[1] && standardFormat[3]) {
            const value = parseFloat(standardFormat[1]);
            const unitText = standardFormat[3];
            const normalizedUnit = UNIT_MAPPING[unitText] || unitText;
            if (['g', 'kg', 'ml', '大さじ', '小さじ', 'カップ', '個', '切れ', '枚', '本', '袋', '缶', 'かけ', '束', '尾'].includes(normalizedUnit)) {
                return { quantity: { value, unit: normalizedUnit }, confidence: 0.9 };
            }
        }

        const japaneseFormat = /^([一-龠々ぁ-ヶ]+)\s*(\d+(\.\d+)?)$/.exec(normalizedStr);
        if (japaneseFormat && japaneseFormat[1] && japaneseFormat[2]) {
            const unitText = japaneseFormat[1];
            const value = parseFloat(japaneseFormat[2]);
            const normalizedUnit = UNIT_MAPPING[unitText] || unitText;
            if (['大さじ', '小さじ', '個', '切れ', '枚', '本', '袋', '缶', 'かけ', '束', '尾'].includes(normalizedUnit)) {
                return { quantity: { value, unit: normalizedUnit }, confidence: 0.9 };
            }
        }

        const numericOnly = /^(\d+(\.\d+)?)$/.exec(normalizedStr);
        if (numericOnly && numericOnly[1]) {
            return {
                quantity: { value: parseFloat(numericOnly[1]), unit: '標準量' },
                confidence: 0.7
            };
        }

        const japaneseNumber = this.extractJapaneseNumber(normalizedStr);
        if (japaneseNumber.found) {
            return {
                quantity: { value: japaneseNumber.value, unit: japaneseNumber.unit },
                confidence: 0.8
            };
        }

        console.warn(`[QuantityParser] Failed to parse quantity: "${quantityStr}". Using default.`);
        return defaultResult;
    }

    /**
     * 日本語の数表現を抽出する
     * @private
     */
    private static extractJapaneseNumber(text: string): { found: boolean; value: number; unit: string } {
        // 全角数字を半角に変換
        const normalized = text.replace(/[０-９]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0));

        // 漢数字のマッピング
        const kanjiNumbers: Record<string, number> = {
            '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
            '半': 0.5
        };

        // 漢数字を検索
        for (const [kanji, value] of Object.entries(kanjiNumbers)) {
            if (normalized.includes(kanji)) {
                // 単位を抽出
                const unitMatch = normalized.match(new RegExp(`${kanji}([^\\d${Object.keys(kanjiNumbers).join('')}]+)`));
                const unit = unitMatch && unitMatch[1] ? unitMatch[1] : '標準量';

                return { found: true, value, unit };
            }
        }

        return { found: false, value: 1, unit: '標準量' };
    }

    /**
     * 量を標準グラム数に変換する
     * @param quantity 量データ
     * @param foodName 食品名 (単位変換の特殊ケース用)
     * @param category 食品カテゴリ (単位変換の特殊ケース用)
     * @returns グラム単位の量
     */
    static convertToGrams(
        quantity: FoodQuantity,
        foodName?: string,
        category?: string
    ): { grams: number; confidence: number } {
        const { value, unit } = quantity;
        let baseConfidence = 0.7; // 基本信頼度

        // グラム単位
        if (unit === 'g') return { grams: value, confidence: 1.0 };
        // キログラム単位
        if (unit === 'kg') return { grams: value * 1000, confidence: 1.0 };
        // ミリリットル (ほぼグラムとして扱う)
        if (unit === 'ml') return { grams: value, confidence: 0.98 };

        // カテゴリと単位の組み合わせによる特殊なケース
        if (category && category in CATEGORY_UNIT_GRAMS) {
            const categoryUnits = CATEGORY_UNIT_GRAMS[category];
            if (categoryUnits && unit in categoryUnits) {
                const categoryUnitValue = categoryUnits[unit];
                if (typeof categoryUnitValue === 'object' && foodName) {
                    // 果物などの特殊ケース
                    const specificFruitGrams = categoryUnitValue as SpecificFruitGrams;
                    for (const [specificFood, specificGrams] of Object.entries(specificFruitGrams)) {
                        if (foodName.includes(specificFood)) {
                            return { grams: value * specificGrams, confidence: 0.95 };
                        }
                    }
                    // 特殊ケースに一致しない場合、デフォルトの「個」換算へフォールバック (下で処理)
                } else if (typeof categoryUnitValue === 'number') {
                    // カテゴリ固有の数値換算 (例: ご飯の「杯」)
                    return { grams: value * categoryUnitValue, confidence: 0.9 };
                }
            }
        }

        // 一般的な単位換算
        const gramsPerUnit = UNIT_TO_GRAM[unit];
        if (gramsPerUnit !== undefined) {
            return { grams: value * gramsPerUnit, confidence: 0.85 };
        }

        // 「標準量」と「合」の処理
        if (unit === '標準量') {
            // TODO: 将来的には food.standard_quantity を参照するなど改善
            console.warn(`[QuantityParser] Unit is '標準量' for "${foodName}". Using default 100g.`);
            return { grams: value * 100, confidence: 0.6 }; // 信頼度低め
        }
        if (unit === '合') {
            // 1合 = 約150g (炊飯前) または 330g (炊飯後)。カテゴリ情報があればより正確に。
            const riceGram = (category === '穀類-米') ? 150 : 150; // デフォルトは炊飯前
            console.warn(`[QuantityParser] Unit is '合' (${category}). Using ${riceGram}g/合.`);
            return { grams: value * riceGram, confidence: 0.8 };
        }

        // 解析不能な単位の場合
        console.warn(`[QuantityParser] Unknown unit "${unit}" for "${foodName}". Assuming default 100g.`);
        return { grams: value * 100, confidence: 0.4 }; // 信頼度かなり低め
    }
} 