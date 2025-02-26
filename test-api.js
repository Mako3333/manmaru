require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const axios = require('axios');

async function testAnalyzeMealAPI() {
    try {
        // 環境変数が設定されているか確認
        if (!process.env.GEMINI_API_KEY) {
            console.warn('警告: GEMINI_API_KEY環境変数が設定されていません');
        }

        // Base64エンコードされた画像データを読み込む
        const base64Image = fs.readFileSync('encoded_image.txt', 'utf8').trim();

        // データURLプレフィックスがない場合は追加（APIリクエスト用）
        const imageData = base64Image.startsWith('data:')
            ? base64Image
            : `data:image/jpeg;base64,${base64Image}`;

        // APIリクエストを送信
        const response = await axios.post('http://localhost:3000/api/analyze-meal', {
            imageBase64: imageData,
            mealType: 'lunch'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // レスポンスを表示
        console.log('API Response:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error calling API:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

// APIをテスト
testAnalyzeMealAPI(); 