const redis = require('redis');

let client;

async function connectRedis() {
  try {
    client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        connectTimeout: 5000, // Reduced timeout
        commandTimeout: 3000,  // Reduced timeout
        keepAlive: 30000,
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err.message);
    });

    client.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    client.on('ready', () => {
      console.log('✅ Redis client ready');
    });

    // Set a timeout for connection
    const connectionTimeout = setTimeout(() => {
      console.warn('⚠️ Redis connection timeout, continuing without Redis');
      client = null;
    }, 5000);

    await client.connect();
    clearTimeout(connectionTimeout);
    
  } catch (error) {
    console.warn('⚠️ Redis connection failed:', error.message);
    client = null;
    // Don't throw error - allow app to continue without Redis
  }
}

function getRedisClient() {
  if (!client || !client.isOpen) {
    console.warn('Redis client not available');
    return null;
  }
  return client;
}

// Cache operations with error handling
async function setCache(key, value, expireInSeconds = 3600) {
  try {
    if (!client || !client.isOpen) {
      console.warn('Redis not available for SET operation');
      return false;
    }
    const serializedValue = JSON.stringify(value);
    await client.setEx(key, expireInSeconds, serializedValue);
    return true;
  } catch (error) {
    console.error('Redis SET error:', error);
    return false;
  }
}

async function getCache(key) {
  try {
    if (!client || !client.isOpen) {
      console.warn('Redis not available for GET operation');
      return null;
    }
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
}

async function deleteCache(key) {
  try {
    if (!client || !client.isOpen) {
      console.warn('Redis not available for DELETE operation');
      return false;
    }
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Redis DELETE error:', error);
    return false;
  }
}

async function incrementCounter(key, expireInSeconds = 60) {
  try {
    if (!client || !client.isOpen) {
      console.warn('Redis not available for INCREMENT operation');
      return null;
    }
    const multi = client.multi();
    multi.incr(key);
    multi.expire(key, expireInSeconds);
    const results = await multi.exec();
    return results[0];
  } catch (error) {
    console.error('Redis INCREMENT error:', error);
    return null;
  }
}

module.exports = {
  connectRedis,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  incrementCounter
};