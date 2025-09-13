# 📚 Internship Recommendation API Documentation

## 🌐 Base URL

```
http://localhost:3000
```

## 🔐 Authentication

- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`
- **Token Expiry**: 2 hours

---

## 📋 API Endpoints

### 🏥 **Health & Status**

#### 1. Health Check

```http
GET /health
```

**Auth**: None  
**Description**: Check if server is running

**Response**:

```json
{
  "status": "Server is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 2. Database Status

```http
GET /db-status
```

**Auth**: None  
**Description**: Check MongoDB connection status

**Response**:

```json
{
  "status": "Connected",
  "database": "Sih25034",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 👤 **User Management**

#### 3. User Registration

```http
POST /users/register
```

**Auth**: None  
**Content-Type**: `application/json`

**Request Body**:

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Success Response (201)**:

```json
{
  "message": "User registered successfully"
}
```

**Error Responses**:

```json
// 400 - Validation Error
{
  "error": "Username, email, password, and confirmPassword are required."
}

// 409 - User Exists
{
  "error": "User already exists."
}
```

#### 4. User Login

```http
POST /users/login
```

**Auth**: None  
**Content-Type**: `application/json`

**Request Body**:

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200)**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzY..."
}
```

**Error Responses**:

```json
// 401 - Invalid Credentials
{
  "error": "Invalid credentials."
}
```

#### 5. Update Profile

```http
POST /users/profile/update
```

**Auth**: Bearer Token Required  
**Content-Type**: `application/json`

**Request Body**:

```json
{
  "skills": ["JavaScript", "React", "Node.js", "MongoDB"],
  "sectors": ["technology", "software development"],
  "education": {
    "twelfth": {
      "board": "CBSE",
      "year": "2022",
      "percentage": 85
    },
    "tenth": {
      "board": "State Board",
      "year": "2020",
      "percentage": 90
    }
  },
  "location": "Mumbai"
}
```

**Success Response (200)**:

```json
{
  "message": "Profile updated successfully"
}
```

**Error Responses**:

```json
// 401 - No Token
{
  "error": "Token required"
}

// 403 - Invalid Token
{
  "error": "Invalid token"
}

// 404 - User Not Found
{
  "error": "User not found."
}
```

---

### 🎯 **Recommendations**

#### 6. Get Internships (Paginated)

```http
GET /recommendations/internships?page=1
```

**Auth**: None  
**Query Parameters**:

- `page` (optional): Page number (default: 1)

**Success Response (200)**:

```json
{
  "internships": [
    {
      "_id": "68c2c8fee7753e861fede840",
      "internship_id": 1022,
      "title": "SEO Intern",
      "company_name": "Premier Innovations",
      "description": "Join our team to work on exciting projects...",
      "sector": "marketing",
      "skills": ["SEO", "Content Writing", "Analytics"],
      "min_education": "diploma",
      "location_city": "Lucknow",
      "location_state": "Uttar Pradesh",
      "duration_weeks": 8,
      "stipend": 18000,
      "mode": "Hybrid",
      "application_link": "https://example.com/apply",
      "posted_date": "2025-06-13",
      "application_deadline": "2025-11-09",
      "slots_available": 4,
      "company_size": "Startup (1-50)",
      "remote_work_allowed": true,
      "certificate_provided": true
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 15,
    "total_internships": 150,
    "has_next": true,
    "has_prev": false
  }
}
```

#### 7. Get Personalized Recommendations

```http
POST /recommendations/recommend
```

**Auth**: Bearer Token Required  
**Content-Type**: `application/json`

**Request Body**:

```json
{
  "max_distance_km": 150
}
```

**Success Response (200)**:

```json
{
  "recommendations": {
    "nearby_ids": ["68c2c8fee7753e861fede840", "68c2c8fee7753e861fedebea"],
    "remote_ids": ["68c2c8fee7753e861fede9de"],
    "nearby_internships": [
      {
        "_id": "68c2c8fee7753e861fede840",
        "internship_id": 1022,
        "title": "SEO Intern",
        "company_name": "Premier Innovations",
        "description": "Join our team to work on exciting projects...",
        "sector": "marketing",
        "skills": ["SEO", "Content Writing"],
        "location_city": "Mumbai",
        "location_state": "Maharashtra",
        "duration_weeks": 8,
        "stipend": 18000,
        "mode": "Hybrid",
        "application_link": "https://example.com/apply",
        "application_deadline": "2025-11-09",
        "slots_available": 4,
        "remote_work_allowed": true,
        "certificate_provided": true
      }
    ],
    "remote_internships": [
      {
        "_id": "68c2c8fee7753e861fede9de",
        "title": "Remote Developer Intern",
        "company_name": "Tech Solutions",
        "sector": "technology",
        "mode": "Remote",
        "stipend": 25000
      }
    ]
  },
  "user_profile": {
    "skills": ["JavaScript", "React", "Node.js"],
    "sectors": ["technology"],
    "education_level": "12th",
    "location": "Mumbai"
  }
}
```

**Error Responses**:

```json
// 401 - No Token
{
  "error": "Token required"
}

// 404 - User Not Found
{
  "error": "User not found"
}

// 500 - API Error
{
  "error": "Failed to get recommendations"
}
```

#### 8. Clear Cache

```http
DELETE /recommendations/cache/clear
```

**Auth**: Bearer Token Required  
**Description**: Clear recommendation cache (Admin/Testing)

**Success Response (200)**:

```json
{
  "message": "Cache cleared successfully"
}
```

---

## 🔧 **Testing Examples**

### Using cURL:

```bash
# 1. Register User
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"test123","confirmPassword":"test123"}'

# 2. Login
curl -X POST http://localhost:3000/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# 3. Update Profile (replace TOKEN)
curl -X POST http://localhost:3000/users/profile/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"skills":["JavaScript","React"],"sectors":["technology"],"location":"Mumbai"}'

# 4. Get Recommendations (replace TOKEN)
curl -X POST http://localhost:3000/recommendations/recommend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max_distance_km":150}'
```

### Using Thunder Client/Postman:

1. **Set Base URL**: `http://localhost:3000`
2. **For Protected Routes**: Add header `Authorization: Bearer <your_jwt_token>`
3. **Content-Type**: `application/json` for POST requests

---

## 📊 **Response Codes**

| Code | Description           |
| ---- | --------------------- |
| 200  | Success               |
| 201  | Created               |
| 400  | Bad Request           |
| 401  | Unauthorized          |
| 403  | Forbidden             |
| 404  | Not Found             |
| 409  | Conflict              |
| 500  | Internal Server Error |

---

## ⚡ **Performance Features**

- **Caching**: Recommendations cached for 5 minutes per user
- **Pagination**: 10 internships per page
- **Parallel Queries**: Database queries run in parallel
- **JWT Expiry**: Tokens expire after 2 hours

---

## 🔒 **Security**

- Passwords hashed with bcrypt
- JWT tokens for authentication
- Input validation on all endpoints
- CORS enabled for cross-origin requests
