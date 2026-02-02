# Deployment Guide

## Quick Start with Docker

1. **Clone and setup**:
```bash
git clone <repository>
cd scalable-qr-system
cp .env.example .env
```

2. **Configure environment**:
Edit `.env` file with your settings.

3. **Start with Docker Compose**:
```bash
docker-compose up -d
```

The system will be available at `http://localhost:3000`

## Production Deployment

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Redis 6+
- Nginx (recommended)

### Manual Installation

1. **Install dependencies**:
```bash
npm install --production
```

2. **Setup database**:
```bash
# Create database and user
psql -U postgres -c "CREATE DATABASE qr_system;"
psql -U postgres -c "CREATE USER qr_user WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE qr_system TO qr_user;"

# Run initialization script
psql -U qr_user -d qr_system -f init.sql
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your production settings
```

4. **Start the application**:
```bash
# Single process
npm start

# Clustered (recommended for production)
npm run cluster
```

### Environment Variables

#### Required
```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=qr_system
POSTGRES_USER=qr_user
POSTGRES_PASSWORD=your_secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Optional
```bash
# Server
PORT=3000
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# QR Configuration
QR_CODE_EXPIRY_HOURS=24
QR_CODE_SIZE=200
QR_CODE_ERROR_CORRECTION=M

# Security
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## Scaling Strategies

### Horizontal Scaling

1. **Load Balancer Setup** (Nginx example):
```nginx
upstream qr_backend {
    least_conn;
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s;
}
```

2. **Database Scaling**:
   - Read replicas for QR retrieval
   - Connection pooling
   - Database sharding by user_id

3. **Redis Clustering**:
```bash
# Redis Cluster setup
redis-cli --cluster create \
  10.0.1.20:7000 10.0.1.21:7000 10.0.1.22:7000 \
  10.0.1.20:7001 10.0.1.21:7001 10.0.1.22:7001 \
  --cluster-replicas 1
```

### Vertical Scaling

1. **CPU Optimization**:
   - Use clustering (already implemented)
   - Optimize QR generation with worker threads

2. **Memory Optimization**:
   - Increase Redis memory
   - Tune PostgreSQL shared_buffers
   - Monitor Node.js heap usage

## Monitoring and Observability

### Health Checks
```bash
# Basic health
curl http://localhost:3000/api/health

# Detailed health with dependencies
curl http://localhost:3000/api/health/detailed

# Kubernetes readiness probe
curl http://localhost:3000/api/health/ready

# Kubernetes liveness probe
curl http://localhost:3000/api/health/live
```

### Metrics Collection

1. **Application Metrics**:
   - QR generation rate
   - Response times
   - Error rates
   - Cache hit rates

2. **System Metrics**:
   - CPU usage
   - Memory usage
   - Database connections
   - Redis memory usage

### Logging

Logs are structured JSON format:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "message": "QR code generated",
  "qrId": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "user123",
  "responseTime": 45
}
```

## Performance Tuning

### Database Optimization

1. **PostgreSQL Configuration**:
```sql
-- postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
max_connections = 200
```

2. **Index Optimization**:
```sql
-- Monitor slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Add indexes as needed
CREATE INDEX CONCURRENTLY idx_qr_codes_user_created 
ON qr_codes(user_id, created_at DESC);
```

### Redis Optimization

1. **Memory Configuration**:
```bash
# redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

2. **Connection Pooling**:
```javascript
// Increase connection pool size
const redisConfig = {
  // ... other config
  pool: {
    min: 5,
    max: 20
  }
};
```

### Application Optimization

1. **Clustering**:
```bash
# Use all CPU cores
npm run cluster
```

2. **Caching Strategy**:
   - Cache QR codes for 24 hours (default)
   - Cache user statistics for 5 minutes
   - Use Redis for distributed rate limiting

## Security Hardening

### Network Security
```bash
# Firewall rules (iptables example)
iptables -A INPUT -p tcp --dport 3000 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 5432 -s 10.0.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -s 10.0.1.0/24 -j ACCEPT
```

### Application Security
1. **Rate Limiting**: Already implemented
2. **Input Validation**: Joi schemas
3. **Security Headers**: Helmet.js
4. **CORS**: Configurable origins

### Database Security
```sql
-- Create read-only user for monitoring
CREATE USER qr_monitor WITH PASSWORD 'monitor_password';
GRANT CONNECT ON DATABASE qr_system TO qr_monitor;
GRANT USAGE ON SCHEMA public TO qr_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO qr_monitor;
```

## Backup and Recovery

### Database Backup
```bash
# Daily backup
pg_dump -U qr_user -h localhost qr_system > backup_$(date +%Y%m%d).sql

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/qr_system"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U qr_user -h localhost qr_system | gzip > "$BACKUP_DIR/qr_backup_$DATE.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "qr_backup_*.sql.gz" -mtime +7 -delete
```

### Redis Backup
```bash
# Redis persistence is configured in redis.conf
# Manual backup
redis-cli BGSAVE

# Copy RDB file
cp /var/lib/redis/dump.rdb /backups/redis/dump_$(date +%Y%m%d).rdb
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**:
   - Check Redis memory usage: `redis-cli info memory`
   - Monitor Node.js heap: Use `--max-old-space-size=4096`
   - Review QR code expiration settings

2. **Slow Response Times**:
   - Check database query performance
   - Monitor Redis latency
   - Review rate limiting settings

3. **Connection Issues**:
   - Verify database connection pool settings
   - Check Redis connection limits
   - Monitor network connectivity

### Performance Testing

Run load tests with k6:
```bash
# Install k6
# Run the included load test
k6 run k6-load-test.js

# Custom test for your environment
k6 run --vus 100 --duration 5m k6-load-test.js
```

Expected performance:
- **QR Generation**: <500ms (95th percentile)
- **QR Retrieval**: <200ms (95th percentile)
- **Throughput**: 1000+ requests/second
- **Concurrent Users**: 1000+ simultaneous users