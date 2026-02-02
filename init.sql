-- Initialize QR System Database

-- Create database if it doesn't exist (for local development)
-- Note: This won't work in Docker as the database is already created
-- SELECT 'CREATE DATABASE qr_system' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'qr_system');

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create qr_codes table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_created_at ON qr_codes(created_at);
CREATE INDEX IF NOT EXISTS idx_qr_codes_is_active ON qr_codes(is_active);

-- Create a partial index for active, non-expired codes
CREATE INDEX IF NOT EXISTS idx_qr_codes_active_valid 
ON qr_codes(id) 
WHERE is_active = true AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

-- Create function to automatically clean up expired QR codes
CREATE OR REPLACE FUNCTION cleanup_expired_qr_codes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM qr_codes 
    WHERE expires_at < CURRENT_TIMESTAMP AND is_active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for active QR codes statistics
CREATE OR REPLACE VIEW qr_stats AS
SELECT 
    COUNT(*) as total_codes,
    COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP OR expires_at IS NULL THEN 1 END) as active_codes,
    COUNT(CASE WHEN expires_at <= CURRENT_TIMESTAMP THEN 1 END) as expired_codes,
    SUM(access_count) as total_accesses,
    AVG(access_count) as avg_accesses_per_code,
    DATE_TRUNC('day', MIN(created_at)) as first_code_date,
    DATE_TRUNC('day', MAX(created_at)) as last_code_date
FROM qr_codes 
WHERE is_active = true;

-- Insert some sample data for testing (optional)
-- INSERT INTO qr_codes (data, user_id, metadata) VALUES 
-- ('https://example.com/sample1', 'test-user', '{"type": "sample", "description": "Sample QR code 1"}'),
-- ('https://example.com/sample2', 'test-user', '{"type": "sample", "description": "Sample QR code 2"}');

COMMIT;