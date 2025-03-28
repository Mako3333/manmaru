/**
 * 食品データベースの構造を修正するスクリプト（第2フェーズ）
 * 問題：foods内の一部の食品データが日本語をキーとして使用している
 * 修正：すべての食品データのキーをIDに変更する
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 現在のファイルの場所を取得（ESモジュール対応）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定
const filePath = path.join(process.cwd(), 'public/data/food_nutrition_database.json');
const backupPath = filePath + '.backup2';
const fixedPath = filePath + '.fixed2';

console.log('食品データベース修正処理（フェーズ2）を開始します...');

try {
    // 元のファイルを読み込み
    console.log(`ファイル読み込み中: ${filePath}`);
    const rawData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);

    // バックアップ作成
    console.log(`バックアップ作成中: ${backupPath}`);
    fs.writeFileSync(backupPath, rawData);

    // 日本語キーの食品データを修正
    const foods = data.foods || {};
    const newFoods = {};
    let changedCount = 0;
    let unchangedCount = 0;

    // すべての食品データを処理
    for (const key of Object.keys(foods)) {
        const food = foods[key];

        // IDが存在し、かつキーとIDが異なる場合は修正
        if (food.id && key !== food.id) {
            newFoods[food.id] = food;
            changedCount++;
            console.log(`変更: "${key}" -> "${food.id}"`);
        } else {
            newFoods[key] = food;
            unchangedCount++;
        }
    }

    // 新しいデータ構造を作成
    const newData = {
        foods: newFoods
    };

    // 修正済みファイル保存
    console.log(`修正済みファイル作成中: ${fixedPath}`);
    fs.writeFileSync(fixedPath, JSON.stringify(newData, null, 2));

    // 統計情報表示
    console.log('\n--- 処理結果 ---');
    console.log(`変更された食品データ: ${changedCount}件`);
    console.log(`変更されなかった食品データ: ${unchangedCount}件`);
    console.log(`総食品データ数: ${Object.keys(newFoods).length}件`);

    // 成功したら元のファイルを置き換え
    console.log(`\n元のファイルを修正済みファイルで置き換えています...`);
    fs.copyFileSync(fixedPath, filePath);
    console.log('処理が完了しました。');

} catch (error) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
} 