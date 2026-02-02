const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');

// Create rate limiter with Redis store for distributed rate limiting, fallback to memory
const createRateLimiter = () => {
  const redisClient = getRedisClient();
  
  const config = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000) / 1000)
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
      // Use IP address and user agent for more accurate rate limiting
      return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health';
    },
    onLimitReached: (req, res, options) => {
      console.warn(`Rate limit exceeded for IP: ${req.ip}`);
    }
  };

  // Use Redis store if available, otherwise fallback to memory store
  if (redisClient) {
    try {
      config.store = new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      });
      console.log('Using Redis store for rate limiting');
    } catch (error) {
      console.warn('Failed to create Redis store for rate limiting, using memory store:', error.message);
    }
  } else {
    console.warn('Redis not available, using memory store for rate limiting');
  }

  return rateLimit(config);
};

// Different rate limits for different endpoints
const createQRGenerationLimiter = () => {
  const redisClient = getRedisClient();
  
  const config = {
    windowMs: 60000, // 1 minute
    max: 50, // 50 QR generations per minute
    message: {
      error: 'QR generation rate limit exceeded. Please wait before generating more QR codes.',
      retryAfter: 60
    },
    keyGenerator: (req) => `qr-gen-${req.ip}`,
  };

  if (redisClient) {
    try {
      config.store = new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      });
    } catch (error) {
      console.warn('Failed to create Redis store for QR generation rate limiting:', error.message);
    }
  }

  return rateLimit(config);
};

const createQRRetrievalLimiter = () => {
  const redisClient = getRedisClient();
  
  const config = {
    windowMs: 60000, // 1 minute
    max: 200, // 200 retrievals per minute
    message: {
      error: 'QR retrieval rate limit exceeded. Please wait before accessing more QR codes.',
      retryAfter: 60
    },
    keyGenerator: (req) => `qr-get-${req.ip}`,
  };

  if (redisClient) {
    try {
      config.store = new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      });
    } catch (error) {
      console.warn('Failed to create Redis store for QR retrieval rate limiting:', error.message);
    }
  }

  return rateLimit(config);
};

module.exports = {
  general: createRateLimiter(),
  qrGeneration: createQRGenerationLimiter(),
  qrRetrieval: createQRRetrievalLimiter()
};