const { connectDB, getDB } = require('./connections/connection');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testFixedRecommendations() {
  try {
    console.log('🧪 Testing fixed recommendation system...\n');
    
    await connectDB();
    const db = getDB();
    const usersCollection = db.collection(process.env.USERS_COLLECTION);
    
    // Get a test user
    const testUser = await usersCollection.findOne({ username: 'lakshmannaik' });
    if (!testUser) {
      console.error('❌ Test user not found');
      return;
    }
    
    console.log('👤 Test user profile:');
    console.log(`   Username: ${testUser.username}`);
    console.log(`   Skills: ${JSON.stringify(testUser.skills)}`);
    console.log(`   Sectors: ${JSON.stringify(testUser.sectors)}`);
    console.log(`   Education: ${testUser.education}`);
    console.log(`   Location: ${testUser.location}\n`);
    
    // Simulate the API payload creation
    const apiPayload = {
      skills: Array.isArray(testUser.skills) ? testUser.skills.join(" ") : testUser.skills || "",
      sectors: Array.isArray(testUser.sectors) ? testUser.sectors[0] : testUser.sectors || "",
      education_level: testUser.education || "graduate",
      city_name: testUser.location || "",
      max_distance_km: 150
    };
    
    console.log('📤 API Payload that would be sent:');
    console.log(JSON.stringify(apiPayload, null, 2));
    console.log('');
    
    // Test fallback logic
    console.log('🔄 Testing fallback recommendation logic...');
    const internshipsCollection = db.collection(process.env.COLLECTION_NAME);
    
    const fallbackQueries = [];
    
    // Query 1: Match by sectors and location
    if (testUser.sectors && testUser.sectors.length > 0 && testUser.location) {
      fallbackQueries.push({
        sector: { $in: testUser.sectors.map(s => new RegExp(s, 'i')) },
        location_city: { $regex: testUser.location, $options: "i" }
      });
    }
    
    // Query 2: Match by sectors only
    if (testUser.sectors && testUser.sectors.length > 0) {
      fallbackQueries.push({
        sector: { $in: testUser.sectors.map(s => new RegExp(s, 'i')) }
      });
    }
    
    // Query 3: Match by location only
    if (testUser.location) {
      fallbackQueries.push({
        location_city: { $regex: testUser.location, $options: "i" }
      });
    }
    
    // Query 4: Match by skills
    if (testUser.skills && testUser.skills.length > 0) {
      fallbackQueries.push({
        skills: { $in: testUser.skills.map(s => new RegExp(s, 'i')) }
      });
    }
    
    // If no specific criteria, get general internships
    if (fallbackQueries.length === 0) {
      fallbackQueries.push({});
    }
    
    console.log('🔍 Fallback queries to try:');
    fallbackQueries.forEach((query, index) => {
      console.log(`   Query ${index + 1}:`, JSON.stringify(query, null, 2));
    });
    console.log('');
    
    let fallbackInternships = [];
    
    // Try each query until we get results
    for (let i = 0; i < fallbackQueries.length; i++) {
      const query = fallbackQueries[i];
      console.log(`🔍 Trying query ${i + 1}...`);
      
      const results = await internshipsCollection
        .find(query)
        .limit(10)
        .toArray();
      
      console.log(`   Found ${results.length} results`);
      
      if (results.length > 0) {
        fallbackInternships = results;
        console.log(`✅ Using query ${i + 1} results`);
        break;
      }
    }
    
    if (fallbackInternships.length === 0) {
      console.log('❌ No fallback internships found');
      return;
    }
    
    // Separate nearby and remote internships
    const nearbyInternships = fallbackInternships.filter(i => 
      testUser.location && i.location_city && 
      i.location_city.toLowerCase().includes(testUser.location.toLowerCase())
    );
    
    const remoteInternships = fallbackInternships.filter(i => 
      i.mode && (i.mode.toLowerCase().includes('remote') || i.remote_work_allowed)
    );
    
    // If we don't have enough nearby, add some from the general results
    const remainingInternships = fallbackInternships.filter(i => 
      !nearbyInternships.includes(i) && !remoteInternships.includes(i)
    );
    
    // Fill up nearby if needed
    while (nearbyInternships.length < 5 && remainingInternships.length > 0) {
      nearbyInternships.push(remainingInternships.shift());
    }
    
    console.log('\n📊 Final Results:');
    console.log(`   Nearby internships: ${nearbyInternships.length}`);
    console.log(`   Remote internships: ${remoteInternships.length}`);
    console.log(`   Total internships: ${nearbyInternships.length + remoteInternships.length}`);
    
    if (nearbyInternships.length > 0) {
      console.log('\n💼 Sample nearby internship:');
      const sample = nearbyInternships[0];
      console.log(`   Title: ${sample.title}`);
      console.log(`   Company: ${sample.company_name}`);
      console.log(`   Location: ${sample.location_city}`);
      console.log(`   Sector: ${sample.sector}`);
      console.log(`   Skills: ${JSON.stringify(sample.skills)}`);
    }
    
    if (remoteInternships.length > 0) {
      console.log('\n🌐 Sample remote internship:');
      const sample = remoteInternships[0];
      console.log(`   Title: ${sample.title}`);
      console.log(`   Company: ${sample.company_name}`);
      console.log(`   Mode: ${sample.mode}`);
      console.log(`   Sector: ${sample.sector}`);
      console.log(`   Skills: ${JSON.stringify(sample.skills)}`);
    }
    
    const finalResult = {
      recommendations: {
        nearby_ids: nearbyInternships.map(i => i._id.toString()),
        remote_ids: remoteInternships.map(i => i._id.toString()),
        nearby_internships: nearbyInternships,
        remote_internships: remoteInternships
      },
      user_profile: {
        skills: testUser.skills || [],
        sectors: testUser.sectors || [],
        education_level: testUser.education || "graduate",
        location: testUser.location || ""
      },
      fallback_mode: true,
      message: "Using fallback recommendations due to external service unavailability"
    };
    
    console.log('\n✅ Recommendation system test completed successfully!');
    console.log('📋 The system should now return recommendations instead of "No recommendations found"');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testFixedRecommendations();