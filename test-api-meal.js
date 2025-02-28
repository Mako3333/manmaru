// 食事画像解析APIのテストスクリプト
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

// Base64エンコードされた画像データを読み込む
const getBase64Image = (filePath) => {
    try {
        const imageBuffer = fs.readFileSync(filePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        return base64Image;
    } catch (error) {
        console.error('画像の読み込みエラー:', error);
        process.exit(1);
    }
};

// APIをテストする関数
const testMealAnalysisAPI = async () => {
    try {
        // テスト用の画像パス（プロジェクトに合わせて変更してください）
        const imagePath = path.join(__dirname, 'test-meal-image.jpg');

        // 画像が存在するか確認
        if (!fs.existsSync(imagePath)) {
            console.error(`テスト画像が見つかりません: ${imagePath}`);
            console.log('テスト画像をプロジェクトルートに配置してください。');
            process.exit(1);
        }

        // 画像をBase64エンコード
        const base64Image = getBase64Image(imagePath);
        console.log(`画像をBase64エンコードしました (長さ: ${base64Image.length})`);

        // APIエンドポイント
        const apiUrl = 'http://localhost:3000/api/analyze-meal';

        console.log(`APIリクエスト送信中: ${apiUrl}`);

        // APIリクエスト
        const response = await axios.post(apiUrl, {
            image: base64Image,
            mealType: 'lunch'
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        // レスポンスの表示
        console.log('APIレスポンス:');
        console.log(JSON.stringify(response.data, null, 2));

        console.log('\nテスト成功!');
    } catch (error) {
        console.error('APIテストエラー:');
        if (error.response) {
            // サーバーからのレスポンスがある場合
            console.error(`ステータスコード: ${error.response.status}`);
            console.error('レスポンスデータ:', error.response.data);
        } else if (error.request) {
            // リクエストは送信されたがレスポンスがない場合
            console.error('レスポンスが受信できませんでした');
            console.error(error.request);
        } else {
            // リクエスト設定中にエラーが発生した場合
            console.error('エラーメッセージ:', error.message);
        }
        console.error('エラー設定:', error.config);
    }
};

// テスト実行
testMealAnalysisAPI(); 