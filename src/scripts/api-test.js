// APIテスト用スクリプト
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// テスト用のユーザーID
const TEST_USER_ID = 'test-user-123';

// テスト用の画像をBase64エンコードする関数
function encodeImageToBase64(imagePath) {
    try {
        // 画像ファイルを読み込む
        const imageBuffer = fs.readFileSync(imagePath);
        // Base64エンコード
        return imageBuffer.toString('base64');
    } catch (error) {
        console.error('画像のエンコードに失敗しました:', error);
        return null;
    }
}

// 食事分析APIのテスト
async function testAnalyzeMeal() {
    console.log('=== 食事分析APIのテスト ===');

    try {
        // テスト用の画像がない場合はスキップ
        console.log('注意: テスト用の画像がないため、ダミーデータを使用します');

        // ダミーのBase64エンコード画像（1x1ピクセルの透明PNG）
        const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

        const response = await axios.post('http://localhost:3000/api/analyze-meal', {
            imageBase64: dummyBase64,
            mealType: 'breakfast'
        });

        console.log('ステータス:', response.status);
        console.log('レスポンス:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('エラー:', error.response ? error.response.data : error.message);
        return null;
    }
}

// レシピ推奨APIのテスト
async function testRecommendRecipes() {
    console.log('\n=== レシピ推奨APIのテスト ===');

    try {
        const response = await axios.post('http://localhost:3000/api/recommend-recipes', {
            userId: TEST_USER_ID,
            servings: 2
        });

        console.log('ステータス:', response.status);
        console.log('レスポンス:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('エラー:', error.response ? error.response.data : error.message);
        return null;
    }
}

// 栄養ログ更新APIのテスト
async function testUpdateNutritionLog() {
    console.log('\n=== 栄養ログ更新APIのテスト ===');

    try {
        const response = await axios.post('http://localhost:3000/api/update-nutrition-log', {
            userId: TEST_USER_ID
        });

        console.log('ステータス:', response.status);
        console.log('レスポンス:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('エラー:', error.response ? error.response.data : error.message);
        return null;
    }
}

// エラーケースのテスト
async function testErrorCases() {
    console.log('\n=== エラーケースのテスト ===');

    // 画像なしでの食事分析API呼び出し
    console.log('\n1. 画像なしでの食事分析API呼び出し:');
    try {
        const response = await axios.post('http://localhost:3000/api/analyze-meal', {
            mealType: 'breakfast'
        });
        console.log('ステータス:', response.status);
        console.log('レスポンス:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('期待通りのエラー:', error.response ? error.response.data : error.message);
    }

    // 無効なユーザーIDでのレシピ推奨API呼び出し
    console.log('\n2. 無効なユーザーIDでのレシピ推奨API呼び出し:');
    try {
        const response = await axios.post('http://localhost:3000/api/recommend-recipes', {
            userId: 'invalid-user',
            servings: 2
        });
        console.log('ステータス:', response.status);
        console.log('レスポンス:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('期待通りのエラー:', error.response ? error.response.data : error.message);
    }
}

// メイン実行関数
async function runTests() {
    console.log('manmaruアプリAPIテスト開始\n');

    // 各APIのテストを実行
    await testAnalyzeMeal();
    await testRecommendRecipes();
    await testUpdateNutritionLog();
    await testErrorCases();

    console.log('\nAPIテスト完了');
}

// テストの実行
runTests().catch(console.error); 