const MessagePackUtil = require('../utils/messagepack');

/**
 * Test script to demonstrate MessagePack vs JSON performance
 */
function runPerformanceTest() {
  console.log('🚀 MessagePack vs JSON Performance Test\n');

  // Sample data similar to your recommendation API payload
  const sampleData = {
    skills: "javascript react node.js python machine learning data science artificial intelligence",
    sectors: "technology software development",
    education_level: "graduate",
    city_name: "Mumbai",
    max_distance_km: 150,
    user_preferences: {
      remote_work: true,
      full_time: false,
      stipend_range: [10000, 50000]
    },
    // Add some bulk data to see compression benefits
    sample_internships: Array(50).fill({
      id: Math.random(),
      title: "Software Development Internship",
      company: "Tech Company Pvt Ltd",
      description: "Exciting opportunity to work with cutting-edge technologies in a fast-paced environment",
      requirements: ["JavaScript", "React", "Node.js", "MongoDB"],
      location: "Mumbai, Maharashtra",
      stipend: 25000,
      duration: "3 months"
    })
  };

  // JSON Performance Test
  console.log('📊 JSON Performance:');
  const jsonStart = Date.now();
  const jsonString = JSON.stringify(sampleData);
  const jsonSerializeTime = Date.now() - jsonStart;

  const jsonParseStart = Date.now();
  const jsonParsed = JSON.parse(jsonString);
  const jsonParseTime = Date.now() - jsonParseStart;

  console.log(`   Serialization: ${jsonSerializeTime}ms`);
  console.log(`   Deserialization: ${jsonParseTime}ms`);
  console.log(`   Size: ${jsonString.length} bytes`);
  console.log(`   Total Time: ${jsonSerializeTime + jsonParseTime}ms\n`);

  // MessagePack Performance Test
  console.log('📦 MessagePack Performance:');
  const msgpackStart = Date.now();
  const msgpackBuffer = MessagePackUtil.encode(sampleData);
  const msgpackSerializeTime = Date.now() - msgpackStart;

  const msgpackParseStart = Date.now();
  const msgpackParsed = MessagePackUtil.decode(msgpackBuffer);
  const msgpackParseTime = Date.now() - msgpackParseStart;

  console.log(`   Serialization: ${msgpackSerializeTime}ms`);
  console.log(`   Deserialization: ${msgpackParseTime}ms`);
  console.log(`   Size: ${msgpackBuffer.length} bytes`);
  console.log(`   Total Time: ${msgpackSerializeTime + msgpackParseTime}ms\n`);

  // Performance Comparison
  const sizeReduction = ((jsonString.length - msgpackBuffer.length) / jsonString.length * 100);
  const speedImprovement = (((jsonSerializeTime + jsonParseTime) - (msgpackSerializeTime + msgpackParseTime)) / (jsonSerializeTime + jsonParseTime) * 100);

  console.log('🎯 Performance Improvement:');
  console.log(`   Size Reduction: ${sizeReduction.toFixed(2)}%`);
  console.log(`   Speed Improvement: ${speedImprovement.toFixed(2)}%`);
  console.log(`   Network Savings: ${(jsonString.length - msgpackBuffer.length)} bytes\n`);

  // Verify data integrity
  const jsonMatch = JSON.stringify(jsonParsed) === JSON.stringify(sampleData);
  const msgpackMatch = JSON.stringify(msgpackParsed) === JSON.stringify(sampleData);

  console.log('✅ Data Integrity Check:');
  console.log(`   JSON: ${jsonMatch ? 'PASS' : 'FAIL'}`);
  console.log(`   MessagePack: ${msgpackMatch ? 'PASS' : 'FAIL'}`);
}

// Run the test if this file is executed directly
if (require.main === module) {
  runPerformanceTest();
}

module.exports = { runPerformanceTest };