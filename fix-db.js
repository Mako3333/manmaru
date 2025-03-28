/**
 * 食品データベースの構造を修正するスクリプト
 * 現在のJSON構造：一部の食品データが"foods"内にあり、一部がトップレベルにある
 * 修正後の構造：すべての食品データが"foods"オブジェクト内に存在する
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 現在のファイルの場所を取得（ESモジュール対応）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定
const filePath = path.join(process.cwd(), 'public/data/food_nutrition_database.json');
const backupPath = filePath + '.backup';
const fixedPath = filePath + '.fixed';

console.log('食品データベース修正処理を開始します...');

try {
    // 元のファイルを読み込み
    console.log(`ファイル読み込み中: ${filePath}`);
    const rawData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);

    // バックアップ作成
    console.log(`バックアップ作成中: ${backupPath}`);
    fs.writeFileSync(backupPath, rawData);

    // 既存のfoodsオブジェクトを取得（存在しない場合は空オブジェクト）
    const foodsData = { ...(data.foods || {}) };

    // トップレベルの食品データを特定
    const foodItems = Object.entries(data)
        .filter(([key, value]) =>
            key !== 'foods' &&
            typeof value === 'object' &&
            value !== null &&
            (value.name || key) // nameプロパティがあるか、キー自体が名前として使える
        )
        .map(([key, value]) => {
            // IDが無い場合はキーをIDとして使用
            if (!value.id) {
                value.id = key.replace(/[^\w\s]/g, '-').toLowerCase();
            }
            // 名前が無い場合はキーを名前として使用
            if (!value.name) {
                value.name = key;
            }
            return value;
        });

    console.log(`トップレベルの食品データ: ${foodItems.length}件`);
    console.log(`既存のfoodsオブジェクト内の食品データ: ${Object.keys(foodsData).length}件`);

    // 食品データをマージ
    let duplicateCount = 0;
    let addedCount = 0;

    foodItems.forEach(item => {
        const id = item.id;
        if (foodsData[id]) {
            duplicateCount++;
            // 既存のIDがある場合は上書きしない（または必要に応じてマージポリシーを実装）
        } else {
            foodsData[id] = item;
            addedCount++;
        }
    });

    // 新しいデータ構造を作成
    const newData = { foods: foodsData };

    // 修正済みファイル保存
    console.log(`修正済みファイル作成中: ${fixedPath}`);
    fs.writeFileSync(fixedPath, JSON.stringify(newData, null, 2));

    // 統計情報表示
    console.log('\n--- 処理結果 ---');
    console.log(`追加された食品データ: ${addedCount}件`);
    console.log(`重複（スキップ）された食品データ: ${duplicateCount}件`);
    console.log(`修正後の総食品データ数: ${Object.keys(foodsData).length}件`);

    // 成功したら元のファイルを置き換え
    console.log(`\n元のファイルを修正済みファイルで置き換えています...`);
    fs.copyFileSync(fixedPath, filePath);
    console.log('処理が完了しました。');

} catch (error) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
}
