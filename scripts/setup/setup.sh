#!/bin/bash
# Quick setup script for OPNSense MCP Server

echo "🚀 Setting up OPNSense MCP Server..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building TypeScript..."
npm run build

# Copy example env file
if [ ! -f .env ]; then
    echo "📋 Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your OPNSense credentials"
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your OPNSense API credentials"
echo "2. Run 'npm start' to start the server"
echo "3. Configure your MCP client to use this server"
echo ""
echo "For Claude Desktop, add this to your config:"
echo "Location: %APPDATA%\\Claude\\claude_desktop_config.json"
cat examples/claude-desktop-config.json
