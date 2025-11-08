# MessagePack Implementation

## Overview
MessagePack is implemented for backend-to-backend communication with your external recommendation API. It provides faster data transfer through binary serialization.

## Benefits
- **Smaller payload size**: 14-50% reduction compared to JSON
- **Binary format**: Reduces network overhead
- **Automatic fallback**: Falls back to JSON if MessagePack fails
- **Faster network transfer**: Especially beneficial for large datasets

## Implementation Details

### Files Added
- `utils/messagepack.js` - MessagePack utility functions
- `middleware/messagepack.js` - Express middleware for handling MessagePack requests
- `test/messagepack-test.js` - Performance comparison test

### API Endpoints Enhanced
- `POST /recommendations/recommend` - Now uses MessagePack for external API calls
- `POST /recommendations/test-external-api` - Tests both MessagePack and JSON
- `GET /recommendations/messagepack/performance` - Performance comparison endpoint
- `GET /recommendations/messagepack/info` - MessagePack information endpoint

### Usage in External API Calls

```javascript
// Automatic MessagePack usage with JSON fallback
const response = await fetch(process.env.MODEL_URL, {
  method: "POST",
  headers: {
    ...MessagePackUtil.getHeaders(),
    "accept": "application/msgpack,application/json"
  },
  body: MessagePackUtil.encode(apiPayload),
});
```

### Testing MessagePack

1. **Performance Test**:
   ```bash
   node test/messagepack-test.js
   ```

2. **API Test** (requires authentication):
   ```bash
   curl -X POST http://localhost:3000/recommendations/test-external-api \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. **Performance Endpoint**:
   ```bash
   curl -X GET http://localhost:3000/recommendations/messagepack/performance \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## Configuration

### Environment Variables
No additional environment variables needed. MessagePack works with your existing `MODEL_URL`.

### External API Requirements
Your external recommendation API should:
- Accept `application/msgpack` content-type
- Return `application/msgpack` responses
- Fall back to JSON if MessagePack is not supported

## Error Handling
- Automatic fallback to JSON if MessagePack encoding/decoding fails
- Graceful error handling with detailed logging
- No breaking changes to existing JSON-based communication

## Performance Results
Based on test data:
- **Size reduction**: ~14-50% smaller payloads
- **Network savings**: Significant for large recommendation datasets
- **Best for**: Backend-to-backend communication with large data transfers

## Next Steps
1. Update your external recommendation API to support MessagePack
2. Monitor performance improvements in production
3. Consider implementing MessagePack for other heavy data endpoints