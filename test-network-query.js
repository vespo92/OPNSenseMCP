// Test script for Natural Language Network Query Engine
import { config } from 'dotenv';
import { createNetworkQueryEngine } from './dist/db/network-query/index.js';
import { DeviceFingerprintingService } from './dist/db/network-query/fingerprinting.js';

config();

async function testQueryEngine() {
  console.log('🚀 Testing OPNSense Natural Language Query Engine\n');
  
  try {
    // Initialize the query engine
    const engine = await createNetworkQueryEngine();
    console.log('✅ Query engine initialized\n');
    
    // Test queries
    const testQueries = [
      "Is the Nintendo Switch online?",
      "Which devices are on the guest network?",
      "Show me all gaming consoles",
      "Which devices used more than 10GB today?",
      "Are there any unknown devices on my network?",
      "What devices does the person with iPhone 'Sarah's Phone' have?",
      "Show me all Apple devices",
      "List devices that were online in the last hour",
      "Which smart speakers are connected?",
      "Show me devices on VLAN 4"
    ];
    
    // Process each query
    for (const query of testQueries) {
      console.log(`📝 Query: "${query}"`);
      
      try {
        const result = await engine.processQuery(query);
        
        console.log(`✨ Intent: ${result.intent} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
        console.log(`⚡ Execution time: ${result.executionTime}ms`);
        console.log(`📊 Results: ${result.results.length} found`);
        
        if (result.results.length > 0) {
          console.log('📋 Sample results:');
          result.results.slice(0, 3).forEach((r, i) => {
            console.log(`   ${i + 1}. ${JSON.stringify(r)}`);
          });
        }
        
        console.log('---\n');
      } catch (error) {
        console.error(`❌ Error: ${error.message}\n`);
      }
    }
    
    // Test device identification
    console.log('\n🔍 Testing Device Fingerprinting\n');
    
    const testDevices = [
      { mac: '7C:BB:8A:12:34:56', hostname: 'switch-console' },
      { mac: '00:D9:D1:AA:BB:CC', hostname: 'PS5-living-room' },
      { mac: 'A8:51:6B:11:22:33', hostname: 'iPhone' },
      { mac: '68:C6:3A:44:55:66', hostname: 'Echo-Kitchen' },
      { mac: 'AA:BB:CC:DD:EE:FF', hostname: 'unknown-device' }
    ];
    
    for (const device of testDevices) {
      const result = await engine.identifyDevice(device.mac, device.hostname);
      console.log(`MAC: ${device.mac} | Hostname: ${device.hostname}`);
      console.log(`→ Type: ${result.deviceType} | Manufacturer: ${result.manufacturer || 'Unknown'}`);
      console.log(`→ Confidence: ${(result.confidence * 100).toFixed(0)}% | Method: ${result.method}\n`);
    }
    
    // Performance stats
    console.log('\n📈 Performance Test\n');
    
    const perfStart = Date.now();
    const perfQueries = 100;
    
    for (let i = 0; i < perfQueries; i++) {
      await engine.processQuery("Show me all online devices");
    }
    
    const avgTime = (Date.now() - perfStart) / perfQueries;
    console.log(`Average query time over ${perfQueries} queries: ${avgTime.toFixed(2)}ms`);
    console.log(`Target: <100ms ${avgTime < 100 ? '✅ PASS' : '❌ FAIL'}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run tests
testQueryEngine().catch(console.error);