-- Migration: Add enhanced caching tables
-- Generated: 2025-01-06

-- Create enums
CREATE TYPE operation_result AS ENUM ('success', 'failure', 'partial');
CREATE TYPE command_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE message_type AS ENUM ('request', 'response', 'event', 'error');

-- Alter existing tables to use enums
ALTER TABLE operations 
  ALTER COLUMN result TYPE operation_result 
  USING result::operation_result;

ALTER TABLE command_queue 
  ALTER COLUMN status TYPE command_status 
  USING status::command_status;

ALTER TABLE conversations 
  ALTER COLUMN message_type TYPE message_type 
  USING message_type::message_type;

-- Add new columns to existing tables
ALTER TABLE cache_stats 
  ADD COLUMN IF NOT EXISTS avg_response_time NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS data_size INTEGER;

ALTER TABLE command_queue
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

-- Create new tables for enhanced caching
CREATE TABLE IF NOT EXISTS query_patterns (
  id SERIAL PRIMARY KEY,
  pattern VARCHAR(255) NOT NULL UNIQUE,
  frequency INTEGER DEFAULT 1,
  avg_execution_time NUMERIC(10, 2),
  last_executed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cache_priority INTEGER DEFAULT 0,
  suggested_ttl INTEGER DEFAULT 300,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cache_invalidation_rules (
  id SERIAL PRIMARY KEY,
  trigger_type VARCHAR(50) NOT NULL, -- 'operation', 'time', 'dependency'
  trigger_pattern VARCHAR(255) NOT NULL,
  affected_pattern VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for new tables
CREATE UNIQUE INDEX idx_query_patterns_pattern ON query_patterns(pattern);
CREATE INDEX idx_query_patterns_frequency ON query_patterns(frequency DESC);
CREATE INDEX idx_query_patterns_priority ON query_patterns(cache_priority DESC);

CREATE INDEX idx_invalidation_trigger_type ON cache_invalidation_rules(trigger_type);
CREATE INDEX idx_invalidation_enabled ON cache_invalidation_rules(enabled);

-- Insert default invalidation rules
INSERT INTO cache_invalidation_rules (trigger_type, trigger_pattern, affected_pattern, priority) VALUES
  ('operation', 'firewall:rule:create', 'cache:firewall:*', 10),
  ('operation', 'firewall:rule:update', 'cache:firewall:*', 10),
  ('operation', 'firewall:rule:delete', 'cache:firewall:*', 10),
  ('operation', 'network:vlan:create', 'cache:network:*', 10),
  ('operation', 'network:vlan:update', 'cache:network:*', 10),
  ('operation', 'network:vlan:delete', 'cache:network:*', 10),
  ('operation', 'network:interface:update', 'cache:network:*', 10),
  ('operation', 'system:backup:create', 'cache:backup:*', 5),
  ('operation', 'system:backup:restore', 'cache:*', 20),
  ('dependency', 'cache:network:interfaces', 'cache:network:vlans', 5),
  ('dependency', 'cache:firewall:aliases', 'cache:firewall:rules', 5)
ON CONFLICT DO NOTHING;

-- Create materialized view for cache performance analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS cache_performance_analytics AS
SELECT 
  date_trunc('hour', last_access) as hour,
  split_part(key, ':', 2) as resource,
  COUNT(*) as total_requests,
  SUM(hits) as total_hits,
  SUM(misses) as total_misses,
  CASE 
    WHEN SUM(hits) + SUM(misses) = 0 THEN 0
    ELSE ROUND((SUM(hits)::NUMERIC / (SUM(hits) + SUM(misses))) * 100, 2)
  END as hit_rate,
  AVG(avg_response_time) as avg_response_time,
  MAX(data_size) as max_data_size
FROM cache_stats
GROUP BY date_trunc('hour', last_access), split_part(key, ':', 2)
ORDER BY hour DESC, total_requests DESC;

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_cache_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY cache_performance_analytics;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate optimal TTL
CREATE OR REPLACE FUNCTION calculate_optimal_ttl(
  p_frequency INTEGER,
  p_avg_execution_time NUMERIC,
  p_base_ttl INTEGER DEFAULT 300
) RETURNS INTEGER AS $$
DECLARE
  v_frequency_factor NUMERIC;
  v_execution_factor NUMERIC;
  v_calculated_ttl INTEGER;
BEGIN
  -- Calculate factors (capped at 2x multiplier each)
  v_frequency_factor := LEAST(p_frequency::NUMERIC / 100, 2);
  v_execution_factor := LEAST(p_avg_execution_time / 1000, 2);
  
  -- Calculate TTL with factors
  v_calculated_ttl := p_base_ttl * (1 + v_frequency_factor + v_execution_factor);
  
  -- Enforce min/max bounds (60s to 3600s)
  RETURN GREATEST(LEAST(v_calculated_ttl, 3600), 60);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update suggested TTL
CREATE OR REPLACE FUNCTION update_suggested_ttl()
RETURNS TRIGGER AS $$
BEGIN
  NEW.suggested_ttl := calculate_optimal_ttl(
    NEW.frequency, 
    NEW.avg_execution_time
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_suggested_ttl
BEFORE INSERT OR UPDATE ON query_patterns
FOR EACH ROW
EXECUTE FUNCTION update_suggested_ttl();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON cache_performance_analytics TO mcp_user;
