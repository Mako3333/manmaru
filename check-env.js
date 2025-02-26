const dotenv = require('dotenv');

console.log('Working directory:', process.cwd());
console.log('Env file path:', require('path').resolve('.env.local'));

try {
    const result = dotenv.config({ path: '.env.local' });
    console.log('Dotenv result:', result);

    if (result.error) {
        console.error('Dotenv error:', result.error);
    }
} catch (error) {
    console.error('Exception loading dotenv:', error);
}

console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY);
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY); 