# QR Code Generation API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
Currently, the API doesn't require authentication, but includes optional `userId` parameter for tracking and user-specific operations.

## Rate Limiting
- General API: 100 requests per minute per IP
- QR Generation: 50 requests per minute per IP
- QR Retrieval: 200 requests per minute per IP

## Endpoints

### Generate QR Code
**POST** `/qr/generate`

Generate a new QR code with the provided data.

#### Request Body
```json
{
  "data": "string (required, max 2048 chars)",
  "userId": "string (optional, max 255 chars)",
  "expiryHours": "number (optional, 1-8760)",
  "metadata": "object (optional)",
  "options": {
    "errorCorrectionLevel": "string (optional: L, M, Q, H)",
    "width": "number (optional, 100-1000)",
    "margin": "number (optional, 0-10)"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "data": "string",
    "qrImageUrl": "data:image/png;base64,...",
    "createdAt": "timestamp",
    "expiresAt": "timestamp",
    "accessCount": 0
  },
  "message": "QR code generated successfully"
}
```

#### Example
```bash
curl -X POST http://localhost:3000/api/qr/generate \
  -H "Content-Type: application/json" \
  -d '{
    "data": "https://example.com",
    "userId": "user123",
    "expiryHours": 24,
    "metadata": {"type": "website", "category": "demo"}
  }'
```

### Retrieve QR Code
**GET** `/qr/:id`

Retrieve an existing QR code by its ID.

#### Parameters
- `id` (path): UUID of the QR code

#### Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "data": "string",
    "qrImageUrl": "data:image/png;base64,...",
    "createdAt": "timestamp",
    "expiresAt": "timestamp",
    "accessCount": 5
  }
}
```

#### Example
```bash
curl http://localhost:3000/api/qr/123e4567-e89b-12d3-a456-426614174000
```

### Delete QR Code
**DELETE** `/qr/:id`

Soft delete a QR code (marks as inactive).

#### Parameters
- `id` (path): UUID of the QR code

#### Request Body (optional)
```json
{
  "userId": "string (optional, for user-specific deletion)"
}
```

#### Response
```json
{
  "success": true,
  "message": "QR code deleted successfully"
}
```

### Batch Generate QR Codes
**POST** `/qr/batch`

Generate multiple QR codes in a single request (max 10).

#### Request Body
```json
{
  "items": [
    {
      "data": "string (required)",
      "userId": "string (optional)",
      "metadata": "object (optional)"
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "results": [/* array of generated QR codes */],
    "errors": [/* array of errors if any */],
    "totalRequested": 3,
    "totalGenerated": 3
  }
}
```

### Get Statistics
**GET** `/qr/stats/:userId?`

Get QR code statistics, optionally filtered by user.

#### Parameters
- `userId` (path, optional): Filter stats for specific user

#### Response
```json
{
  "success": true,
  "data": {
    "totalCodes": 150,
    "activeCodes": 120,
    "totalAccesses": 1250
  }
}
```

### Health Check
**GET** `/health`

Basic health check endpoint.

#### Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 50331648,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  },
  "pid": 1234,
  "version": "1.0.0"
}
```

### Detailed Health Check
**GET** `/health/detailed`

Detailed health check including dependency status.

#### Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {...},
  "pid": 1234,
  "version": "1.0.0",
  "dependencies": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

## Error Responses

All error responses follow this format:
```json
{
  "error": "Error message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created (for QR generation)
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable

## QR Code Options

### Error Correction Levels
- `L` - Low (~7% correction)
- `M` - Medium (~15% correction) - Default
- `Q` - Quartile (~25% correction)
- `H` - High (~30% correction)

### Size Recommendations
- `100-200px` - Small (mobile apps)
- `200-400px` - Medium (web display) - Default: 200px
- `400-1000px` - Large (print quality)

## Performance Considerations

1. **Caching**: QR codes are cached in Redis for fast retrieval
2. **Database**: PostgreSQL with optimized indexes
3. **Concurrency**: Built-in clustering support for high load
4. **Rate Limiting**: Distributed rate limiting using Redis
5. **Cleanup**: Automatic cleanup of expired QR codes

## Security Features

1. **Input Validation**: All inputs are validated using Joi schemas
2. **Rate Limiting**: Multiple layers of rate limiting
3. **Security Headers**: Helmet.js for security headers
4. **CORS**: Configurable CORS settings
5. **Unique IDs**: UUID v4 for unpredictable QR code IDs