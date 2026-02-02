const { Pool } = require('pg');

let pool;

const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'qr_system',
  user: process.env.POSTGRES_USER || 'qr_user',
  password: process.env.POSTGRES_PASSWORD,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

async function connectDatabase() {
  try {
    pool = new Pool(dbConfig);
    
    // Test connection
    const client = await pool.connect();
    console.log('Database connected successfully');
    
    // Create tables if they don't exist
    await createTables(client);
    client.release();
    
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

async function createTables(client) {
  try {
    // First, create the UUID extension if it doesn't exist
    const createExtension = `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
    await client.query(createExtension);

    const createQRCodesTable = `
      CREATE TABLE IF NOT EXISTS qr_codes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        data TEXT NOT NULL,
        qr_image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        access_count INTEGER DEFAULT 0,
        user_id VARCHAR(255),
        metadata JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT true
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at);
      CREATE INDEX IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id);
      CREATE INDEX IF NOT EXISTS idx_qr_codes_created_at ON qr_codes(created_at);
      CREATE INDEX IF NOT EXISTS idx_qr_codes_is_active ON qr_codes(is_active);
    `;

    await client.query(createQRCodesTable);
    await client.query(createIndexes);
    console.log('Database tables created/verified');
  } catch (error) {
    console.error('Error creating database tables:', error);
    throw error;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
}

async function query(text, params) {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  connectDatabase,
  getPool,
  query
};