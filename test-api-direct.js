const fs = require('fs');
const axios = require('axios');

// APIキーを直接指定（テスト用）
const GEMINI_API_KEY = 'your_actual_api_key_here';

async function testAnalyzeMealAPI() {
    try {
        // Base64エンコードされた画像データを読み込む
        const base64Image = fs.readFileSync('encoded_image.txt', 'utf8');
        
        // APIリクエストを送信
        const response = await axios.post('http://localhost:3000/api/analyze-meal', {
            imageBase64: base64Image,
            mealType: 'lunch',
            // テスト用にAPIキーをリクエストに含める
            apiKey: GEMINI_API_KEY
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('API Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error calling API:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testAnalyzeMealAPI(); 