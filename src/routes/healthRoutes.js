const express = require('express');
const { getPool } = require('../config/database');
const { getRedisClient } = require('../config/redis');

const router = express.Router();

// Basic health check
router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
    version: process.env.npm_package_version || '1.0.0'
  };

  res.json(health);
});

// Detailed health check with dependencies
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
    version: process.env.npm_package_version || '1.0.0',
    dependencies: {
      database: 'unknown',
      redis: 'unknown'
    }
  };

  // Check database connection
  try {
    const pool = getPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    health.dependencies.database = 'healthy';
  } catch (error) {
    console.warn('Database health check failed:', error.message);
    health.dependencies.database = 'unhealthy';
    health.status = 'degraded';
  }

  // Check Redis connection
  try {
    const redisClient = getRedisClient();
    if (redisClient && redisClient.isOpen) {
      await redisClient.ping();
      health.dependencies.redis = 'healthy';
    } else {
      health.dependencies.redis = 'unhealthy';
      health.status = 'degraded';
    }
  } catch (error) {
    console.warn('Redis health check failed:', error.message);
    health.dependencies.redis = 'unhealthy';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Readiness probe
router.get('/ready', async (req, res) => {
  try {
    const checks = [];
    
    // Check database if available
    try {
      const pool = getPool();
      const dbPromise = pool.query('SELECT 1');
      checks.push(dbPromise);
    } catch (error) {
      console.warn('Database not available for readiness check:', error.message);
    }
    
    // Check Redis if available
    try {
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isOpen) {
        const redisPromise = redisClient.ping();
        checks.push(redisPromise);
      }
    } catch (error) {
      console.warn('Redis not available for readiness check:', error.message);
    }
    
    // Wait for available checks
    if (checks.length > 0) {
      await Promise.all(checks);
    }
    
    res.json({ 
      status: 'ready',
      timestamp: new Date().toISOString(),
      checkedServices: checks.length
    });
    
  } catch (error) {
    console.error('Readiness check failed:', error.message);
    res.status(503).json({ 
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness probe
router.get('/live', (req, res) => {
  res.json({ 
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;