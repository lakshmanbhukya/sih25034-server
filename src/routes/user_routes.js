const express = require("express");
const router = express.Router();
const { getDB } = require("../../connections/connection");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cache = require("../../redis/cache");

const JWT_SECRET = process.env.JWT_SECRET || "changeme_secret";
const USERS_COLLECTION = process.env.USERS_COLLECTION || "users";

// User model/schema (for reference/documentation)
class User {
  constructor({
    username,
    email,
    password,
    skills = [],
    sectors = [],
    education = "",
    location = "",
  }) {
    this.username = username; // String
    this.email = email; // String
    this.password = password; // Hashed String
    this.skills = skills; // Array of strings
    this.sectors = sectors; // Array of strings
    this.education = education; // String: "10th", "12th", "diploma", "graduate"
    this.location = location; // String
  }
}

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token required" });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// Registration route (username, email, password, confirmPassword)
router.post("/register", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({
      error: "Username, email, password, and confirmPassword are required.",
    });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  try {
    const db = getDB();
    const users = db.collection(USERS_COLLECTION);
    const existing = await users.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ error: "User already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await users.insertOne(user);
    res.status(201).json({
      message: "User registered successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Registration failed." });
  }
});

// Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  try {
    const db = getDB();
    const users = db.collection(USERS_COLLECTION);
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    // Issue JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: "2h" }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Login failed." });
  }
});

// Profile update route (skills, sectors, education, location) - protected
router.post("/profile/update", authenticateToken, async (req, res) => {
  try {
    console.log('📄 Profile update request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User ID from token:', req.user.userId);
    
    const { skills, sectors, education, location } = req.body;
    
    // Validate at least one field is provided
    if (!skills && !sectors && !education && !location) {
      return res.status(400).json({ error: "At least one field (skills, sectors, education, location) is required" });
    }
    
    const updateFields = {};
    if (skills) {
      updateFields.skills = Array.isArray(skills) ? skills : [skills];
      console.log('✅ Skills to update:', updateFields.skills);
    }
    if (sectors) {
      updateFields.sectors = Array.isArray(sectors) ? sectors : [sectors];
      console.log('✅ Sectors to update:', updateFields.sectors);
    }
    if (education) {
      updateFields.education = education;
      console.log('✅ Education to update:', updateFields.education);
    }
    if (location) {
      updateFields.location = location;
      console.log('✅ Location to update:', updateFields.location);
    }
    
    console.log('🔄 Final update fields:', JSON.stringify(updateFields, null, 2));
    
    const db = getDB();
    const users = db.collection(USERS_COLLECTION);
    const { ObjectId } = require("mongodb");
    
    // Check if user exists first
    const existingUser = await users.findOne({ _id: new ObjectId(req.user.userId) });
    if (!existingUser) {
      console.error('❌ User not found in database:', req.user.userId);
      return res.status(404).json({ error: "User not found." });
    }
    
    console.log('👤 User found, current profile:', {
      skills: existingUser.skills,
      sectors: existingUser.sectors,
      education: existingUser.education,
      location: existingUser.location
    });
    
    const result = await users.updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: updateFields }
    );
    
    console.log('📊 Update result:', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      acknowledged: result.acknowledged
    });
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    
    // Verify the update by fetching the user again
    const updatedUser = await users.findOne({ _id: new ObjectId(req.user.userId) });
    console.log('✅ Updated user profile:', {
      skills: updatedUser.skills,
      sectors: updatedUser.sectors,
      education: updatedUser.education,
      location: updatedUser.location
    });
    
    // Clear user's cached recommendations since profile changed
    cache.clear();
    console.log('🗑️ Cache cleared');
    
    res.json({ 
      message: "Profile updated successfully",
      updated_fields: Object.keys(updateFields),
      modified_count: result.modifiedCount
    });
  } catch (err) {
    console.error("❌ Profile update error:", err);
    res.status(500).json({ error: "Profile update failed.", details: err.message });
  }
});

// Get current user profile - protected
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const db = getDB();
    const users = db.collection(USERS_COLLECTION);
    const { ObjectId } = require("mongodb");
    
    const user = await users.findOne(
      { _id: new ObjectId(req.user.userId) },
      { projection: { password: 0 } } // Exclude password from response
    );
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({
      user_id: user._id,
      username: user.username,
      email: user.email,
      skills: user.skills || [],
      sectors: user.sectors || [],
      education: user.education || "",
      location: user.location || ""
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

module.exports = router;
