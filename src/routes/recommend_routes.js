const express = require("express");
const router = express.Router();
const { getDB } = require("../../connections/connection");
const { ObjectId } = require("mongodb");
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const cache = require("../../redis/cache");
const dotenv = require("dotenv");
dotenv.config();

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token required" });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}
// /recommend API route - Protected with caching
router.post("/recommend", authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Recommend API called by user:', req.user.userId);
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    const db = getDB();
    const usersCollection = db.collection(process.env.USERS_COLLECTION);
    
    // Get user data from database
    const user = await usersCollection.findOne({ _id: new ObjectId(req.user.userId) });
    if (!user) {
      console.error('❌ User not found in database:', req.user.userId);
      return res.status(404).json({ error: "User not found" });
    }
    
    console.log('👤 User profile found:', {
      skills: user.skills,
      sectors: user.sectors,
      education: user.education,
      location: user.location
    });

    // Prepare data for external API based on user model field names
    const apiPayload = {
      skills: Array.isArray(user.skills) ? user.skills.join(" ") : user.skills || "",
      sectors: Array.isArray(user.sectors) ? user.sectors[0] : user.sectors || "",
      education_level: user.education || "graduate",
      city_name: user.location || "",
      max_distance_km: req.body.max_distance_km || 150
    };

    // Create cache key based on user profile and distance
    const cacheKey = `recommendations:${req.user.userId}:${JSON.stringify(apiPayload)}`;
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    // Log API payload for debugging
    console.log('🔍 API Payload:', JSON.stringify(apiPayload, null, 2));
    console.log('🌐 MODEL_URL:', process.env.MODEL_URL);

    // Call external recommendation API
    const response = await fetch(process.env.MODEL_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiPayload),
    });

    console.log('📡 External API Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ External API error: ${response.status} ${response.statusText}`);
      console.error('📄 Error response:', errorText.substring(0, 500));
      
      // Fallback: Return similar internships from database
      console.log('🔄 Using fallback recommendation logic...');
      const internshipsCollection = db.collection(process.env.COLLECTION_NAME);
      
      // Build fallback queries based on user profile
      const fallbackQueries = [];
      
      // Query 1: Match by sectors and location
      if (user.sectors && user.sectors.length > 0 && user.location) {
        fallbackQueries.push({
          sector: { $in: user.sectors.map(s => new RegExp(s, 'i')) },
          location_city: { $regex: user.location, $options: "i" }
        });
      }
      
      // Query 2: Match by sectors only
      if (user.sectors && user.sectors.length > 0) {
        fallbackQueries.push({
          sector: { $in: user.sectors.map(s => new RegExp(s, 'i')) }
        });
      }
      
      // Query 3: Match by location only
      if (user.location) {
        fallbackQueries.push({
          location_city: { $regex: user.location, $options: "i" }
        });
      }
      
      // Query 4: Match by skills
      if (user.skills && user.skills.length > 0) {
        fallbackQueries.push({
          skills: { $in: user.skills.map(s => new RegExp(s, 'i')) }
        });
      }
      
      // If no specific criteria, get general internships
      if (fallbackQueries.length === 0) {
        fallbackQueries.push({});
      }
      
      console.log('🔍 Fallback queries:', JSON.stringify(fallbackQueries, null, 2));
      
      let fallbackInternships = [];
      
      // Try each query until we get results
      for (const query of fallbackQueries) {
        const results = await internshipsCollection
          .find(query)
          .limit(10)
          .toArray();
        
        if (results.length > 0) {
          fallbackInternships = results;
          console.log(`✅ Found ${results.length} fallback internships with query:`, JSON.stringify(query, null, 2));
          break;
        }
      }
      
      // Separate nearby and remote internships
      const nearbyInternships = fallbackInternships.filter(i => 
        user.location && i.location_city && 
        i.location_city.toLowerCase().includes(user.location.toLowerCase())
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
      
      const fallbackResult = {
        recommendations: {
          nearby_ids: nearbyInternships.map(i => i._id.toString()),
          remote_ids: remoteInternships.map(i => i._id.toString()),
          nearby_internships: nearbyInternships,
          remote_internships: remoteInternships
        },
        user_profile: {
          skills: user.skills || [],
          sectors: user.sectors || [],
          education_level: user.education || "graduate",
          location: user.location || ""
        },
        fallback_mode: true,
        message: "Using fallback recommendations due to external service unavailability"
      };
      
      console.log(`✅ Fallback result: ${nearbyInternships.length} nearby, ${remoteInternships.length} remote internships`);
      
      // Cache fallback result for 2 minutes only
      cache.set(cacheKey, fallbackResult, 2);
      
      return res.json(fallbackResult);
    }

    const responseText = await response.text();
    console.log('📝 External API Response:', responseText.substring(0, 300));
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✅ Successfully parsed API response');
    } catch (parseError) {
      console.error('❌ Invalid JSON response from external API:', responseText.substring(0, 200));
      return res.status(500).json({ 
        error: "Invalid response from recommendation service",
        debug_info: process.env.NODE_ENV === 'development' ? responseText.substring(0, 200) : undefined
      });
    }
    const internshipsCollection = db.collection(process.env.COLLECTION_NAME);

    const projection = { 
      internship_id: 1, 
      title: 1, 
      company_name: 1, 
      description: 1, 
      sector: 1, 
      skills: 1, 
      min_education: 1, 
      location_city: 1, 
      location_state: 1, 
      duration_weeks: 1, 
      stipend: 1, 
      mode: 1, 
      application_link: 1, 
      posted_date: 1, 
      application_deadline: 1, 
      slots_available: 1, 
      company_size: 1, 
      remote_work_allowed: 1, 
      certificate_provided: 1 
    };

    // Validate API response structure
    if (!data.recommendations) {
      console.error('Invalid API response structure:', data);
      return res.status(500).json({ error: "Invalid recommendation data received" });
    }

    // Process both nearby and remote internships in parallel
    const [nearbyInternships, remoteInternships] = await Promise.all([
      data.recommendations?.nearby_ids?.length > 0 
        ? internshipsCollection
            .find({ _id: { $in: data.recommendations.nearby_ids.map(id => new ObjectId(id)) } }, { projection })
            .toArray()
        : Promise.resolve([]),
      data.recommendations?.remote_ids?.length > 0 
        ? internshipsCollection
            .find({ _id: { $in: data.recommendations.remote_ids.map(id => new ObjectId(id)) } }, { projection })
            .toArray()
        : Promise.resolve([])
    ]);

    data.recommendations.nearby_internships = nearbyInternships;
    data.recommendations.remote_internships = remoteInternships;

    const result = {
      recommendations: {
        nearby_ids: data.recommendations.nearby_ids || [],
        remote_ids: data.recommendations.remote_ids || [],
        nearby_internships: data.recommendations.nearby_internships || [],
        remote_internships: data.recommendations.remote_internships || []
      },
      user_profile: {
        skills: user.skills || [],
        sectors: user.sectors || [],
        education_level: user.education || "graduate",
        location: user.location || ""
      }
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 5);
    
    res.json(result);
  } catch (error) {
    console.error("Error in /recommend:", error);
    res.status(500).json({ error: "Failed to get recommendations" });
  }
});

// Get internships with pagination (10 per page) - with Redis caching
router.get("/internships", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    // Create cache key for this page
    const cacheKey = `internships:page:${page}`;
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }
    
    const db = getDB();
    const collection = db.collection(process.env.COLLECTION_NAME);
    
    const [internships, total] = await Promise.all([
      collection.find({}).skip(skip).limit(limit).toArray(),
      collection.countDocuments()
    ]);
    
    const result = {
      internships,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_internships: total,
        has_next: page < Math.ceil(total / limit),
        has_prev: page > 1
      }
    };
    
    // Cache for 10 minutes
    cache.set(cacheKey, result, 10);
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch internships" });
  }
});

// Get recommended internships - with caching (preserves external API order)
router.get("/internships/recommended", async (req, res) => {
  try {
    const cacheKey = "recommended:internships";
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }
    
    const db = getDB();
    const collection = db.collection(process.env.COLLECTION_NAME);
    
    // Get internships without sorting (preserves natural order/similarity score)
    const recommended = await collection
      .find({})
      .limit(10)
      .toArray();
    
    // Cache for 30 minutes
    cache.set(cacheKey, recommended, 30);
    
    res.json(recommended);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recommended internships" });
  }
});

// Search internships - with Redis caching
router.get("/search", async (req, res) => {
  try {
    const { q, sector, location, mode, min_stipend, max_stipend, page = 1 } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    // Create cache key for this search
    const searchParams = { q, sector, location, mode, min_stipend, max_stipend, page };
    const cacheKey = `search:${JSON.stringify(searchParams)}`;
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }
    
    const db = getDB();
    const collection = db.collection(process.env.COLLECTION_NAME);
    
    // Build search query
    const searchQuery = {};
    
    if (q) {
      searchQuery.$or = [
        { title: { $regex: q, $options: "i" } },
        { company_name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { skills: { $in: [new RegExp(q, "i")] } }
      ];
    }
    
    if (sector) searchQuery.sector = { $regex: sector, $options: "i" };
    if (location) searchQuery.location_city = { $regex: location, $options: "i" };
    if (mode) searchQuery.mode = { $regex: mode, $options: "i" };
    
    if (min_stipend || max_stipend) {
      searchQuery.stipend = {};
      if (min_stipend) searchQuery.stipend.$gte = parseInt(min_stipend);
      if (max_stipend) searchQuery.stipend.$lte = parseInt(max_stipend);
    }
    
    const [internships, total] = await Promise.all([
      collection.find(searchQuery).skip(skip).limit(limit).toArray(),
      collection.countDocuments(searchQuery)
    ]);
    
    const result = {
      internships,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_results: total,
        has_next: page < Math.ceil(total / limit),
        has_prev: page > 1
      },
      search_params: { q, sector, location, mode, min_stipend, max_stipend }
    };
    
    // Cache search results for 5 minutes
    cache.set(cacheKey, result, 5);
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

// Get internship by ID - with caching
router.get("/internships/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Create cache key for this internship
    const cacheKey = `internship:${id}`;
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }
    
    const db = getDB();
    const collection = db.collection(process.env.COLLECTION_NAME);
    
    // Find internship by MongoDB ObjectId or internship_id
    let internship;
    if (ObjectId.isValid(id)) {
      internship = await collection.findOne({ _id: new ObjectId(id) });
    } else {
      internship = await collection.findOne({ internship_id: parseInt(id) });
    }
    
    if (!internship) {
      return res.status(404).json({ error: "Internship not found" });
    }
    
    // Cache for 15 minutes
    cache.set(cacheKey, internship, 15);
    
    res.json(internship);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch internship" });
  }
});

// Cache status endpoint
router.get("/cache/status", (req, res) => {
  try {
    // Test cache functionality
    const testKey = "test:cache:" + Date.now();
    cache.set(testKey, { test: "data", timestamp: new Date() }, 1);
    const testResult = cache.get(testKey);
    
    res.json({
      cache_type: "In-Memory Cache",
      status: testResult ? "Working" : "Failed",
      test_data: testResult,
      cache_size: cache.cache ? cache.cache.size : "Unknown"
    });
  } catch (error) {
    res.status(500).json({ 
      cache_type: "In-Memory Cache",
      status: "Error", 
      error: error.message 
    });
  }
});

// Test external API endpoint (for debugging)
router.post("/test-external-api", authenticateToken, async (req, res) => {
  try {
    const testPayload = {
      skills: "javascript react",
      sectors: "technology",
      education_level: "12th",
      city_name: "Mumbai",
      max_distance_km: 150
    };
    
    console.log('🧪 Testing external API with payload:', testPayload);
    console.log('🌐 MODEL_URL:', process.env.MODEL_URL);
    
    const response = await fetch(process.env.MODEL_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });
    
    const responseText = await response.text();
    
    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText.substring(0, 1000),
      model_url: process.env.MODEL_URL
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
});

// Clear cache endpoints
router.delete("/cache/clear", authenticateToken, (req, res) => {
  const { pattern, type } = req.query;
  
  let cleared = 0;
  let message = "";
  
  if (type === "expired") {
    cleared = cache.clearExpired();
    message = `Cleared ${cleared} expired entries`;
  } else if (pattern) {
    cleared = cache.clearByPattern(pattern);
    message = `Cleared ${cleared} entries matching pattern: ${pattern}`;
  } else {
    cache.clear();
    message = "All cache cleared successfully";
  }
  
  res.json({ 
    message,
    cleared_count: cleared || "all",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
