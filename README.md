# SIH25034 Server

Backend API for internship discovery and recommendation with JWT authentication, profile-based personalization, caching, and MessagePack optimization for external model calls.

## Project Overview

This service powers internship recommendation workflows:

- User registration and login
- User profile enrichment (skills, sectors, education, location)
- Personalized recommendations via external model API
- Fallback recommendation logic when external model is unavailable
- Internship browsing/search APIs with pagination
- In-memory caching with TTL for performance

The project is built with Express and MongoDB, and exposes a REST API intended for frontend/mobile clients.

## Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![bcrypt](https://img.shields.io/badge/bcrypt-003A70?style=for-the-badge&logo=letsencrypt&logoColor=white)
![node-fetch](https://img.shields.io/badge/node--fetch-3178C6?style=for-the-badge&logo=javascript&logoColor=white)
![MessagePack](https://img.shields.io/badge/MessagePack-00599C?style=for-the-badge&logo=buffer&logoColor=white)
![Nodemon](https://img.shields.io/badge/Nodemon-76D04B?style=for-the-badge&logo=nodemon&logoColor=white)

## Repository Structure (What is What)

- index.js
  - App entry point, middleware wiring, route registration, startup/shutdown flow.
- src/routes/user_routes.js
  - Auth and profile APIs: register, login, profile update, profile read.
- src/routes/recommend_routes.js
  - Recommendation APIs, internship listing/search, cache and MessagePack utility endpoints.
- connections/connection.js
  - MongoDB connection lifecycle and shared db accessor.
- redis/cache.js
  - In-memory TTL cache implementation (despite folder name, this is not Redis-backed currently).
- middleware/messagepack.js
  - Request/response middleware for MessagePack payload support.
- utils/messagepack.js
  - MessagePack encode/decode utility helpers.
- docs/API_DOCS.md
  - Detailed endpoint usage examples and response formats.
- docs/MESSAGEPACK.md
  - MessagePack implementation notes and test usage.
- test/, test-_.js, debug-_.js, check-user-profile.js
  - Utility scripts for system checks, endpoint checks, and recommendation debugging.
- models/user_model.js
  - Mongoose model definition (currently not used by runtime routes, which use native MongoDB driver).
- user_routes.js (root)
  - Empty file; can be removed to avoid confusion.

## Request Lifecycle (High Level)

1. Client calls API endpoint.
2. JWT-protected routes validate Authorization: Bearer token.
3. Route reads/writes user and internship data from MongoDB.
4. Recommendation route builds model payload from user profile.
5. External model call attempts MessagePack first, then falls back to JSON.
6. If model call fails, fallback recommendations are generated directly from internships collection.
7. Response is cached with a TTL to reduce repeated compute/query overhead.

## Key Features Implemented (What has been done)

- JWT authentication with 2-hour token expiry.
- Secure password hashing using bcrypt.
- Profile update and read endpoints for recommendation personalization.
- External model integration for recommendations.
- Automatic fallback recommendation path when external API fails.
- In-memory cache with TTL and selective clear endpoints.
- Search and pagination APIs for internships.
- MessagePack support for faster backend-to-backend transport.
- Health and DB status endpoints for monitoring.
- Script-based debugging and diagnostics utilities.

## API Surface Summary

Base URL (local): <http://localhost:3000>

Public endpoints:

- GET /
- GET /health
- GET /db-status
- POST /users/register
- POST /users/login
- GET /recommendations/internships
- GET /recommendations/internships/:id
- GET /recommendations/internships/recommended
- GET /recommendations/search
- GET /recommendations/cache/status
- GET /recommendations/messagepack/info

Protected endpoints (Bearer token required):

- POST /users/profile/update
- GET /users/profile
- POST /recommendations/recommend
- POST /recommendations/test-external-api
- GET /recommendations/messagepack/performance
- DELETE /recommendations/cache/clear

For full payload and response examples, see docs/API_DOCS.md.

## Environment Variables

Create a .env file at project root with:

- PORT=3000
- MONGO_URI=<your_mongodb_connection_string>
- DB_NAME=<database_name>
- USERS_COLLECTION=users
- COLLECTION_NAME=<internships_collection_name>
- JWT_SECRET=<strong_secret>
- MODEL_URL=<external_recommendation_api_url>
- NODE_ENV=development

## Local Development Setup

1. Install dependencies:

   npm install

2. Configure environment variables in .env.

3. Start server:

   npm start

4. Verify service:
   - GET /health
   - GET /db-status

## Useful Scripts

Configured npm scripts:

- npm start

Available utility scripts (run directly):

- node test-system.js
- node test-endpoints.js
- node test-fixed-recommendations.js
- node debug-recommendations.js
- node check-user-profile.js
- node test/messagepack-test.js

## Notes for Developers

- Current npm dev script in package.json points to app.js, but runtime entrypoint is index.js.
- In-memory cache is process-local; it resets on restart and is not shared across instances.
- The project has both mongodb and mongoose dependencies, but runtime routes currently use mongodb.
- There is an empty root-level user_routes.js file that appears unused.

## Recommended Next Improvements

- Fix npm dev script to target index.js.
- Replace in-memory cache with real Redis for multi-instance deployments.
- Add input schema validation (e.g., Joi/Zod) for all request bodies/query params.
- Add automated tests (unit + integration) and CI checks.
- Add rate limiting and request logging for production hardening.

## License

This project is licensed under the MIT License. See LICENSE for full text.
