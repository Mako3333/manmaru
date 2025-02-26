const axios = require('axios');

async function testRecipeAPI() {
    try {
        const response = await axios.post('http://localhost:3000/api/recommend-recipes', {
            userId: "test_user_123",
            servings: 2
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30秒のタイムアウト
        });

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

testRecipeAPI(); 