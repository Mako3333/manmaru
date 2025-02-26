const axios = require('axios');

async function testNutritionAPI() {
    try {
        const response = await axios.post('http://localhost:3000/api/update-nutrition-log', {
            userId: "94e27610-c83b-4499-b39b-7957dc55ee8e"
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
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

testNutritionAPI(); 