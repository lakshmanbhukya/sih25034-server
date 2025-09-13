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
    const db = getDB();
    const usersCollection = db.collection(process.env.USERS_COLLECTION);
    
    // Get user data from database
    const user = await usersCollection.findOne({ _id: new ObjectId(req.user.userId) });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prepare data for external API based on user model field names
    const apiPayload = {
      skills: Array.isArray(user.skills) ? user.skills.join(" ") : user.skills || "",
      sectors: Array.isArray(user.sectors) ? user.sectors[0] : user.sectors || "",
      education_level: user.education?.twelfth ? "12th" : user.education?.tenth ? "10th" : "graduate",
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

    // Call external recommendation API
    const response = await fetch(process.env.MODEL_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiPayload),
    });

    if (!response.ok) {
      console.error(`External API error: ${response.status} ${response.statusText}`);
      return res.status(500).json({ error: "External recommendation service unavailable" });
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Invalid JSON response from external API:', responseText.substring(0, 200));
      return res.status(500).json({ error: "Invalid response from recommendation service" });
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
        skills: user.skills,
        sectors: user.sectors,
        education_level: apiPayload.education_level,
        location: user.location
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
