#!/bin/bash
# Deploy OPNsense MCP Infrastructure on Hypervisor (10.0.0.2)

echo "🚀 Deploying OPNsense MCP Infrastructure..."
echo ""

# Check if running on the hypervisor
CURRENT_IP=$(hostname -I | awk '{print $1}')
if [[ "$CURRENT_IP" != "10.0.0.2" ]]; then
    echo "⚠️  Warning: This script should be run on the hypervisor (10.0.0.2)"
    echo "   Current IP: $CURRENT_IP"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create directories
echo "📁 Creating directories..."
mkdir -p /opt/opnsense-mcp/{data,backups,logs}
mkdir -p /opt/opnsense-mcp/data/{redis,postgres,pgadmin}

# Copy files
echo "📋 Copying configuration files..."
cp docker-compose.yml /opt/opnsense-mcp/
cp init-db.sql /opt/opnsense-mcp/

# Create .env file if it doesn't exist
if [ ! -f /opt/opnsense-mcp/.env ]; then
    echo "📝 Creating .env file..."
    cp .env.example /opt/opnsense-mcp/.env
    echo ""
    echo "⚠️  Please edit /opt/opnsense-mcp/.env with your actual credentials!"
    echo ""
fi

# Set permissions
echo "🔐 Setting permissions..."
chmod 600 /opt/opnsense-mcp/.env
chown -R 1000:1000 /opt/opnsense-mcp/data

# Pull Docker images
echo "🐳 Pulling Docker images..."
cd /opt/opnsense-mcp
docker-compose pull

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo ""
echo "✅ Service Status:"
docker-compose ps

# Display connection information
echo ""
echo "📌 Connection Information:"
echo "   Redis:          10.0.0.2:6379"
echo "   PostgreSQL:     10.0.0.2:5432"
echo "   Redis Commander: http://10.0.0.2:8081"
echo "   pgAdmin:        http://10.0.0.2:8082"
echo ""
echo "📊 Test connections:"
echo "   redis-cli -h 10.0.0.2 ping"
echo "   psql -h 10.0.0.2 -U mcp_user -d opnsense_mcp -c 'SELECT 1'"
echo ""
echo "🎉 Deployment complete!"
