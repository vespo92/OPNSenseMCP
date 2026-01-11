/**
 * Test the IaC components integration
 */

import { DeploymentPlanner } from '../src/deployment/planner';
import type { IaCResource } from '../src/resources/base';
import { VlanResource } from '../src/resources/network/vlan-iac';
import { resourceRegistry } from '../src/resources/registry';

async function testIaCComponents() {
  console.log('Testing IaC Components...\n');

  // Test 1: Resource Creation and Validation
  console.log('1. Testing Resource Creation:');
  const vlan1 = new VlanResource('vlan-100', 'Guest VLAN', {
    interface: 'igc1',
    tag: 100,
    description: 'Guest Network VLAN',
  });

  const validation = vlan1.validate();
  console.log(`   Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
  if (!validation.valid) {
    console.log(`   Errors:`, validation.errors);
  }

  // Test 2: Resource Registry
  console.log('\n2. Testing Resource Registry:');
  const types = resourceRegistry.listResourceTypes();
  console.log(`   Registered types: ${types.join(', ')}`);

  // Test 3: Resource State
  console.log('\n3. Testing Resource State:');
  const state = vlan1.toState();
  console.log(`   State:`, JSON.stringify(state, null, 2));

  // Test 4: API Payload Generation
  console.log('\n4. Testing API Payload:');
  const payload = vlan1.toAPIPayload();
  console.log(`   Payload:`, JSON.stringify(payload, null, 2));

  // Test 5: Deployment Planning
  console.log('\n5. Testing Deployment Planning:');

  const desiredResources: IaCResource[] = [
    new VlanResource('vlan-100', 'Guest VLAN', {
      interface: 'igc1',
      tag: 100,
      description: 'Guest Network',
    }),
    new VlanResource('vlan-200', 'IoT VLAN', {
      interface: 'igc1',
      tag: 200,
      description: 'IoT Devices',
    }),
  ];

  const currentResources: IaCResource[] = [
    new VlanResource('vlan-100', 'Guest VLAN', {
      interface: 'igc1',
      tag: 100,
      description: 'Old Guest Network', // Different description
    }),
  ];

  const planner = new DeploymentPlanner();
  const plan = await planner.planDeployment('test-deployment', desiredResources, currentResources);

  console.log(`   Plan Summary:`);
  console.log(`     - Create: ${plan.summary.create}`);
  console.log(`     - Update: ${plan.summary.update}`);
  console.log(`     - Delete: ${plan.summary.delete}`);
  console.log(`     - Waves: ${plan.executionWaves.length}`);

  // Test 6: Resource Dependencies
  console.log('\n6. Testing Dependencies:');
  vlan1.addDependency({
    resourceId: 'interface-igc1',
    type: 'hard',
  });
  console.log(`   Dependencies:`, vlan1.getDependencies());

  console.log('\n✅ All IaC component tests completed!');
}

// Run tests
testIaCComponents().catch(console.error);
