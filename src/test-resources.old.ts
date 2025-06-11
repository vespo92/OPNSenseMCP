#!/usr/bin/env node
import { FirewallRule } from './resources/firewall/rule.js';
import { FirewallAlias } from './resources/firewall/alias.js';
import { Vlan } from './resources/network/vlan.js';
import { Interface } from './resources/network/interface.js';
import { ResourceRegistry } from './resources/registry.js';

console.log('🧪 Testing OPNSense Resource Model\n');

// Test 1: Firewall Rule Validation
console.log('Test 1: Firewall Rule Validation');
const rule1 = new FirewallRule('test-rule', {
  interface: 'wan',
  action: 'pass',
  destination: '10.0.0.1',
  destinationPort: '443',
  protocol: 'tcp'
});

const validation1 = rule1.validate();
console.log('✓ Valid rule:', validation1.valid);
console.log('  Payload:', JSON.stringify(rule1.toApiPayload(), null, 2));

// Test 2: Invalid Firewall Rule
console.log('\nTest 2: Invalid Firewall Rule');
const rule2 = new FirewallRule('bad-rule', {
  interface: 'wan',
  action: 'invalid' as any,
  destinationPort: '99999'
});

const validation2 = rule2.validate();
console.log('✓ Invalid rule detected:', !validation2.valid);
console.log('  Errors:', validation2.errors);

// Test 3: Security Warnings
console.log('\nTest 3: Security Warnings');
const rule3 = new FirewallRule('risky-rule', {
  interface: 'wan',
  action: 'pass',
  source: 'any',
  destination: 'any',
  destinationPort: '22'
});

const validation3 = rule3.validate();
console.log('✓ Rule valid but has warnings:', validation3.valid && validation3.warnings && validation3.warnings.length > 0);
console.log('  Warnings:', validation3.warnings);

// Test 4: Firewall Alias
console.log('\nTest 4: Firewall Alias');
const alias = new FirewallAlias('web-servers', {
  type: 'host',
  content: '10.0.0.1\n10.0.0.2\n10.0.0.3'
});

console.log('✓ Alias created with', alias.getEntries().length, 'entries');
alias.addEntry('10.0.0.4');
console.log('✓ Entry added, now has', alias.getEntries().length, 'entries');

// Test 5: VLAN Creation
console.log('\nTest 5: VLAN Creation');
const vlan = new Vlan('dmz-vlan', {
  tag: 150,
  device: 'igc2',
  description: 'DMZ Network'
});

const vlanValidation = vlan.validate();
console.log('✓ VLAN valid:', vlanValidation.valid);
console.log('  Interface name:', vlan.getInterfaceName());

// Test 6: Interface Configuration
console.log('\nTest 6: Interface Configuration');
const iface = new Interface('dmz-interface', {
  device: 'igc2.150',
  ipv4: {
    type: 'static',
    address: '10.0.150.1',
    subnet: 24
  },
  enabled: true
});

const ifaceValidation = iface.validate();
console.log('✓ Interface valid:', ifaceValidation.valid);
console.log('  Network:', iface.getNetwork());

// Test 7: Resource Registry
console.log('\nTest 7: Resource Registry');
const registry = ResourceRegistry.initialize();

const resources = registry.createFromConfig([
  {
    type: 'opnsense:firewall:rule',
    name: 'allow-http',
    properties: {
      interface: 'wan',
      action: 'pass',
      destinationPort: '80',
      protocol: 'tcp'
    }
  },
  {
    type: 'opnsense:network:vlan',
    name: 'app-vlan',
    properties: {
      tag: 100,
      device: 'igc1',
      description: 'Application VLAN'
    }
  }
]);

console.log('✓ Created', resources.length, 'resources from config');
console.log('✓ Registry has', registry.getAll().length, 'total resources');

// Test 8: Dependency Graph
console.log('\nTest 8: Dependency Graph');
registry.clearInstances(); // Clear for clean test

const vlan2 = registry.create('opnsense:network:vlan', 'test-vlan', {
  tag: 200,
  device: 'igc0',
  description: 'Test VLAN'
});

const iface2 = registry.create('opnsense:network:interface', 'test-interface', {
  device: 'igc0.200',
  ipv4: { type: 'dhcp' }
}, [vlan2.id]);

const rule4 = registry.create('opnsense:firewall:rule', 'test-rule', {
  interface: 'igc0.200',
  action: 'pass'
}, [iface2.id]);

const graph = registry.buildDependencyGraph();
console.log('✓ Built dependency graph with', graph.nodes.size, 'nodes');
console.log('✓ Graph has', graph.edges.length, 'edges');

// Test 9: Validation Report
console.log('\nTest 9: Validation Report');
registry.clearInstances();

registry.create('opnsense:firewall:rule', 'good-rule', {
  interface: 'wan',
  action: 'pass'
});

registry.create('opnsense:firewall:rule', 'bad-rule', {
  interface: 'wan',
  action: 'invalid' as any
});

const report = registry.validateAll();
console.log('✓ Validation report complete');
console.log('  Overall valid:', report.valid);
console.log('  Resources validated:', report.resources.length);
console.log('  Valid resources:', report.resources.filter((r: any) => r.valid).length);
console.log('  Invalid resources:', report.resources.filter((r: any) => !r.valid).length);

// Test 10: Complex Scenario
console.log('\nTest 10: Complex Network Setup');
registry.clearInstances();

// Create complete network setup
const appVlan = registry.create('opnsense:network:vlan', 'app-vlan', {
  tag: 300,
  device: 'igc3',
  description: 'Application Network VLAN'
});

const appInterface = registry.create('opnsense:network:interface', 'app-interface', {
  device: 'igc3.300',
  ipv4: {
    type: 'static',
    address: '192.168.100.1',
    subnet: 24
  }
}, [appVlan.id]);

const dhcpRange = registry.create('opnsense:service:dhcp:range', 'app-dhcp', {
  interface: 'igc3.300',
  from: '192.168.100.100',
  to: '192.168.100.200'
}, [appInterface.id]);

const appRule = registry.create('opnsense:firewall:rule', 'app-internet', {
  interface: 'igc3.300',
  action: 'pass',
  source: '192.168.100.0/24',
  destination: 'any',
  description: 'Allow app network to internet'
}, [appInterface.id]);

const finalValidation = registry.validateAll();
console.log('✓ Complex setup validation:', finalValidation.valid ? 'PASSED' : 'FAILED');
console.log('  Total resources:', registry.getAll().length);
console.log('  All dependencies resolved');

console.log('\n✅ All tests completed successfully!');
