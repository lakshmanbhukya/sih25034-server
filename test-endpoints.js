const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testEndpoints() {
  console.log('🧪 Testing server endpoints...\n');
  
  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health:', healthData);
    
    // Test DB status
    console.log('\n2. Testing DB status...');
    const dbResponse = await fetch(`${BASE_URL}/db-status`);
    const dbData = await dbResponse.json();
    console.log('✅ DB Status:', dbData);
    
    // Test recommendations endpoint (should fail without auth)
    console.log('\n3. Testing recommendations endpoint (no auth)...');
    const recResponse = await fetch(`${BASE_URL}/recommendations/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_distance_km: 150 })
    });
    const recData = await recResponse.json();
    console.log('❌ Expected auth error:', recData);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEndpoints();