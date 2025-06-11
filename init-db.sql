-- OPNsense MCP Database Schema
-- Initialize PostgreSQL database for MCP storage

-- Create tables
CREATE TABLE IF NOT EXISTS backups (
    id VARCHAR(255) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    size INTEGER,
    description TEXT,
    checksum VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operations (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    target VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    result VARCHAR(20) NOT NULL,
    backup_id VARCHAR(255),
    error TEXT,
    metadata JSONB,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (backup_id) REFERENCES backups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cache_stats (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL,
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    last_access TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS command_queue (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    params JSONB NOT NULL,
    priority INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    result JSONB,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    message_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS config_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_id VARCHAR(255) UNIQUE NOT NULL,
    config_type VARCHAR(50) NOT NULL,
    config_data JSONB NOT NULL,
    change_summary TEXT,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_operations_timestamp ON operations(timestamp DESC);
CREATE INDEX idx_operations_type ON operations(type);
CREATE INDEX idx_operations_result ON operations(result);
CREATE INDEX idx_cache_stats_key ON cache_stats(key);
CREATE INDEX idx_command_queue_status ON command_queue(status);
CREATE INDEX idx_command_queue_priority ON command_queue(priority DESC);
CREATE INDEX idx_conversations_conversation_id ON conversations(conversation_id);
CREATE INDEX idx_config_snapshots_type ON config_snapshots(config_type);

-- Create views
CREATE OR REPLACE VIEW recent_operations AS
SELECT 
    o.*,
    b.filename as backup_filename,
    b.size as backup_size
FROM operations o
LEFT JOIN backups b ON o.backup_id = b.id
ORDER BY o.timestamp DESC
LIMIT 100;

CREATE OR REPLACE VIEW cache_performance AS
SELECT 
    key,
    hits,
    misses,
    CASE 
        WHEN hits + misses = 0 THEN 0
        ELSE ROUND((hits::NUMERIC / (hits + misses)) * 100, 2)
    END as hit_rate,
    last_access
FROM cache_stats
ORDER BY hits + misses DESC;

CREATE OR REPLACE VIEW pending_commands AS
SELECT *
FROM command_queue
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC;

-- Create functions
CREATE OR REPLACE FUNCTION update_cache_stats(
    p_key VARCHAR(255),
    p_hit BOOLEAN
) RETURNS VOID AS $$
BEGIN
    INSERT INTO cache_stats (key, hits, misses, last_access)
    VALUES (
        p_key,
        CASE WHEN p_hit THEN 1 ELSE 0 END,
        CASE WHEN p_hit THEN 0 ELSE 1 END,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (key) DO UPDATE
    SET 
        hits = cache_stats.hits + CASE WHEN p_hit THEN 1 ELSE 0 END,
        misses = cache_stats.misses + CASE WHEN p_hit THEN 0 ELSE 1 END,
        last_access = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_data(
    p_days INTEGER DEFAULT 30
) RETURNS TABLE(
    deleted_operations INTEGER,
    deleted_conversations INTEGER,
    deleted_snapshots INTEGER
) AS $$
DECLARE
    v_cutoff_date TIMESTAMP;
    v_deleted_operations INTEGER;
    v_deleted_conversations INTEGER;
    v_deleted_snapshots INTEGER;
BEGIN
    v_cutoff_date := CURRENT_TIMESTAMP - INTERVAL '1 day' * p_days;
    
    -- Delete old operations
    DELETE FROM operations
    WHERE created_at < v_cutoff_date;
    GET DIAGNOSTICS v_deleted_operations = ROW_COUNT;
    
    -- Delete old conversations
    DELETE FROM conversations
    WHERE created_at < v_cutoff_date;
    GET DIAGNOSTICS v_deleted_conversations = ROW_COUNT;
    
    -- Delete old config snapshots
    DELETE FROM config_snapshots
    WHERE created_at < v_cutoff_date;
    GET DIAGNOSTICS v_deleted_snapshots = ROW_COUNT;
    
    RETURN QUERY
    SELECT v_deleted_operations, v_deleted_conversations, v_deleted_snapshots;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data
INSERT INTO cache_stats (key, hits, misses, last_access) VALUES
    ('firewall:rules', 0, 0, CURRENT_TIMESTAMP),
    ('network:vlans', 0, 0, CURRENT_TIMESTAMP),
    ('network:interfaces', 0, 0, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mcp_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO mcp_user;
