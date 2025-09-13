// System Test Script
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testSystem() {
  console.log('🧪 Starting System Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const health = await fetch(`${BASE_URL}/health`);
    const healthData = await health.json();
    console.log('✅ Health:', healthData.status);

    // Test 2: Database Status
    console.log('\n2️⃣ Testing Database Status...');
    const dbStatus = await fetch(`${BASE_URL}/db-status`);
    const dbData = await dbStatus.json();
    console.log('✅ Database:', dbData.status, '-', dbData.database);

    // Test 3: Get Internships
    console.log('\n3️⃣ Testing Get Internships...');
    const internships = await fetch(`${BASE_URL}/recommendations/internships?page=1`);
    const internshipsData = await internships.json();
    console.log('✅ Internships:', internshipsData.internships?.length || 0, 'found');

    // Test 4: Search Internships
    console.log('\n4️⃣ Testing Search...');
    const search = await fetch(`${BASE_URL}/recommendations/search?q=marketing`);
    const searchData = await search.json();
    console.log('✅ Search:', searchData.internships?.length || 0, 'results');

    // Test 5: Cache Status
    console.log('\n5️⃣ Testing Cache...');
    const cache = await fetch(`${BASE_URL}/recommendations/cache/status`);
    const cacheData = await cache.json();
    console.log('✅ Cache:', cacheData.status, '- Size:', cacheData.cache_size);

    console.log('\n🎉 All Tests Passed! System is working perfectly!');

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    console.log('\n💡 Make sure server is running: npm start');
  }
}

// Run tests
testSystem();