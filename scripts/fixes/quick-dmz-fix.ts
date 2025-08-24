import { OPNSenseAPIClient } from '../../src/api/client.js';
import { RoutingDiagnosticsResource } from '../../src/resources/diagnostics/routing.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function quickFixDMZ() {
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: false
  });

  const diagnostics = new RoutingDiagnosticsResource(client);
  
  console.log('🚀 Quick Fix for DMZ Routing');
  console.log('============================\n');
  
  console.log('This will:');
  console.log('1. Disable "Block private networks" on DMZ interface');
  console.log('2. Enable system-level inter-VLAN routing');
  console.log('3. Create firewall rules for DMZ → LAN');
  console.log('4. Create specific NFS rules for TrueNAS\n');
  
  try {
    // First run diagnostics for DMZ to LAN
    console.log('Running diagnostics for DMZ → LAN...\n');
    const diagnosticResults = await diagnostics.runDiagnostics('10.0.6.0/24', '10.0.0.0/24');
    
    console.log('📊 Issues Found:');
    console.log('===============');
    diagnosticResults.issues.forEach(issue => {
      const icon = issue.severity === 'critical' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${icon} [${issue.component}] ${issue.issue}`);
      if (issue.fixAvailable) {
        console.log(`   Fix available: ${issue.fixCommand || 'Auto-fix available'}`);
      }
    });
    
    console.log('\n🔧 Applying fixes...\n');
    const fixResults = await diagnostics.fixAllRoutingIssues();
    
    console.log('\n📊 Fix Results:');
    console.log('==============');
    
    if (fixResults.success) {
      console.log('✅ All fixes applied successfully!');
      console.log('\nActions taken:');
      fixResults.actions.forEach(action => {
        console.log(`  • ${action}`);
      });
    } else {
      console.log('⚠️  Some fixes may have failed');
      if (fixResults.actions.length > 0) {
        console.log('\nActions attempted:');
        fixResults.actions.forEach(action => {
          console.log(`  • ${action}`);
        });
      }
    }
    
    console.log('\n🧪 Test from DMZ (10.0.6.2):');
    console.log('============================');
    console.log('ping 10.0.0.14          # Should work now!');
    console.log('nc -zv 10.0.0.14 2049   # Test NFS port');
    console.log('showmount -e 10.0.0.14  # List NFS exports');
    console.log('\nFor Kubernetes:');
    console.log('kubectl exec -it <busybox-pod> -n home-assistant -- ping 10.0.0.14');
    
  } catch (error: any) {
    console.error('❌ Error during fix:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
  }
}

quickFixDMZ().catch(console.error);