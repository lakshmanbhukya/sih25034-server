const { connectDB, getDB } = require('./connections/connection');
require('dotenv').config();

async function checkUserProfile() {
  try {
    console.log('🔍 Checking user profile structure...\n');
    
    await connectDB();
    const db = getDB();
    const usersCollection = db.collection(process.env.USERS_COLLECTION);
    
    // Get all users to see their profile structure
    const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
    
    console.log(`📊 Total users: ${users.length}\n`);
    
    users.forEach((user, index) => {
      console.log(`👤 User ${index + 1}:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Skills: ${JSON.stringify(user.skills)}`);
      console.log(`   Sectors: ${JSON.stringify(user.sectors)}`);
      console.log(`   Education: ${JSON.stringify(user.education)}`);
      console.log(`   Location: ${user.location}`);
      console.log('');
    });
    
    // Check the education field structure specifically
    console.log('🎓 Education field analysis:');
    users.forEach((user, index) => {
      console.log(`User ${index + 1} education type:`, typeof user.education);
      console.log(`User ${index + 1} education value:`, user.education);
      
      if (typeof user.education === 'object' && user.education !== null) {
        console.log(`User ${index + 1} education keys:`, Object.keys(user.education));
        console.log(`User ${index + 1} has twelfth:`, !!user.education.twelfth);
        console.log(`User ${index + 1} has tenth:`, !!user.education.tenth);
        console.log(`User ${index + 1} has graduate:`, !!user.education.graduate);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkUserProfile();