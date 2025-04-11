import { FoodQuantity } from '@/types/food';
import { AppError } from '@/lib/error';
import { ErrorCode } from '@/lib/error/codes/error-codes';

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
    'cc': 'ml', // cc を ml として扱う
    'ｃｃ': 'ml', // 全角ccも考慮

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
    'かけら': 'かけ',
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
 * 注意: これらはあくまで一般的な目安であり、食品によって大きく異なる
 */
const UNIT_TO_GRAM: Record<string, number> = {
    'g': 1,
    'kg': 1000,
    'ml': 1,    // 水や牛乳などを想定。油などは密度が異なる
    'cc': 1,    // ml と同等として扱う
    '大さじ': 15, // 液体: 約15g, 粉類: 約9g (ここでは液体をデフォルトに)
    '小さじ': 5,  // 液体: 約5g, 粉類: 約3g (ここでは液体をデフォルトに)
    'カップ': 200, // 液体: 約200g, 粉類: 約100-120g (ここでは液体をデフォルトに)
    '個': 50,    // 平均的な卵や小さめの野菜/果物想定。信頼度は低い
    '切れ': 80,  // 魚の切り身など想定。信頼度は低い
    '枚': 60,    // 肉のスライスなど想定。信頼度は低い
    '本': 100,   // きゅうり、バナナなど中程度の野菜/果物想定。信頼度は低い
    '袋': 100,   // もやし1袋など想定。信頼度は低い
    '缶': 150,   // ツナ缶などの中身想定。信頼度は低い
    'かけ': 5,   // ニンニク、生姜ひとかけ想定。カレールウは別途考慮必要
    '束': 100,   // ほうれん草など想定。
    '尾': 80,    // エビなど想定。
    '杯': 150,   // お茶碗一杯のご飯 (炊飯後約150g)
    '人前': 100, // パスタ乾麺1人前など、非常に曖昧。信頼度は低い
    '合': 150,   // 米1合 (炊飯前約150g)
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
        '杯': 150,    // お茶碗1杯 (炊飯後)
        '合': 150,    // 1合 (炊飯前)
        'カップ': 180 // 炊飯後の米1カップは約180g
    },
    '野菜-葉物': {
        '束': 80,     // 小松菜、ほうれん草など
        '株': 100,    // レタスなど
        '袋': 200,    // もやしなど
    },
    '野菜-根菜': {
        '本': 150,    // 大根、にんじんなど
    },
    '肉類': {
        '切れ': 100,
        '枚': 120    // ステーキ肉など
    },
    '魚介類': {
        '切れ': 80,
        '尾': 120,   // 大きめのエビなど
        '匹': 150    // 中程度の魚
    },
    '果物': {
        '個': { // 食品名にこれらの単語が含まれる場合
            'りんご': 250,
            'みかん': 100,
            'バナナ': 120,
            'キウイ': 100,
            'レモン': 120,
            'オレンジ': 200,
            'グレープフルーツ': 300,
        } as SpecificFruitGrams
    },
    '調味料': {
        'かけ': 20, // カレールウひとかけ
    },
    '卵類': {
        '個': 60 // 卵1個あたり約60gとする
    }
};

/**
 * 量の文字列を解析して標準形式に変換するクラス
 */
export class QuantityParser {
    /**
     * 量の文字列を解析する
     * @param quantityStr 量の文字列 (例: "100g", "大さじ2", "3個", "1/2本(50g)")
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

        if (!quantityStr || quantityStr.trim() === '') {
            console.warn(`[QuantityParser] Received empty quantity string for "${foodName}". Using default.`);
            return defaultResult;
        }

        // --- 括弧内の重量 (〇〇g) を最優先で抽出 --- START
        // 半角・全角カッコ、スペース有無に対応
        const weightInParenthesesMatch = quantityStr.match(/[（\(]\s*(\d+(?:\.\d+)?)\s*g\s*[）\)]/i);
        if (weightInParenthesesMatch && weightInParenthesesMatch[1]) {
            const value = parseFloat(weightInParenthesesMatch[1]);
            if (!isNaN(value) && value > 0) {
                // console.log(`[QuantityParser] Extracted weight from parentheses: ${value}g for "${quantityStr}"`);
                return { quantity: { value, unit: 'g' }, confidence: 1.0 }; // 最も高い信頼度
            }
        }
        // --- 括弧内の重量 (〇〇g) を最優先で抽出 --- END

        // 正規化: 全角数字/記号を半角に、括弧を除去、全角スペースも半角スペースに
        const normalizedStr = quantityStr
            .trim()
            // 全角数字、小数点、スラッシュ、アルファベットを半角に
            .replace(/[０-９．／／Ａ-Ｚａ-ｚ]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0))
            // 括弧とその中身を除去 (重量抽出後に行う)
            .replace(/（.*?）|\(.*?\)/g, '')
            // 全角スペースを半角スペースに
            .replace(/\u3000/g, ' ')
            .trim();

        // 空文字列になったらデフォルトを返す
        if (normalizedStr === '') {
            console.warn(`[QuantityParser] Quantity string became empty after normalization: "${quantityStr}". Using default.`);
            return defaultResult;
        }

        // パース可能かどうかのフラグ (デバッグ/ログ用)
        let parsedSuccessfully = false;

        // --- 数値・単位抽出ロジック改善 --- START
        // 正規表現: (数値部分) (任意スペース) (単位部分) OR (単位部分) (任意スペース) (数値部分)
        // 数値部分: 整数, 小数, N/D形式の分数, 漢数字(一二三...半)
        // 単位部分: 英字, 日本語文字 (記号除く)
        const numUnitRegex = /^(\d+(?:\.\d+)?(?:[\/／]\d+(?:\.\d+)?)?|\d+[\/／]\d+|[一二三四五六七八九十半]+)\s*([a-zぁ-んァ-ヶー一-龠々個本枚切合缶袋束尾かけ杯人前ら]+)$/i;
        const unitNumRegex = /^([a-zぁ-んァ-ヶー一-龠々個本枚切合缶袋束尾かけ杯人前ら]+)\s*(\d+(?:\.\d+)?(?:[\/／]\d+(?:\.\d+)?)?|\d+[\/／]\d+|[一二三四五六七八九十半]+)$/i;

        const numUnitMatch = numUnitRegex.exec(normalizedStr);
        const unitNumMatch = unitNumRegex.exec(normalizedStr);

        let valueStr: string | undefined;
        let unitText: string | undefined;

        if (numUnitMatch && numUnitMatch[1] && numUnitMatch[2]) {
            parsedSuccessfully = true;
            valueStr = numUnitMatch[1].replace('／', '/');
            unitText = numUnitMatch[2];
        } else if (unitNumMatch && unitNumMatch[1] && unitNumMatch[2]) {
            parsedSuccessfully = true;
            unitText = unitNumMatch[1];
            valueStr = unitNumMatch[2].replace('／', '/');
        }

        if (parsedSuccessfully && valueStr && unitText) {
            const value = this.parseValueString(valueStr);
            const lookupKey = unitText.toLowerCase();
            const normalizedUnit = UNIT_MAPPING[lookupKey] || unitText;
            const knownUnits = Object.keys(UNIT_TO_GRAM).concat(Object.keys(UNIT_MAPPING));

            if (knownUnits.includes(normalizedUnit) || knownUnits.includes(lookupKey)) {
                return { quantity: { value, unit: normalizedUnit }, confidence: 0.9 };
            } else {
                console.warn(`[QuantityParser] Unknown unit after mapping: "${normalizedUnit}" (original: "${unitText}") for "${quantityStr}". Assuming '標準量'.`);
                return { quantity: { value, unit: '標準量' }, confidence: 0.65 };
            }
        }
        // --- 数値・単位抽出ロジック改善 --- END

        // --- 「適量」「少々」などの曖昧表現 --- START
        const ambiguousMap: Record<string, { value: number, unit: string, confidence: number }> = {
            '少々': { value: 1, unit: 'g', confidence: 0.7 },
            '適量': { value: 5, unit: 'g', confidence: 0.6 }, // 適量は少々より多いと仮定
            'ひとつまみ': { value: 0.5, unit: 'g', confidence: 0.75 },
            'たっぷり': { value: 10, unit: 'g', confidence: 0.5 } // かなり曖昧
        };
        if (normalizedStr in ambiguousMap) {
            parsedSuccessfully = true;
            const result = ambiguousMap[normalizedStr];
            // console.log(`[QuantityParser] Parsed ambiguous quantity: "${normalizedStr}" for "${quantityStr}". Using ${result?.value}${result?.unit}.`);
            return result ? { quantity: { value: result.value, unit: result.unit }, confidence: result.confidence } : defaultResult;
        }
        // --- 「適量」「少々」などの曖昧表現 --- END


        // --- 数値のみの場合 (単位なし) --- START
        // 分数表記にも対応
        const numericOnlyRegex = /^(\d+(?:\.\d+)?(?:[\/／]\d+(?:\.\d+)?)?|\d+[\/／]\d+)$/;
        const numericOnlyMatch = numericOnlyRegex.exec(normalizedStr);
        if (numericOnlyMatch && numericOnlyMatch[1]) {
            parsedSuccessfully = true;
            const valueStr = numericOnlyMatch[1].replace('／', '/');
            const value = this.parseValueString(valueStr);
            // console.log(`[QuantityParser] Parsed numeric only: ${value} for "${quantityStr}". Assuming '標準量'.`);
            return {
                quantity: { value, unit: '標準量' }, // 単位不明なので標準量
                confidence: 0.7
            };
        }
        // --- 数値のみの場合 (単位なし) --- END


        // ここまででパースできなかった場合
        if (!parsedSuccessfully && quantityStr.length > 0) {
            console.warn(`[QuantityParser] Failed to parse quantity: "${quantityStr}" (Normalized: "${normalizedStr}"). Using default.`);
        }

        return defaultResult; // デフォルト値を返す
    }

    /**
     * 数値文字列（小数、分数、漢数字を含む）をパースするヘルパー関数
     * @private
     */
    private static parseValueString(valueStr: string): number {
        // 漢数字のマッピング
        const kanjiNumbers: Record<string, number> = {
            '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
            '半': 0.5
        };

        // 漢数字が含まれるかチェック
        if (Object.keys(kanjiNumbers).some(kanji => valueStr.includes(kanji))) {
            // 簡単な漢数字のみ対応（例: 「一」, 「半」, 「十」など）
            // TODO: 「二十三」のような複雑な漢数字には未対応
            for (const [kanji, value] of Object.entries(kanjiNumbers)) {
                if (valueStr === kanji) {
                    return value;
                }
            }
            // 対応できない漢数字の場合は一旦1を返す
            console.warn(`[QuantityParser] Complex Kanji number detected: "${valueStr}". Returning 1.`);
            return 1;
        }

        // 分数チェック (全角スラッシュも考慮)
        if (valueStr.includes('/') || valueStr.includes('／')) {
            const parts = valueStr.split(/[\/／]/);
            if (parts.length === 2) {
                const part0 = parts[0]?.trim(); // 前後の空白を除去
                const part1 = parts[1]?.trim(); // 前後の空白を除去
                if (part0 && part1) {
                    const numerator = parseFloat(part0);
                    const denominator = parseFloat(part1);
                    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                        // console.log(`[QuantityParser] Parsed fraction ${valueStr} as ${numerator / denominator}`);
                        return numerator / denominator;
                    } else {
                        console.warn(`[QuantityParser] Invalid fraction format: "${valueStr}". Could not parse numerator/denominator. Returning 1.`);
                        return 1; // 不正な形式の場合
                    }
                }
            }
            console.warn(`[QuantityParser] Invalid fraction format: "${valueStr}". Incorrect number of parts. Returning 1.`);
            return 1; // 不正な形式の場合
        }

        // 通常の数値パース
        const value = parseFloat(valueStr);
        if (isNaN(value)) {
            console.warn(`[QuantityParser] Failed to parse "${valueStr}" as float. Returning 1.`);
            return 1; // パース失敗時はデフォルト1
        }
        return value;
    }

    /**
     * 量を標準グラム数に変換する
     * @param quantity 量データ
     * @param foodName 食品名 (単位変換の特殊ケース用)
     * @param category 食品カテゴリ (単位変換の特殊ケース用)
     * @returns グラム単位の量と信頼度
     */
    static convertToGrams(
        quantity: FoodQuantity,
        foodName?: string,
        category?: string
    ): { grams: number; confidence: number } {
        const { value, unit } = quantity;
        let baseConfidence = 0.7; // 単位不明時のデフォルトグラム換算の基本信頼度

        // 1. 直接的な単位
        if (unit === 'g') return { grams: value, confidence: 1.0 };
        if (unit === 'kg') return { grams: value * 1000, confidence: 1.0 };
        if (unit === 'ml' || unit === 'cc') {
            // ml/cc は食品によって密度が異なるが、一旦 1g/ml とする
            // TODO: 油など密度が大きく異なるものは category/foodName で補正する
            return { grams: value, confidence: 0.95 };
        }

        // 2. カテゴリと単位の組み合わせによる特殊なケース
        if (category && category in CATEGORY_UNIT_GRAMS) {
            const categoryUnits = CATEGORY_UNIT_GRAMS[category];
            if (categoryUnits && unit in categoryUnits) {
                const categoryUnitValue = categoryUnits[unit];

                // 2a. カテゴリ + 単位 + 食品名による特殊ケース (例: 果物の「個」)
                if (typeof categoryUnitValue === 'object' && foodName) {
                    const specificFoodGrams = categoryUnitValue as SpecificFruitGrams;
                    for (const [specificFood, specificGrams] of Object.entries(specificFoodGrams)) {
                        if (foodName.includes(specificFood)) {
                            // console.log(`[QuantityParser] Used category+food specific conversion: ${foodName} ${unit} -> ${specificGrams}g`);
                            return { grams: value * specificGrams, confidence: 0.95 };
                        }
                    }
                    // 特定の食品名に一致しない場合は、一般的な単位換算 (3) へフォールバック
                }
                // 2b. カテゴリ + 単位による換算 (例: ご飯の「杯」)
                else if (typeof categoryUnitValue === 'number') {
                    // console.log(`[QuantityParser] Used category specific conversion: ${category} ${unit} -> ${categoryUnitValue}g`);
                    return { grams: value * categoryUnitValue, confidence: 0.9 };
                }
            }
        }
        // 2c. カテゴリによる単位推定（例: カレールウの「かけ」）
        if (foodName?.includes('カレールウ') && unit === 'かけ') {
            // CATEGORY_UNIT_GRAMS や UNIT_TO_GRAM から値を取得し、undefined の場合はデフォルト値 (例: 5g) を設定
            const curryRouxGram = (CATEGORY_UNIT_GRAMS['調味料']?.['かけ'] as number | undefined)
                ?? (UNIT_TO_GRAM['かけ'])
                ?? 5; // 究極のフォールバック値
            // console.log(`[QuantityParser] Used food name specific conversion: カレールウ ${unit} -> ${curryRouxGram}g`);
            return { grams: value * curryRouxGram, confidence: 0.9 };
        }


        // 3. 一般的な単位換算 (UNIT_TO_GRAM)
        const gramsPerUnit = UNIT_TO_GRAM[unit];
        if (gramsPerUnit !== undefined) {
            // console.log(`[QuantityParser] Used general unit conversion: ${unit} -> ${gramsPerUnit}g`);
            // 一般換算の信頼度は少し下げる (特に「個」「本」など曖昧なもの)
            let confidence = 0.85;
            if (['個', '切れ', '枚', '本', '袋', '缶', 'かけ', '人前'].includes(unit)) {
                confidence = 0.7; // より曖昧な単位は信頼度を下げる
            }
            return { grams: value * gramsPerUnit, confidence };
        }

        // 4. 「標準量」と「合」の特別処理 (3の後に配置)
        if (unit === '標準量') {
            // 単位が不明だったケース。食品によって標準量は異なるが、仮に100gとする
            console.warn(`[QuantityParser] Unit is '標準量' for "${foodName}". Using default 100g.`);
            return { grams: value * 100, confidence: 0.6 }; // 信頼度低め
        }
        if (unit === '合') {
            // 米の「合」はカテゴリ情報で処理されるべきだが、フォールバックとして残す
            const riceGram = 150; // デフォルトは炊飯前
            console.warn(`[QuantityParser] Unit is '合' without rice category info. Using ${riceGram}g/合.`);
            return { grams: value * riceGram, confidence: 0.8 };
        }

        // 5. 解析不能な単位の場合
        console.warn(`[QuantityParser] Unknown unit "${unit}" for "${foodName}". Assuming default ${UNIT_TO_GRAM['人前']}g (equivalent to '人前').`);
        // 不明単位は「人前」相当として扱う（かなり無理やり）
        return { grams: value * (UNIT_TO_GRAM['人前'] || 100), confidence: 0.4 }; // 信頼度かなり低め
    }
} 