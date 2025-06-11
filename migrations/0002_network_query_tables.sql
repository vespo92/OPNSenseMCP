-- Network Query Engine Tables Migration

-- Create enums
CREATE TYPE device_type AS ENUM (
  'computer', 'phone', 'tablet', 'gaming_console', 'smart_tv', 
  'iot_device', 'smart_speaker', 'camera', 'printer', 'router', 
  'nas', 'media_player', 'smart_home', 'wearable', 'unknown'
);

CREATE TYPE device_status AS ENUM ('online', 'offline', 'sleeping', 'unknown');
CREATE TYPE connection_type AS ENUM ('ethernet', 'wifi_2.4ghz', 'wifi_5ghz', 'wifi_6ghz');

-- Device Fingerprints Table
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id SERIAL PRIMARY KEY,
  mac_prefix VARCHAR(8) NOT NULL UNIQUE,
  manufacturer VARCHAR(255) NOT NULL,
  device_type device_type NOT NULL,
  common_models JSONB,
  confidence NUMERIC(3,2) DEFAULT 0.90,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_fingerprints_mac_prefix ON device_fingerprints(mac_prefix);
CREATE INDEX idx_fingerprints_manufacturer ON device_fingerprints(manufacturer);
CREATE INDEX idx_fingerprints_device_type ON device_fingerprints(device_type);

-- Hostname Patterns Table
CREATE TABLE IF NOT EXISTS hostname_patterns (
  id SERIAL PRIMARY KEY,
  pattern VARCHAR(255) NOT NULL,
  device_type device_type NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0,
  examples JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hostname_patterns_pattern ON hostname_patterns(pattern);
CREATE INDEX idx_hostname_patterns_device_type ON hostname_patterns(device_type);
CREATE INDEX idx_hostname_patterns_priority ON hostname_patterns(priority);

-- Network Interfaces Table
CREATE TABLE IF NOT EXISTS network_interfaces (
  id SERIAL PRIMARY KEY,
  interface_name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  vlan_id INTEGER,
  ip_address INET,
  subnet VARCHAR(20),
  is_guest BOOLEAN DEFAULT FALSE,
  is_iot BOOLEAN DEFAULT FALSE,
  is_trusted BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_interfaces_name ON network_interfaces(interface_name);
CREATE INDEX idx_interfaces_vlan ON network_interfaces(vlan_id);

-- Devices Table
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  mac_address MACADDR NOT NULL UNIQUE,
  device_type device_type DEFAULT 'unknown',
  manufacturer VARCHAR(255),
  hostname VARCHAR(255),
  friendly_name VARCHAR(255),
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  total_data_sent BIGINT DEFAULT 0,
  total_data_received BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_devices_mac ON devices(mac_address);
CREATE INDEX idx_devices_type ON devices(device_type);
CREATE INDEX idx_devices_hostname ON devices(hostname);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);
CREATE INDEX idx_devices_friendly_name ON devices(friendly_name);

-- DHCP Leases Table
CREATE TABLE IF NOT EXISTS dhcp_leases (
  id SERIAL PRIMARY KEY,
  mac_address MACADDR NOT NULL,
  ip_address INET NOT NULL,
  hostname VARCHAR(255),
  interface_name VARCHAR(50) NOT NULL,
  lease_start TIMESTAMP NOT NULL,
  lease_end TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  vendor_class_id VARCHAR(255),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_dhcp_mac_ip ON dhcp_leases(mac_address, ip_address);
CREATE INDEX idx_dhcp_active ON dhcp_leases(is_active);
CREATE INDEX idx_dhcp_interface ON dhcp_leases(interface_name);
CREATE INDEX idx_dhcp_lease_end ON dhcp_leases(lease_end);

-- Traffic Statistics Table
CREATE TABLE IF NOT EXISTS traffic_stats (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  bytes_in BIGINT DEFAULT 0,
  bytes_out BIGINT DEFAULT 0,
  packets_in BIGINT DEFAULT 0,
  packets_out BIGINT DEFAULT 0,
  connections INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_traffic_device_timestamp ON traffic_stats(device_id, timestamp);
CREATE INDEX idx_traffic_timestamp ON traffic_stats(timestamp);

-- Active Connections Table
CREATE TABLE IF NOT EXISTS active_connections (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  protocol VARCHAR(10) NOT NULL,
  source_port INTEGER,
  dest_ip INET NOT NULL,
  dest_port INTEGER NOT NULL,
  state VARCHAR(20),
  bytes_transferred BIGINT DEFAULT 0,
  start_time TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_connections_device ON active_connections(device_id);
CREATE INDEX idx_connections_dest ON active_connections(dest_ip, dest_port);
CREATE INDEX idx_connections_activity ON active_connections(last_activity);

-- Query Intents Table
CREATE TABLE IF NOT EXISTS query_intents (
  id SERIAL PRIMARY KEY,
  intent VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  query_template TEXT NOT NULL,
  required_params JSONB,
  examples JSONB,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_intents_intent ON query_intents(intent);
CREATE INDEX idx_intents_priority ON query_intents(priority);

-- Query Keywords Table
CREATE TABLE IF NOT EXISTS query_keywords (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(100) NOT NULL,
  intent_id INTEGER NOT NULL REFERENCES query_intents(id) ON DELETE CASCADE,
  synonyms JSONB,
  weight NUMERIC(3,2) DEFAULT 1.00,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_keywords_keyword ON query_keywords(keyword);
CREATE INDEX idx_keywords_intent ON query_keywords(intent_id);

-- Device Groups Table
CREATE TABLE IF NOT EXISTS device_groups (
  id SERIAL PRIMARY KEY,
  group_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  owner_name VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_groups_name ON device_groups(group_name);
CREATE INDEX idx_groups_owner ON device_groups(owner_name);

-- Device Group Members Table
CREATE TABLE IF NOT EXISTS device_group_members (
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (device_id, group_id)
);

CREATE INDEX idx_group_members_device ON device_group_members(device_id);
CREATE INDEX idx_group_members_group ON device_group_members(group_id);

-- Device Summary View (Materialized View as Table)
CREATE TABLE IF NOT EXISTS device_summary_view (
  device_id INTEGER PRIMARY KEY,
  mac_address MACADDR NOT NULL,
  device_type device_type,
  friendly_name VARCHAR(255),
  current_ip INET,
  interface_name VARCHAR(50),
  vlan_id INTEGER,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP,
  daily_data_usage BIGINT DEFAULT 0,
  active_connections INTEGER DEFAULT 0,
  group_names JSONB,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_summary_mac ON device_summary_view(mac_address);
CREATE INDEX idx_summary_type ON device_summary_view(device_type);
CREATE INDEX idx_summary_online ON device_summary_view(is_online);
CREATE INDEX idx_summary_interface ON device_summary_view(interface_name);
CREATE INDEX idx_summary_vlan ON device_summary_view(vlan_id);

-- Query Performance Table
CREATE TABLE IF NOT EXISTS query_performance (
  id SERIAL PRIMARY KEY,
  query_hash VARCHAR(64) NOT NULL,
  natural_query TEXT NOT NULL,
  sql_query TEXT NOT NULL,
  execution_time NUMERIC(10,3) NOT NULL,
  result_count INTEGER DEFAULT 0,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_performance_hash ON query_performance(query_hash);
CREATE INDEX idx_performance_time ON query_performance(execution_time);
CREATE INDEX idx_performance_timestamp ON query_performance(timestamp);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables with updated_at
CREATE TRIGGER update_device_fingerprints_updated_at BEFORE UPDATE ON device_fingerprints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_network_interfaces_updated_at BEFORE UPDATE ON network_interfaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dhcp_leases_updated_at BEFORE UPDATE ON dhcp_leases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_groups_updated_at BEFORE UPDATE ON device_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();