#!/usr/bin/env node

// Simple test script to verify the MCP server starts correctly
// Run with: node test-server.js

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting OPNSense MCP Server test...');

const serverPath = join(__dirname, '..', 'dist', 'index.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

server.stderr.on('data', (data) => {
  console.log(`Server: ${data.toString()}`);
  if (data.toString().includes('OPNSense MCP server running on stdio')) {
    console.log('✅ Server started successfully!');
    
    // Send a list tools request
    const listToolsRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    };
    
    server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  }
});

server.stdout.on('data', (data) => {
  try {
    const response = JSON.parse(data.toString());
    console.log('Response:', JSON.stringify(response, null, 2));
    
    if (response.result && response.result.tools) {
      console.log(`✅ Found ${response.result.tools.length} tools`);
      console.log('Tools:', response.result.tools.map(t => t.name).join(', '));
      
      // Success - exit cleanly
      server.kill();
      process.exit(0);
    }
  } catch (e) {
    console.error('Error parsing response:', e);
  }
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 10000);
