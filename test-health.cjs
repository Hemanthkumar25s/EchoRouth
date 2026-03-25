const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/health');
    console.log('Response:', res.data);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
