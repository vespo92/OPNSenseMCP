#!/usr/bin/env node

// Quick setup script for OPNSense Network Query Engine
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up OPNSense Natural Language Query Engine...\n');

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('📝 Creating .env file from .env.example...');
  fs.copyFileSync('.env.example', '.env');
  console.log('⚠️  Please update .env with your database credentials!\n');
}

// Install dependencies if needed
if (!fs.existsSync('node_modules')) {
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
}

// Run database migrations
console.log('\n🗄️  Setting up database tables...');
try {
  execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });
  console.log('✅ Database tables created successfully!\n');
} catch (error) {
  console.error('❌ Failed to create database tables. Please check your database connection.\n');
  process.exit(1);
}

// Create test script
const testScript = `
// Test the Natural Language Query Engine
import { createNetworkQueryEngine } from './src/db/network-query/index.js';

async function test() {
  const engine = await createNetworkQueryEngine();
  
  // Initialize fingerprint database
  console.log('Initializing device fingerprints...');
  await engine.fingerprinting.initializeFingerprints();
  
  // Test a simple query
  console.log('\\nTesting query: "Show me all gaming consoles"');
  const result = await engine.processQuery("Show me all gaming consoles");
  console.log('Results:', result);
}

test().catch(console.error);
`;

fs.writeFileSync('test-quick.js', testScript);

console.log('✨ Setup complete!\n');
console.log('Next steps:');
console.log('1. Update your .env file with PostgreSQL credentials');
console.log('2. Ensure PostgreSQL is running on 10.0.0.2');
console.log('3. Run: npm run build');
console.log('4. Test with: node test-network-query.js');
console.log('5. Start MCP server: npm start\n');
console.log('📚 See src/db/network-query/README.md for full documentation\n');