const express = require("express");
const cors = require("cors");
const { connectDB, getDB } = require("./connections/connection");
const userRoutes = require("./src/routes/user_routes");
const recommendRoutes = require("./src/routes/recommend_routes");
const { messagePackMiddleware, addMessagePackResponse } = require("./middleware/messagepack");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(messagePackMiddleware); // Handle MessagePack requests
app.use(addMessagePackResponse); // Add MessagePack response helper
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Root endpoint for basic health check
app.get("/", (req, res) => {
  res.json({ 
    message: "SIH25034 Internship Recommendation API",
    status: "Server is running", 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

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
    res.status(200).json({ 
      status: "Disconnected", 
      error: error.message,
      message: "Server is running, database connection pending",
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

// Start server first, then connect to database
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`💾 DB status: http://0.0.0.0:${PORT}/db-status`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Connect to database after server starts
connectDB()
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch((error) => {
    console.error('⚠️ Database connection failed:', error.message);
    console.log('🔄 Server will continue running without database');
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
