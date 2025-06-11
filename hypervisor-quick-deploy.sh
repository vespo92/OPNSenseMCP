#!/bin/bash
# One-liner to deploy Redis & PostgreSQL on hypervisor
# Run this on the hypervisor (10.0.0.2)

mkdir -p /opt/opnsense-mcp-data && cd /opt/opnsense-mcp-data

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports: ["10.0.0.2:6379:6379"]
    volumes: ["./redis:/data"]
    restart: unless-stopped
    
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: opnsense_mcp
      POSTGRES_USER: mcp_user
      POSTGRES_PASSWORD: changeme
    ports: ["10.0.0.2:5432:5432"]
    volumes: ["./postgres:/var/lib/postgresql/data"]
    restart: unless-stopped
EOF

# Create basic tables
cat > init.sql << 'EOF'
CREATE TABLE IF NOT EXISTS backups (
    id VARCHAR(255) PRIMARY KEY,
    filename VARCHAR(255),
    timestamp TIMESTAMP,
    description TEXT
);

CREATE TABLE IF NOT EXISTS operations (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50),
    action VARCHAR(50),
    result VARCHAR(20),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF

# Start it
docker-compose up -d

echo "Done! Redis on port 6379, PostgreSQL on port 5432"
echo "Update POSTGRES_PASSWORD in docker-compose.yml!"
