#!/bin/bash
# Phase 1 Testing Script for OPNSense MCP Server

echo "=========================================="
echo "Phase 1 Testing - OPNSense MCP Server"
echo "=========================================="
echo ""

# Step 1: Build the project
echo "Step 1: Building the project..."
echo "Running: npm run build"
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed! Please check the errors above."
    exit 1
fi

echo ""
echo "Step 2: Checking compiled output..."
if [ -f "dist/index.js" ]; then
    echo "✅ Main server file compiled: dist/index.js"
else
    echo "❌ Main server file not found!"
    exit 1
fi

if [ -d "dist/resources" ]; then
    echo "✅ Resources compiled: dist/resources/"
else
    echo "❌ Resources not compiled!"
    exit 1
fi

if [ -d "dist/state" ]; then
    echo "✅ State management compiled: dist/state/"
else
    echo "❌ State management not compiled!"
    exit 1
fi

echo ""
echo "=========================================="
echo "Phase 1 Testing Results"
echo "=========================================="
echo "✅ TypeScript compilation: PASSED"
echo "✅ All required modules: COMPILED"
echo "✅ Phase 1 Status: COMPLETE"
echo ""
echo "Next Steps:"
echo "1. Update claude_desktop_config.json with your OPNSense credentials"
echo "2. Restart Claude Desktop"
echo "3. Test the applyResource tool with a simple resource"
echo ""
echo "Example test command:"
echo 'await use_tool("applyResource", {'
echo '  action: "create",'
echo '  resource: {'
echo '    type: "opnsense:firewall:alias",'
echo '    name: "test-alias",'
echo '    properties: {'
echo '      type: "host",'
echo '      content: ["192.168.1.100"],'
echo '      description: "Test alias from Phase 1"'
echo '    }'
echo '  }'
echo '});'
