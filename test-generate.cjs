const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/generate', {
      userId: 'test_user',
      input: 'This is a test article about AI.',
      tone: 'conversational',
      length: 'short',
      language: 'English',
      isPremium: true
    });
    
    console.log('Status:', res.status);
    console.log('Response:', res.data);
  } catch (e) {
    if (e.response) {
      console.error('Status:', e.response.status);
      console.error('Response:', e.response.data);
    } else {
      console.error('Error:', e.message);
    }
  }
}

test();
