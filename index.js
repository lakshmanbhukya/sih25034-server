const express = require("express");
const cors = require("cors");
const { connectDB, getDB } = require("./connections/connection");
const userRoutes = require("./src/routes/user_routes");
const recommendRoutes = require("./src/routes/recommend_routes");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "Server is running", timestamp: new Date().toISOString() });
});

// Database status endpoint
app.get("/db-status", (req, res) => {
  try {
    const db = getDB();
    res.json({ 
      status: "Connected", 
      database: db.databaseName,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: "Disconnected", 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use("/users", userRoutes);
app.use("/recommendations", recommendRoutes);

// 404 handler - catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Server startup
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`💾 DB status: http://localhost:${PORT}/db-status`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
