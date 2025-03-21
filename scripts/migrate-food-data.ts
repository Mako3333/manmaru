// scripts/migrate-food-data.ts

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ESM環境で__dirnameの代替を作成
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.localファイルのパスを明示的に指定
dotenv.config({ path: path.resolve(path.dirname(__dirname), '.env.local') });

// 環境変数のデバッグ
console.log('環境変数確認:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// 環境変数が設定されていなければエラー表示
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('必要な環境変数が設定されていません。.env.localファイルを確認してください。');
    console.error('必要な変数: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 食品データの型定義
interface FoodItem {
    name: string;
    calories?: number;
    protein?: number;
    iron?: number;
    folic_acid?: number;
    calcium?: number;
    vitamin_d?: number;
    standard_quantity?: string;
    aliases?: string[];
}

interface FoodDatabase {
    [id: string]: FoodItem;
}

// Supabaseクライアント初期化
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateFoodData() {
    try {
        // JSONデータ読み込み
        console.log('Reading food database...');
        const foodData: FoodDatabase = JSON.parse(
            fs.readFileSync(path.join(path.dirname(__dirname), 'public/data/food_nutrition_database.json'), 'utf8')
        );

        // foodDataのデバッグ出力を追加
        console.log('データ構造:', Object.keys(foodData));

        // foodsキーが存在する場合はその配下のデータを使用
        const actualFoodData = foodData.foods || foodData;

        // 数値で始まるIDのみをフィルタリング
        let foodItems = Object.entries(actualFoodData).map(([key, item]) => {
            // itemの中のidを使ってデータを再構成
            return [item.id || key, item];
        }).filter(([id]) => /^\d/.test(id));

        console.log(`実際の食品数: ${foodItems.length}`);

        // データ構造を確認
        console.log('データ構造サンプル:');
        const sampleKey = Object.keys(foodData)[0];
        console.log(`サンプルID: ${sampleKey}`);
        console.log(JSON.stringify(foodData[sampleKey], null, 2));

        // バッチサイズ定義
        const batchSize = 50;

        // バッチ処理でデータ挿入
        for (let i = 0; i < foodItems.length; i += batchSize) {
            const batch = foodItems.slice(i, i + batchSize);

            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(foodItems.length / batchSize)}`);

            // 食品レコード作成
            const foodRecords = batch.map(([id, item]) => {
                // データの存在確認
                if (!item || typeof item !== 'object') {
                    console.error(`無効なデータ形式: ID=${id}`, item);
                    return null;
                }

                // nameフィールドの確認
                if (!item.name || typeof item.name !== 'string') {
                    console.error(`名前フィールドがありません: ID=${id}`, item);
                    item.name = `不明食品_${id}`;
                }

                // カテゴリIDの処理
                let categoryId = null;
                // IDが数字で始まるかチェック（最初の2桁をカテゴリIDとして使用）
                if (id && typeof id === 'string') {
                    // IDから数字パターンを抽出
                    const match = id.match(/^(\d+)/);
                    if (match && match[1]) {
                        // 数字で始まる場合、最初の2桁をカテゴリIDとして使用
                        const numericPart = match[1];
                        if (numericPart.length >= 2) {
                            categoryId = numericPart.substr(0, 2);

                            // 実際にfood_categoriesに存在するか確認
                            if (!['01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
                                '11', '12', '13', '14', '15', '16', '17', '18'].includes(categoryId)) {
                                console.warn(`カテゴリID ${categoryId} は登録されていません。null設定します。 (ID=${id})`);
                                categoryId = null;
                            } else {
                                console.log(`カテゴリID ${categoryId} を設定しました。 (ID=${id})`);
                            }
                        } else {
                            console.warn(`数値部分が2桁未満です: ${numericPart} (ID=${id})`);
                        }
                    } else {
                        console.warn(`IDが数値で始まりません: ${id}`);
                    }
                } else {
                    console.warn(`無効なID形式: ${id}`);
                }

                return {
                    original_id: id,
                    name: item.name,
                    calories: item.calories || 0,
                    protein: item.protein || 0,
                    iron: item.iron || 0,
                    folic_acid: item.folic_acid || 0,
                    calcium: item.calcium || 0,
                    vitamin_d: item.vitamin_d || 0,
                    standard_quantity: item.standard_quantity || '100g',
                    cooking_method: extractCookingMethod(item.name),
                    category_id: categoryId,
                    // 特定の食材が妊娠中に注意が必要かを判定
                    pregnancy_caution: checkPregnancyCaution(item.name)
                };
            }).filter(record => record !== null); // nullレコードを除外

            if (foodRecords.length === 0) {
                console.log('有効なレコードがありません。スキップします。');
                continue;
            }

            // 食品データ挿入
            const { data: insertedFoods, error: foodError } = await supabase
                .from('food_items')
                .insert(foodRecords)
                .select('id, original_id');

            if (foodError) {
                console.error('Error inserting foods:', foodError);
                continue;
            }

            // food_itemsにデータ挿入後
            console.log('挿入されたデータ:', insertedFoods?.length || 0, '件');
            console.log('最初のデータ:', insertedFoods?.[0] || 'なし');

            // エイリアスレコード作成
            const aliasRecords = [];

            for (let j = 0; j < batch.length; j++) {
                const [_, item] = batch[j];

                // insertedFoodsの範囲チェック
                if (!insertedFoods || j >= insertedFoods.length) {
                    console.warn(`インデックス ${j} に対応するinsertedFoodsがありません`);
                    continue;
                }

                const foodId = insertedFoods[j].id;

                if (item && item.aliases && Array.isArray(item.aliases)) {
                    for (const alias of item.aliases) {
                        if (alias && typeof alias === 'string' && alias.trim()) {
                            aliasRecords.push({
                                food_id: foodId,
                                alias: alias.trim()
                            });
                        }
                    }
                }
            }

            // エイリアスデータ挿入
            if (aliasRecords.length > 0) {
                const { error: aliasError } = await supabase
                    .from('food_aliases')
                    .insert(aliasRecords);

                if (aliasError) {
                    console.error('Error inserting aliases:', aliasError);
                }
            }

            console.log(`Processed ${Math.min(i + batchSize, foodItems.length)}/${foodItems.length} items`);
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

// 料理名から調理法を抽出する関数
function extractCookingMethod(name: string | undefined): string | null {
    // nameが存在しない場合はnullを返す
    if (!name) {
        return null;
    }

    const methods = ['生', 'ゆで', '油いため', '焼き', '水煮', '蒸し', '乾', 'フライ'];
    for (const method of methods) {
        if (name.includes(method)) {
            return method;
        }
    }
    return null;
}

// 妊娠中注意が必要な食品のチェック
function checkPregnancyCaution(name: string | undefined): boolean {
    // nameが存在しない場合はfalseを返す
    if (!name) {
        return false;
    }

    const highRiskFoods = [
        { pattern: '生肉', reason: 'リステリア症のリスクがあります' },
        { pattern: '生ハム', reason: 'リステリア症のリスクがあります' },
        { pattern: '刺身', reason: '食中毒のリスクがあります' },
        { pattern: 'レバー', reason: 'ビタミンAの過剰摂取リスクがあります' }
    ];

    const mediumRiskFoods = [
        { pattern: 'まぐろ', reason: '水銀含有量が高い可能性があります' },
        { pattern: 'カジキ', reason: '水銀含有量が高い可能性があります' },
        { pattern: 'クロマグロ', reason: '水銀含有量が高い可能性があります' }
    ];

    for (const food of highRiskFoods) {
        if (name.includes(food.pattern)) {
            return true;
        }
    }

    for (const food of mediumRiskFoods) {
        if (name.includes(food.pattern)) {
            return true;
        }
    }

    return false;
}

// 料理名からカテゴリを抽出する関数
function extractCategory(name: string): string | null {
    // カテゴリマッピング - 実際のデータに合わせて調整
    const categoryPatterns = [
        { pattern: 'かぼちゃ', category: '野菜' },
        { pattern: 'まめ', category: '豆類' },
        { pattern: 'とうがらし', category: '野菜' },
        // 他のパターンを追加
    ];

    for (const { pattern, category } of categoryPatterns) {
        if (name.includes(pattern)) {
            return category;
        }
    }

    return null;
}

// スクリプト実行
migrateFoodData();