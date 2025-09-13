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

    const data = await response.json();
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

// Get internships with pagination (10 per page)
router.get("/internships", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const db = getDB();
    const collection = db.collection(process.env.COLLECTION_NAME);
    
    const internships = await collection
      .find({})
      .skip(skip)
      .limit(limit)
      .toArray();
    
    const total = await collection.countDocuments();
    
    res.json({
      internships,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_internships: total,
        has_next: page < Math.ceil(total / limit),
        has_prev: page > 1
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch internships" });
  }
});

// Get recommended internships (dummy logic, can be replaced with real recommendation)
router.get("/internships/recommended", async (req, res) => {
  try {
    // For now, just return a subset or use your own logic
    const db = getDB();
    const collection = db.collection(process.env.COLLECTION_NAME);
    // Example: return first 1 as recommended
    const recommended = await collection.find({}).limit(1).toArray();
    res.json(recommended);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recommended internships" });
  }
});

// Clear cache endpoint (for testing/admin)
router.delete("/cache/clear", authenticateToken, (req, res) => {
  cache.clear();
  res.json({ message: "Cache cleared successfully" });
});

module.exports = router;
