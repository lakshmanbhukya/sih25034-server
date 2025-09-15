const { connectDB, getDB } = require('./connections/connection');
const fetch = require('node-fetch');
require('dotenv').config();

async function debugRecommendations() {
  try {
    console.log('🔍 Starting recommendation system debug...\n');
    
    // 1. Test database connection
    console.log('1. Testing database connection...');
    await connectDB();
    const db = getDB();
    console.log('✅ Database connected successfully');
    
    // 2. Check users collection
    console.log('\n2. Checking users collection...');
    const usersCollection = db.collection(process.env.USERS_COLLECTION);
    const userCount = await usersCollection.countDocuments();
    console.log(`📊 Total users: ${userCount}`);
    
    if (userCount > 0) {
      const sampleUser = await usersCollection.findOne({}, { projection: { password: 0 } });
      console.log('👤 Sample user profile:');
      console.log(JSON.stringify(sampleUser, null, 2));
    }
    
    // 3. Check internships collection
    console.log('\n3. Checking internships collection...');
    const internshipsCollection = db.collection(process.env.COLLECTION_NAME);
    const internshipCount = await internshipsCollection.countDocuments();
    console.log(`📊 Total internships: ${internshipCount}`);
    
    if (internshipCount > 0) {
      const sampleInternship = await internshipsCollection.findOne({});
      console.log('💼 Sample internship:');
      console.log(JSON.stringify(sampleInternship, null, 2));
    }
    
    // 4. Test external API
    console.log('\n4. Testing external recommendation API...');
    console.log(`🌐 MODEL_URL: ${process.env.MODEL_URL}`);
    
    const testPayload = {
      skills: "javascript react python",
      sectors: "technology",
      education_level: "12th",
      city_name: "Mumbai",
      max_distance_km: 150
    };
    
    console.log('📤 Test payload:');
    console.log(JSON.stringify(testPayload, null, 2));
    
    try {
      const response = await fetch(process.env.MODEL_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      });
      
      console.log(`📡 API Response Status: ${response.status} ${response.statusText}`);
      
      const responseText = await response.text();
      console.log('📝 API Response Body:');
      console.log(responseText.substring(0, 1000));
      
      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          console.log('\n✅ API Response parsed successfully');
          console.log('🔍 Response structure:');
          console.log('- Has recommendations:', !!data.recommendations);
          console.log('- Nearby IDs count:', data.recommendations?.nearby_ids?.length || 0);
          console.log('- Remote IDs count:', data.recommendations?.remote_ids?.length || 0);
          
          if (data.recommendations?.nearby_ids?.length > 0) {
            console.log('📋 Sample nearby IDs:', data.recommendations.nearby_ids.slice(0, 3));
          }
          if (data.recommendations?.remote_ids?.length > 0) {
            console.log('📋 Sample remote IDs:', data.recommendations.remote_ids.slice(0, 3));
          }
        } catch (parseError) {
          console.error('❌ Failed to parse API response as JSON:', parseError.message);
        }
      } else {
        console.error('❌ API request failed');
      }
    } catch (apiError) {
      console.error('❌ External API error:', apiError.message);
      console.log('🔄 This will trigger fallback mode in the actual application');
    }
    
    // 5. Test fallback query
    console.log('\n5. Testing fallback recommendation logic...');
    const fallbackQuery = {
      sector: { $in: ["technology", "software"] },
      location_city: { $regex: "Mumbai", $options: "i" }
    };
    
    console.log('🔍 Fallback query:');
    console.log(JSON.stringify(fallbackQuery, null, 2));
    
    const fallbackResults = await internshipsCollection
      .find(fallbackQuery)
      .limit(5)
      .toArray();
    
    console.log(`📊 Fallback results count: ${fallbackResults.length}`);
    if (fallbackResults.length > 0) {
      console.log('💼 Sample fallback internship:');
      console.log(JSON.stringify(fallbackResults[0], null, 2));
    }
    
    // 6. Check environment variables
    console.log('\n6. Environment variables check:');
    console.log('✅ MONGO_URI:', process.env.MONGO_URI ? 'Set' : 'Missing');
    console.log('✅ DB_NAME:', process.env.DB_NAME || 'Missing');
    console.log('✅ COLLECTION_NAME:', process.env.COLLECTION_NAME || 'Missing');
    console.log('✅ USERS_COLLECTION:', process.env.USERS_COLLECTION || 'Missing');
    console.log('✅ MODEL_URL:', process.env.MODEL_URL ? 'Set' : 'Missing');
    console.log('✅ JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Missing');
    
    console.log('\n🎉 Debug completed successfully!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    process.exit(0);
  }
}

debugRecommendations();