#!/bin/bash
# Deploy ONLY Redis and PostgreSQL on Hypervisor (10.0.0.2)
# The MCP server stays on your local machine!

echo "🚀 Deploying Redis & PostgreSQL for OPNsense MCP..."
echo "   (MCP Server remains on your local machine)"
echo ""

# Create minimal directory structure
echo "📁 Creating directories..."
mkdir -p /opt/opnsense-mcp-data/{redis,postgres,pgadmin}

# Create docker-compose.yml
cat > /opt/opnsense-mcp-data/docker-compose.yml << 'EOF'
version: '3.8'

services:
  # Redis for caching
  redis:
    image: redis:7-alpine
    container_name: opnsense-mcp-redis
    restart: unless-stopped
    ports:
      - "10.0.0.2:6379:6379"
    volumes:
      - ./redis:/data
    command: >
      redis-server
      --save 60 1
      --save 300 10
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru

  # PostgreSQL for persistence
  postgres:
    image: postgres:15-alpine
    container_name: opnsense-mcp-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: opnsense_mcp
      POSTGRES_USER: mcp_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-mcp_secure_password}
    ports:
      - "10.0.0.2:5432:5432"
    volumes:
      - ./postgres:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql

  # Optional: Redis Commander
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: opnsense-mcp-redis-ui
    restart: unless-stopped
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "10.0.0.2:8081:8081"
    depends_on:
      - redis

  # Optional: pgAdmin
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: opnsense-mcp-pgadmin
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@opnsense.local
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD:-admin}
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    ports:
      - "10.0.0.2:8082:80"
    volumes:
      - ./pgadmin:/var/lib/pgadmin
    depends_on:
      - postgres
EOF

# Copy only the database init script
echo "📋 Copying database schema..."
# You'll need to copy init-db.sql to the hypervisor

# Start services
cd /opt/opnsense-mcp-data
echo "🐳 Starting services..."
docker-compose up -d

echo ""
echo "✅ Services deployed on hypervisor!"
echo ""
echo "📌 Connection info for your LOCAL .env file:"
echo "   REDIS_HOST=10.0.0.2"
echo "   REDIS_PORT=6379"
echo "   POSTGRES_HOST=10.0.0.2"
echo "   POSTGRES_PORT=5432"
echo "   POSTGRES_DB=opnsense_mcp"
echo "   POSTGRES_USER=mcp_user"
echo ""
echo "🎉 Done! The MCP server stays on your local machine."
