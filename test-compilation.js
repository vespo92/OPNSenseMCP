// Quick test to verify compilation
import { createNetworkQueryEngine } from './dist/db/network-query/index.js';

async function test() {
  console.log('Testing imports...');
  const engine = await createNetworkQueryEngine();
  console.log('Engine created successfully!');
}

test().catch(console.error);